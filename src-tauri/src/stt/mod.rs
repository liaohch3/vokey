mod deepgram;
mod groq;
pub mod mock;
mod openai;
mod openrouter;
mod siliconflow;

use std::fmt;

use crate::config::SttConfig;
use deepgram::DeepgramProvider;
use groq::GroqWhisperProvider;
use openai::OpenAiWhisperProvider;
use openrouter::OpenRouterWhisperProvider;
use siliconflow::SiliconFlowWhisperProvider;

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
        "openai" => {
            if config.api_key.trim().is_empty() {
                return Err(SttError::MissingApiKey);
            }
            Ok(Box::new(OpenAiWhisperProvider::new(
                config.api_key.clone(),
                config.openai.model.clone(),
                config.openai.language.clone(),
            )))
        }
        "openrouter" => {
            if config.api_key.trim().is_empty() {
                return Err(SttError::MissingApiKey);
            }
            Ok(Box::new(OpenRouterWhisperProvider::new(
                config.api_key.clone(),
                config.openrouter.model.clone(),
                config.openrouter.language.clone(),
            )))
        }
        "deepgram" => {
            if config.api_key.trim().is_empty() {
                return Err(SttError::MissingApiKey);
            }
            Ok(Box::new(DeepgramProvider::new(
                config.api_key.clone(),
                config.deepgram.model.clone(),
                config.deepgram.language.clone(),
            )))
        }
        "siliconflow" => {
            if config.api_key.trim().is_empty() {
                return Err(SttError::MissingApiKey);
            }
            Ok(Box::new(SiliconFlowWhisperProvider::new(
                config.api_key.clone(),
                config.siliconflow.model.clone(),
                config.siliconflow.language.clone(),
            )))
        }
        "mock" => Ok(Box::new(mock::MockSttProvider)),
        provider => Err(SttError::UnsupportedProvider(provider.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_config(provider: &str) -> SttConfig {
        let mut config = SttConfig {
            provider: provider.to_string(),
            api_key: "test-key".to_string(),
            ..SttConfig::default()
        };
        config.groq.language = Some("en".to_string());
        config.openai.language = Some("en".to_string());
        config.openrouter.language = Some("en".to_string());
        config.deepgram.language = Some("en".to_string());
        config.siliconflow.language = Some("en".to_string());
        config
    }

    #[test]
    fn create_provider_routes_to_openai() {
        let provider = create_provider(&base_config("openai")).expect("provider should be created");
        assert_eq!(provider.name(), "openai");
    }

    #[test]
    fn create_provider_routes_to_deepgram() {
        let provider =
            create_provider(&base_config("deepgram")).expect("provider should be created");
        assert_eq!(provider.name(), "deepgram");
    }

    #[test]
    fn create_provider_routes_to_openrouter() {
        let provider =
            create_provider(&base_config("openrouter")).expect("provider should be created");
        assert_eq!(provider.name(), "openrouter");
    }

    #[test]
    fn create_provider_routes_to_siliconflow() {
        let provider =
            create_provider(&base_config("siliconflow")).expect("provider should be created");
        assert_eq!(provider.name(), "siliconflow");
    }

    #[test]
    fn create_provider_requires_api_key_for_real_provider() {
        let mut config = base_config("openai");
        config.api_key = String::new();
        let result = create_provider(&config);
        assert!(matches!(result, Err(SttError::MissingApiKey)));
    }
}
