use std::fmt;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const DEFAULT_MODEL: &str = "whisper-large-v3-turbo";

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
            Self::SerializeToml(err) => write!(f, "failed to serialize default config: {err}"),
        }
    }
}

impl std::error::Error for ConfigError {}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AppConfig {
    pub stt: SttConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SttConfig {
    pub provider: String,
    pub api_key: String,
    #[serde(default)]
    pub groq: GroqConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GroqConfig {
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default)]
    pub language: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            stt: SttConfig {
                provider: "groq".to_string(),
                api_key: String::new(),
                groq: GroqConfig::default(),
            },
        }
    }
}

impl Default for GroqConfig {
    fn default() -> Self {
        Self {
            model: default_model(),
            language: Some("zh".to_string()),
        }
    }
}

fn default_model() -> String {
    DEFAULT_MODEL.to_string()
}

pub fn load_or_create_config() -> Result<AppConfig, ConfigError> {
    let path = config_path()?;
    if !path.exists() {
        let default = AppConfig::default();
        write_default_config(&path, &default)?;
        return Ok(default);
    }

    let config_text = fs::read_to_string(&path).map_err(ConfigError::Io)?;
    toml::from_str(&config_text).map_err(ConfigError::ParseToml)
}

fn write_default_config(path: &PathBuf, config: &AppConfig) -> Result<(), ConfigError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(ConfigError::Io)?;
    }
    let body = toml::to_string_pretty(config).map_err(ConfigError::SerializeToml)?;
    fs::write(path, body).map_err(ConfigError::Io)
}

fn config_path() -> Result<PathBuf, ConfigError> {
    let home = dirs::home_dir().ok_or(ConfigError::HomeDirNotFound)?;
    Ok(home.join(".opentypeless").join("config.toml"))
}
