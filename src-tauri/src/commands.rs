use std::sync::mpsc;
use std::thread;

use base64::Engine;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::audio::{AudioError, AudioRecorder};
use crate::config::{load_or_create_config, save_config as persist_config, AppConfig};
use crate::llm::create_provider as create_llm_provider;
use crate::paste::{copy_to_clipboard, paste_text};
use crate::stt::create_provider as create_stt_provider;

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
    raw_text: String,
    polished_text: String,
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
pub fn get_config() -> Result<AppConfig, String> {
    load_or_create_config().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn save_config(config: AppConfig) -> Result<(), String> {
    persist_config(&config).map_err(|err| err.to_string())
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
    let stt_provider = create_stt_provider(&config.stt).map_err(|err| err.to_string())?;
    log::info!(
        "transcribing audio with stt provider: {}",
        stt_provider.name()
    );
    let raw_text = stt_provider
        .transcribe(&wav)
        .map_err(|err| err.to_string())?;

    emit_pipeline_status(&app, "polishing", None, None);
    let polished_text = polish_text_with_fallback(&config, &raw_text);
    emit_pipeline_status(&app, "done", Some(&polished_text), None);

    Ok(TranscriptionResult {
        wav_base64: base64::engine::general_purpose::STANDARD.encode(wav),
        raw_text,
        polished_text,
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

    let stt_provider = match create_stt_provider(&config.stt) {
        Ok(provider) => provider,
        Err(err) => {
            let message = format!("failed to create stt provider: {err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    };

    log::info!(
        "transcribing audio with stt provider: {}",
        stt_provider.name()
    );
    let raw_text = match stt_provider.transcribe(&wav) {
        Ok(text) => text,
        Err(err) => {
            let message = format!("transcription failed: {err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    };

    emit_pipeline_status(&app, "polishing", None, None);
    let polished_text = polish_text_with_fallback(&config, &raw_text);

    let mut done_message = None::<String>;
    if let Err(err) = paste_text(&polished_text) {
        log::warn!("paste simulation failed: {err}");
        done_message = Some(format!(
            "paste simulation failed; text copied to clipboard instead: {err}"
        ));

        if let Err(copy_err) = copy_to_clipboard(&polished_text) {
            let message = format!("clipboard fallback failed: {copy_err}");
            log::error!("{message}");
            emit_pipeline_status(&app, "error", None, Some(&message));
            return;
        }
    }

    emit_pipeline_status(&app, "done", Some(&polished_text), done_message.as_deref());
}

fn polish_text_with_fallback(config: &AppConfig, raw_text: &str) -> String {
    let llm_provider = match create_llm_provider(&config.llm) {
        Ok(provider) => provider,
        Err(err) => {
            log::warn!("failed to create llm provider; fallback to raw text: {err}");
            return raw_text.to_string();
        }
    };

    log::info!("polishing text with llm provider: {}", llm_provider.name());
    match llm_provider.polish(raw_text, &config.llm.system_prompt) {
        Ok(polished_text) => polished_text,
        Err(err) => {
            log::warn!("llm polishing failed; fallback to raw text: {err}");
            raw_text.to_string()
        }
    }
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
