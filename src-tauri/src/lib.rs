mod audio;
mod commands;
mod config;
mod dictionary;
mod history;
mod llm;
mod paste;
mod prompts;
mod stt;

use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use audio::request_microphone_permission;
use commands::{
    add_history_entry, clear_history, delete_entry, get_config, get_history,
    import_legacy_history_entries, is_first_run, load_dictionary, save_config, save_dictionary,
    start_recording, stop_recording, stop_recording_and_transcribe,
    stop_recording_and_transcribe_with_mode, toggle_recording, AppState, VoiceMode,
};

fn dictation_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space)
}

fn ask_anything_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyA)
}

fn translation_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyT)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }

                    if shortcut == &dictation_shortcut() {
                        toggle_recording(app, VoiceMode::Dictation);
                    } else if shortcut == &ask_anything_shortcut() {
                        toggle_recording(app, VoiceMode::AskAnything);
                    } else if shortcut == &translation_shortcut() {
                        toggle_recording(app, VoiceMode::Translation);
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
            app.global_shortcut().register(dictation_shortcut())?;
            app.global_shortcut().register(ask_anything_shortcut())?;
            app.global_shortcut().register(translation_shortcut())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            is_first_run,
            save_config,
            load_dictionary,
            save_dictionary,
            get_history,
            add_history_entry,
            clear_history,
            delete_entry,
            import_legacy_history_entries,
            start_recording,
            stop_recording,
            stop_recording_and_transcribe,
            stop_recording_and_transcribe_with_mode
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
