mod gemini;
mod openai;

use std::fmt;

use crate::config::{LlmConfig, OpenAiCompatibleConfig};

use gemini::GeminiProvider;
use openai::OpenAiCompatibleProvider;

pub trait LlmProvider: Send + Sync {
    fn generate(&self, system_prompt: &str, user_message: &str) -> Result<String, LlmError>;
    fn name(&self) -> &str;
}

#[derive(Debug)]
pub enum LlmError {
    UnsupportedProvider(String),
    MissingApiKey,
    Http(reqwest::Error),
    Json(serde_json::Error),
    Api(String),
    InvalidResponse(String),
}

impl fmt::Display for LlmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedProvider(provider) => {
                write!(f, "unsupported LLM provider: {provider}")
            }
            Self::MissingApiKey => write!(f, "llm.api_key is required for selected provider"),
            Self::Http(err) => write!(f, "llm request failed: {err}"),
            Self::Json(err) => write!(f, "invalid llm response payload: {err}"),
            Self::Api(message) => write!(f, "llm api error: {message}"),
            Self::InvalidResponse(message) => write!(f, "invalid llm response: {message}"),
        }
    }
}

impl std::error::Error for LlmError {}

pub fn default_base_url(provider: &str) -> Option<&'static str> {
    match provider {
        "openai" => Some("https://api.openai.com"),
        "openrouter" => Some("https://openrouter.ai/api/v1"),
        "deepseek" => Some("https://api.deepseek.com"),
        "groq" => Some("https://api.groq.com/openai"),
        "moonshot" => Some("https://api.moonshot.cn"),
        "qwen" => Some("https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "siliconflow" => Some("https://api.siliconflow.cn"),
        "ollama" => Some("http://localhost:11434"),
        _ => None,
    }
}

pub fn create_provider(config: &LlmConfig) -> Result<Box<dyn LlmProvider>, LlmError> {
    match config.provider.as_str() {
        "gemini" => {
            if config.api_key.trim().is_empty() {
                return Err(LlmError::MissingApiKey);
            }
            Ok(Box::new(GeminiProvider::new(
                config.api_key.clone(),
                config.gemini.model.clone(),
            )))
        }
        "none" => Ok(Box::new(PassthroughProvider)),
        provider @ ("openai" | "openrouter" | "deepseek" | "groq" | "moonshot" | "qwen"
        | "siliconflow" | "ollama") => {
            let preset = openai_compatible_preset(config, provider)?;
            let base_url = if preset.base_url.trim().is_empty() {
                default_base_url(provider)
                    .ok_or_else(|| LlmError::UnsupportedProvider(provider.to_string()))?
                    .to_string()
            } else {
                preset.base_url.clone()
            };

            Ok(Box::new(OpenAiCompatibleProvider::new(
                provider.to_string(),
                config.api_key.clone(),
                preset.model.clone(),
                base_url,
            )))
        }
        provider => Err(LlmError::UnsupportedProvider(provider.to_string())),
    }
}

fn openai_compatible_preset<'a>(
    config: &'a LlmConfig,
    provider: &str,
) -> Result<&'a OpenAiCompatibleConfig, LlmError> {
    match provider {
        "openai" => Ok(&config.openai),
        "openrouter" => Ok(&config.openrouter),
        "deepseek" => Ok(&config.deepseek),
        "groq" => Ok(&config.groq),
        "moonshot" => Ok(&config.moonshot),
        "qwen" => Ok(&config.qwen),
        "siliconflow" => Ok(&config.siliconflow),
        "ollama" => Ok(&config.ollama),
        _ => Err(LlmError::UnsupportedProvider(provider.to_string())),
    }
}

struct PassthroughProvider;

impl LlmProvider for PassthroughProvider {
    fn generate(&self, _system_prompt: &str, user_message: &str) -> Result<String, LlmError> {
        Ok(user_message.to_string())
    }

    fn name(&self) -> &str {
        "none"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_base_url_supports_expected_providers() {
        assert_eq!(default_base_url("openai"), Some("https://api.openai.com"));
        assert_eq!(
            default_base_url("openrouter"),
            Some("https://openrouter.ai/api/v1")
        );
        assert_eq!(
            default_base_url("deepseek"),
            Some("https://api.deepseek.com")
        );
        assert_eq!(
            default_base_url("groq"),
            Some("https://api.groq.com/openai")
        );
        assert_eq!(
            default_base_url("moonshot"),
            Some("https://api.moonshot.cn")
        );
        assert_eq!(
            default_base_url("qwen"),
            Some("https://dashscope.aliyuncs.com/compatible-mode/v1")
        );
        assert_eq!(
            default_base_url("siliconflow"),
            Some("https://api.siliconflow.cn")
        );
        assert_eq!(default_base_url("ollama"), Some("http://localhost:11434"));
    }
}
