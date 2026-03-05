use crate::commands::VoiceMode;
use crate::config::PromptTemplates;

pub fn system_prompt_for_mode(
    mode: &VoiceMode,
    prompt_templates: &PromptTemplates,
    user_custom_prompt: &str,
    target_language: &str,
    dictionary_terms: &[String],
) -> String {
    let dictionary_injection = render_dictionary_injection(dictionary_terms);
    let base_template = match mode {
        VoiceMode::Dictation => &prompt_templates.dictation,
        VoiceMode::AskAnything => &prompt_templates.ask_anything,
        VoiceMode::Translation => &prompt_templates.translation,
    };

    let base = base_template
        .replace("{target_language}", target_language)
        .replace("{dictionary_injection}", &dictionary_injection);
    join_prompt(&base, user_custom_prompt)
}

fn join_prompt(base: &str, user_custom_prompt: &str) -> String {
    let trimmed = user_custom_prompt.trim();
    if trimmed.is_empty() {
        return base.to_string();
    }

    format!("{base}\n\nUser custom instruction:\n{trimmed}")
}

fn render_dictionary_injection(dictionary_terms: &[String]) -> String {
    if dictionary_terms.is_empty() {
        return String::new();
    }

    let terms = dictionary_terms
        .iter()
        .map(|term| format!("- {term}"))
        .collect::<Vec<_>>()
        .join("\n");

    format!("Custom vocabulary (always use exact spelling):\n{terms}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::PromptTemplates;

    #[test]
    fn dictation_mode_uses_dictation_rules() {
        let prompt = system_prompt_for_mode(
            &VoiceMode::Dictation,
            &PromptTemplates::default(),
            "",
            "English",
            &[],
        );
        assert!(prompt.contains("dictation cleanup assistant"));
        assert!(prompt.contains("Rules (in priority order)"));
    }

    #[test]
    fn ask_anything_mode_uses_qa_instruction() {
        let prompt = system_prompt_for_mode(
            &VoiceMode::AskAnything,
            &PromptTemplates::default(),
            "",
            "English",
            &[],
        );
        assert!(prompt.contains("helpful assistant"));
        assert!(prompt.contains("Answer the user's question concisely"));
    }

    #[test]
    fn translation_mode_injects_target_language() {
        let prompt = system_prompt_for_mode(
            &VoiceMode::Translation,
            &PromptTemplates::default(),
            "",
            "Japanese",
            &[],
        );

        assert!(prompt.contains("to Japanese"));
        assert!(prompt.contains("Output only the translation"));
    }

    #[test]
    fn custom_prompt_is_appended_when_present() {
        let prompt = system_prompt_for_mode(
            &VoiceMode::Dictation,
            &PromptTemplates::default(),
            "Keep domain terms exact.",
            "English",
            &[],
        );
        assert!(prompt.contains("User custom instruction"));
        assert!(prompt.contains("Keep domain terms exact."));
    }

    #[test]
    fn dictionary_terms_are_injected_when_present() {
        let prompt = system_prompt_for_mode(
            &VoiceMode::Dictation,
            &PromptTemplates::default(),
            "",
            "English",
            &["Tauri".to_string(), "OpenAI".to_string()],
        );
        assert!(prompt.contains("Custom vocabulary"));
        assert!(prompt.contains("- Tauri"));
        assert!(prompt.contains("- OpenAI"));
    }
}
