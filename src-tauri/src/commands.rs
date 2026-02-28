use std::sync::mpsc;

use base64::Engine;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::audio::{AudioError, AudioRecorder};

enum AudioRequest {
    Start(mpsc::Sender<Result<(), AudioError>>),
    Stop(mpsc::Sender<Result<Vec<u8>, AudioError>>),
}

pub struct AppState {
    audio_tx: mpsc::Sender<AudioRequest>,
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

    Ok(())
}

#[tauri::command]
pub fn stop_recording(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    let wav = state.stop_recording().map_err(|err| err.to_string())?;
    app.emit("recording-state-changed", false)
        .map_err(|err| err.to_string())?;

    Ok(base64::engine::general_purpose::STANDARD.encode(wav))
}

pub fn toggle_recording(app: &AppHandle) {
    let state = app.state::<AppState>();

    let is_recording = match state.start_recording() {
        Ok(()) => true,
        Err(AudioError::AlreadyRecording) => match state.stop_recording() {
            Ok(_) => false,
            Err(err) => {
                log::error!("hotkey toggle failed to stop recorder: {err}");
                return;
            }
        },
        Err(err) => {
            log::error!("hotkey toggle failed to start recorder: {err}");
            return;
        }
    };

    if let Err(err) = app.emit("recording-state-changed", is_recording) {
        log::error!("failed to emit recording-state-changed event: {err}");
    }
}
