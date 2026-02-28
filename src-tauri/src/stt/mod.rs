mod groq;
pub mod mock;

use std::fmt;

use crate::config::SttConfig;
use groq::GroqWhisperProvider;

pub trait SttProvider: Send + Sync {
    fn transcribe(&self, wav_data: &[u8]) -> Result<String, SttError>;
    fn name(&self) -> &str;
}

#[derive(Debug)]
pub enum SttError {
    UnsupportedProvider(String),
    MissingApiKey,
    Http(reqwest::Error),
    Json(serde_json::Error),
    Api(String),
}

impl fmt::Display for SttError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::UnsupportedProvider(provider) => {
                write!(f, "unsupported STT provider: {provider}")
            }
            Self::MissingApiKey => write!(f, "stt.api_key is required for selected provider"),
            Self::Http(err) => write!(f, "stt request failed: {err}"),
            Self::Json(err) => write!(f, "invalid stt response payload: {err}"),
            Self::Api(message) => write!(f, "stt api error: {message}"),
        }
    }
}

impl std::error::Error for SttError {}

pub fn create_provider(config: &SttConfig) -> Result<Box<dyn SttProvider>, SttError> {
    match config.provider.as_str() {
        "groq" => {
            if config.api_key.trim().is_empty() {
                return Err(SttError::MissingApiKey);
            }
            Ok(Box::new(GroqWhisperProvider::new(
                config.api_key.clone(),
                config.groq.model.clone(),
                config.groq.language.clone(),
            )))
        }
        "mock" => Ok(Box::new(mock::MockSttProvider)),
        provider => Err(SttError::UnsupportedProvider(provider.to_string())),
    }
}
