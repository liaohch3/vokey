use std::fmt;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const DEFAULT_STT_MODEL: &str = "whisper-large-v3-turbo";
const DEFAULT_LLM_SYSTEM_PROMPT: &str = "You are a dictation assistant. Clean up the following speech-to-text transcription: fix grammar, remove filler words, improve punctuation. Keep the original meaning and language. Return only the polished text, no explanation.";
const DEFAULT_GEMINI_MODEL: &str = "gemini-2.0-flash";
const DEFAULT_OPENAI_MODEL: &str = "gpt-4o-mini";
const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com";

#[derive(Debug)]
pub enum ConfigError {
    HomeDirNotFound,
    Io(std::io::Error),
    ParseToml(toml::de::Error),
    SerializeToml(toml::ser::Error),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::HomeDirNotFound => write!(f, "home directory is not available"),
            Self::Io(err) => write!(f, "failed to access config file: {err}"),
            Self::ParseToml(err) => write!(f, "failed to parse config: {err}"),
            Self::SerializeToml(err) => write!(f, "failed to serialize config: {err}"),
        }
    }
}

impl std::error::Error for ConfigError {}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct AppConfig {
    #[serde(default)]
    pub stt: SttConfig,
    #[serde(default)]
    pub llm: LlmConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SttConfig {
    pub provider: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub groq: GroqConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GroqConfig {
    #[serde(default = "default_stt_model")]
    pub model: String,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LlmConfig {
    pub provider: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default = "default_llm_system_prompt")]
    pub system_prompt: String,
    #[serde(default)]
    pub gemini: GeminiConfig,
    #[serde(default)]
    pub openai: OpenAiCompatibleConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GeminiConfig {
    #[serde(default = "default_gemini_model")]
    pub model: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpenAiCompatibleConfig {
    #[serde(default = "default_openai_model")]
    pub model: String,
    #[serde(default = "default_openai_base_url")]
    pub base_url: String,
}

impl Default for SttConfig {
    fn default() -> Self {
        Self {
            provider: "groq".to_string(),
            api_key: String::new(),
            groq: GroqConfig::default(),
        }
    }
}

impl Default for GroqConfig {
    fn default() -> Self {
        Self {
            model: default_stt_model(),
            language: Some("zh".to_string()),
        }
    }
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: "none".to_string(),
            api_key: String::new(),
            system_prompt: default_llm_system_prompt(),
            gemini: GeminiConfig::default(),
            openai: OpenAiCompatibleConfig::default(),
        }
    }
}

impl Default for GeminiConfig {
    fn default() -> Self {
        Self {
            model: default_gemini_model(),
        }
    }
}

impl Default for OpenAiCompatibleConfig {
    fn default() -> Self {
        Self {
            model: default_openai_model(),
            base_url: default_openai_base_url(),
        }
    }
}

fn default_stt_model() -> String {
    DEFAULT_STT_MODEL.to_string()
}

fn default_llm_system_prompt() -> String {
    DEFAULT_LLM_SYSTEM_PROMPT.to_string()
}

fn default_gemini_model() -> String {
    DEFAULT_GEMINI_MODEL.to_string()
}

fn default_openai_model() -> String {
    DEFAULT_OPENAI_MODEL.to_string()
}

fn default_openai_base_url() -> String {
    DEFAULT_OPENAI_BASE_URL.to_string()
}

pub fn load_or_create_config() -> Result<AppConfig, ConfigError> {
    let path = config_path()?;
    if !path.exists() {
        let default = AppConfig::default();
        save_config(&default)?;
        return Ok(default);
    }

    let config_text = fs::read_to_string(&path).map_err(ConfigError::Io)?;
    toml::from_str(&config_text).map_err(ConfigError::ParseToml)
}

pub fn save_config(config: &AppConfig) -> Result<(), ConfigError> {
    let path = config_path()?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(ConfigError::Io)?;
    }

    let body = toml::to_string_pretty(config).map_err(ConfigError::SerializeToml)?;
    fs::write(path, body).map_err(ConfigError::Io)
}

pub fn config_path() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or(ConfigError::HomeDirNotFound)?;
    Ok(home.join(".vokey").join("config.toml"))
}
