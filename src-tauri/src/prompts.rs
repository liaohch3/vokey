use crate::commands::VoiceMode;

const DICTATION_BASE_PROMPT: &str = r#"You are a dictation cleanup assistant.

Rules (in priority order):
1. PUNCTUATION - Add punctuation at speech pauses
2. CLEANUP - Remove filler words, false starts, repetitions
3. LISTS - Detect enumeration signals, format as numbered lists
4. PARAGRAPHS - Separate distinct topics with blank lines
5. PRESERVE - Keep original language, technical terms, proper nouns
6. OUTPUT - Return only the cleaned text, no explanation"#;

const ASK_ANYTHING_PROMPT: &str = r#"You are a helpful assistant. Answer the user's question concisely.
If the user references selected text, apply their instruction to that text.
Output only the result, no explanation or preamble."#;

pub fn system_prompt_for_mode(mode: &VoiceMode, user_custom_prompt: &str) -> String {
    match mode {
        VoiceMode::Dictation => join_prompt(DICTATION_BASE_PROMPT, user_custom_prompt),
        VoiceMode::AskAnything => join_prompt(ASK_ANYTHING_PROMPT, user_custom_prompt),
        VoiceMode::Translation { target_lang } => {
            let base = format!(
                "Translate the following text to {}.\nPreserve the original meaning, tone, and formatting.\nOutput only the translation, no explanation.",
                target_lang
            );
            join_prompt(&base, user_custom_prompt)
        }
    }
}

fn join_prompt(base: &str, user_custom_prompt: &str) -> String {
    let trimmed = user_custom_prompt.trim();
    if trimmed.is_empty() {
        return base.to_string();
    }

    format!("{base}\n\nUser custom instruction:\n{trimmed}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dictation_mode_uses_dictation_rules() {
        let prompt = system_prompt_for_mode(&VoiceMode::Dictation, "");
        assert!(prompt.contains("dictation cleanup assistant"));
        assert!(prompt.contains("Rules (in priority order)"));
    }

    #[test]
    fn ask_anything_mode_uses_qa_instruction() {
        let prompt = system_prompt_for_mode(&VoiceMode::AskAnything, "");
        assert!(prompt.contains("helpful assistant"));
        assert!(prompt.contains("Answer the user's question concisely"));
    }

    #[test]
    fn translation_mode_injects_target_language() {
        let prompt = system_prompt_for_mode(
            &VoiceMode::Translation {
                target_lang: "Japanese".to_string(),
            },
            "",
        );

        assert!(prompt.contains("to Japanese"));
        assert!(prompt.contains("Output only the translation"));
    }

    #[test]
    fn custom_prompt_is_appended_when_present() {
        let prompt = system_prompt_for_mode(&VoiceMode::Dictation, "Keep domain terms exact.");
        assert!(prompt.contains("User custom instruction"));
        assert!(prompt.contains("Keep domain terms exact."));
    }
}
