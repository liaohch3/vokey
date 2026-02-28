use std::sync::mpsc;
use std::thread;

use base64::Engine;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::audio::{AudioError, AudioRecorder};
use crate::config::load_or_create_config;
use crate::paste::{copy_to_clipboard, paste_text};
use crate::stt::create_provider;

enum AudioRequest {
    Start(mpsc::Sender<Result<(), AudioError>>),
    Stop(mpsc::Sender<Result<Vec<u8>, AudioError>>),
}

pub struct AppState {
    audio_tx: mpsc::Sender<AudioRequest>,
}

#[derive(Serialize)]
pub struct TranscriptionResult {
    wav_base64: String,
    text: String,
}

#[derive(Clone, Serialize)]
struct PipelineStatus {
    stage: String,
    text: Option<String>,
    message: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        let (audio_tx, audio_rx) = mpsc::channel::<AudioRequest>();

        std::thread::spawn(move || {
            let mut recorder = AudioRecorder::default();
            while let Ok(request) = audio_rx.recv() {
                match request {
                    AudioRequest::Start(response_tx) => {
                        let _ = response_tx.send(recorder.start_recording());
                    }
                    AudioRequest::Stop(response_tx) => {
                        let _ = response_tx.send(recorder.stop_recording());
                    }
                }
            }
        });

        Self { audio_tx }
    }

    fn start_recording(&self) -> Result<(), AudioError> {
        let (response_tx, response_rx) = mpsc::channel();
        self.audio_tx
            .send(AudioRequest::Start(response_tx))
            .map_err(|_| AudioError::NotRecording)?;
        response_rx.recv().map_err(|_| AudioError::NotRecording)?
    }

    fn stop_recording(&self) -> Result<Vec<u8>, AudioError> {
        let (response_tx, response_rx) = mpsc::channel();
        self.audio_tx
            .send(AudioRequest::Stop(response_tx))
            .map_err(|_| AudioError::NotRecording)?;
        response_rx.recv().map_err(|_| AudioError::NotRecording)?
    }
}

#[tauri::command]
pub fn start_recording(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    state.start_recording().map_err(|err| err.to_string())?;
    app.emit("recording-state-changed", true)
        .map_err(|err| err.to_string())?;
    emit_pipeline_status(&app, "recording", None, None);

    Ok(())
}

#[tauri::command]
pub fn stop_recording(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let wav = state.stop_recording().map_err(|err| err.to_string())?;
    app.emit("recording-state-changed", false)
        .map_err(|err| err.to_string())?;

    Ok(base64::engine::general_purpose::STANDARD.encode(wav))
}

#[tauri::command]
pub fn stop_recording_and_transcribe(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TranscriptionResult, String> {
    let wav = state.stop_recording().map_err(|err| err.to_string())?;
    app.emit("recording-state-changed", false)
        .map_err(|err| err.to_string())?;
    emit_pipeline_status(&app, "transcribing", None, None);

    let config = load_or_create_config().map_err(|err| err.to_string())?;
    let provider = create_provider(&config.stt).map_err(|err| err.to_string())?;
    log::info!("transcribing audio with stt provider: {}", provider.name());
    let text = provider.transcribe(&wav).map_err(|err| err.to_string())?;
    emit_pipeline_status(&app, "done", Some(&text), None);

    Ok(TranscriptionResult {
        wav_base64: base64::engine::general_purpose::STANDARD.encode(wav),
        text,
    })
}

pub fn toggle_recording(app: &AppHandle) {
    let state = app.state::<AppState>();

    match state.start_recording() {
        Ok(()) => {
            if let Err(err) = app.emit("recording-state-changed", true) {
                log::error!("failed to emit recording-state-changed event: {err}");
            }
            emit_pipeline_status(app, "recording", None, None);
        }
        Err(AudioError::AlreadyRecording) => match state.stop_recording() {
            Ok(wav) => {
                if let Err(err) = app.emit("recording-state-changed", false) {
                    log::error!("failed to emit recording-state-changed event: {err}");
                }

                let app_handle = app.clone();
                thread::spawn(move || {
                    run_transcribe_and_paste_pipeline(app_handle, wav);
                });
            }
            Err(err) => {
                log::error!("hotkey toggle failed to stop recorder: {err}");
            }
        },
        Err(err) => {
            log::error!("hotkey toggle failed to start recorder: {err}");
        }
    }
}

fn run_transcribe_and_paste_pipeline(app: AppHandle, wav: Vec<u8>) {
    emit_pipeline_status(&app, "transcribing", None, None);

    let config = match load_or_create_config() {
        Ok(config) => config,
        Err(err) => {
            let message = format!("failed to load config: {err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    };

    let provider = match create_provider(&config.stt) {
        Ok(provider) => provider,
        Err(err) => {
            let message = format!("failed to create stt provider: {err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    };

    log::info!("transcribing audio with stt provider: {}", provider.name());
    let text = match provider.transcribe(&wav) {
        Ok(text) => text,
        Err(err) => {
            let message = format!("transcription failed: {err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    };

    emit_pipeline_status(&app, "pasting", None, None);

    let mut done_message = None::<String>;
    if let Err(err) = paste_text(&text) {
        log::warn!("paste simulation failed: {err}");
        done_message = Some(format!(
            "paste simulation failed; text copied to clipboard instead: {err}"
        ));

        if let Err(copy_err) = copy_to_clipboard(&text) {
            let message = format!("clipboard fallback failed: {copy_err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    }

    emit_pipeline_status(&app, "done", Some(&text), done_message.as_deref());
}

fn emit_pipeline_status(app: &AppHandle, stage: &str, text: Option<&str>, message: Option<&str>) {
    if let Err(err) = app.emit(
        "pipeline-status-changed",
        PipelineStatus {
            stage: stage.to_string(),
            text: text.map(ToString::to_string),
            message: message.map(ToString::to_string),
        },
    ) {
        log::error!("failed to emit pipeline-status-changed event: {err}");
    }
}
