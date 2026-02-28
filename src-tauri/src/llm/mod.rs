mod gemini;
mod openai;

use std::fmt;

use crate::config::LlmConfig;

use gemini::GeminiProvider;
use openai::OpenAiCompatibleProvider;

pub trait LlmProvider: Send + Sync {
    fn polish(&self, raw_text: &str, system_prompt: &str) -> Result<String, LlmError>;
    fn name(&self) -> &str;
}

#[derive(Debug)]
pub enum LlmError {
    UnsupportedProvider(String),
    MissingApiKey,
    MissingBaseUrl,
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
            Self::MissingBaseUrl => write!(f, "llm.openai.base_url is required"),
            Self::Http(err) => write!(f, "llm request failed: {err}"),
            Self::Json(err) => write!(f, "invalid llm response payload: {err}"),
            Self::Api(message) => write!(f, "llm api error: {message}"),
            Self::InvalidResponse(message) => write!(f, "invalid llm response: {message}"),
        }
    }
}

impl std::error::Error for LlmError {}

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
        "openai" => {
            if config.openai.base_url.trim().is_empty() {
                return Err(LlmError::MissingBaseUrl);
            }
            Ok(Box::new(OpenAiCompatibleProvider::new(
                config.api_key.clone(),
                config.openai.model.clone(),
                config.openai.base_url.clone(),
            )))
        }
        "none" => Ok(Box::new(PassthroughProvider)),
        provider => Err(LlmError::UnsupportedProvider(provider.to_string())),
    }
}

struct PassthroughProvider;

impl LlmProvider for PassthroughProvider {
    fn polish(&self, raw_text: &str, _system_prompt: &str) -> Result<String, LlmError> {
        Ok(raw_text.to_string())
    }

    fn name(&self) -> &str {
        "none"
    }
}
