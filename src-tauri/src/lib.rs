mod audio;
mod commands;
mod config;
mod llm;
mod paste;
mod prompts;
mod stt;

use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use audio::request_microphone_permission;
use commands::{
    get_config, save_config, start_recording, stop_recording, stop_recording_and_transcribe,
    stop_recording_and_transcribe_with_mode, toggle_recording, AppState,
};

fn default_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &default_shortcut() && event.state() == ShortcutState::Pressed {
                        toggle_recording(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            request_microphone_permission();
            app.global_shortcut().register(default_shortcut())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            start_recording,
            stop_recording,
            stop_recording_and_transcribe,
            stop_recording_and_transcribe_with_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
