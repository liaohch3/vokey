use std::fmt;
use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const DEFAULT_STT_MODEL: &str = "whisper-large-v3-turbo";
const DEFAULT_OPENAI_STT_MODEL: &str = "whisper-1";
const DEFAULT_OPENROUTER_STT_MODEL: &str = "openai/whisper-large-v3";
const DEFAULT_DEEPGRAM_MODEL: &str = "nova-3";
const DEFAULT_SILICONFLOW_STT_MODEL: &str = "FunAudioLLM/SenseVoiceSmall";

const DEFAULT_LLM_SYSTEM_PROMPT: &str = "";
const DEFAULT_PROMPT_DICTATION: &str = r#"You are a dictation cleanup assistant.

Rules (in priority order):
1. PUNCTUATION - Add punctuation at speech pauses
2. CLEANUP - Remove filler words, false starts, repetitions
3. LISTS - Detect enumeration signals, format as numbered lists
4. PARAGRAPHS - Separate distinct topics with blank lines
5. PRESERVE - Keep original language, technical terms, proper nouns
6. OUTPUT - Return only the cleaned text, no explanation

{dictionary_injection}"#;
const DEFAULT_PROMPT_ASK_ANYTHING: &str = r#"You are a helpful assistant. Answer the user's question concisely.
If the user references selected text, apply their instruction to that text.
Output only the result, no explanation or preamble.

{dictionary_injection}"#;
const DEFAULT_PROMPT_TRANSLATION: &str = r#"Translate the following text to {target_language}.
Preserve the original meaning, tone, and formatting.
Output only the translation, no explanation.

{dictionary_injection}"#;
const DEFAULT_TARGET_LANG: &str = "English";
const DEFAULT_GEMINI_MODEL: &str = "gemini-2.0-flash";

const DEFAULT_OPENAI_MODEL: &str = "gpt-4o-mini";
const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com";
const DEFAULT_OPENROUTER_MODEL: &str = "openai/gpt-4o-mini";
const DEFAULT_OPENROUTER_BASE_URL: &str = "https://openrouter.ai/api/v1";
const DEFAULT_DEEPSEEK_MODEL: &str = "deepseek-chat";
const DEFAULT_DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com";
const DEFAULT_GROQ_MODEL: &str = "llama-3.3-70b-versatile";
const DEFAULT_GROQ_BASE_URL: &str = "https://api.groq.com/openai";
const DEFAULT_MOONSHOT_MODEL: &str = "moonshot-v1-8k";
const DEFAULT_MOONSHOT_BASE_URL: &str = "https://api.moonshot.cn";
const DEFAULT_QWEN_MODEL: &str = "qwen-plus";
const DEFAULT_QWEN_BASE_URL: &str = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_SILICONFLOW_LLM_MODEL: &str = "Qwen/Qwen2.5-7B-Instruct";
const DEFAULT_SILICONFLOW_LLM_BASE_URL: &str = "https://api.siliconflow.cn";
const DEFAULT_OLLAMA_MODEL: &str = "qwen2.5:7b";
const DEFAULT_OLLAMA_BASE_URL: &str = "http://localhost:11434";

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
    pub groq: SttProviderConfig,
    #[serde(default)]
    pub openai: SttProviderConfig,
    #[serde(default)]
    pub openrouter: SttProviderConfig,
    #[serde(default)]
    pub deepgram: SttProviderConfig,
    #[serde(default)]
    pub siliconflow: SttProviderConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SttProviderConfig {
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
    #[serde(default = "default_target_lang")]
    pub target_lang: String,
    #[serde(default)]
    pub prompts: PromptTemplates,
    #[serde(default)]
    pub gemini: GeminiConfig,
    #[serde(default)]
    pub openai: OpenAiCompatibleConfig,
    #[serde(default)]
    pub openrouter: OpenAiCompatibleConfig,
    #[serde(default)]
    pub deepseek: OpenAiCompatibleConfig,
    #[serde(default)]
    pub groq: OpenAiCompatibleConfig,
    #[serde(default)]
    pub moonshot: OpenAiCompatibleConfig,
    #[serde(default)]
    pub qwen: OpenAiCompatibleConfig,
    #[serde(default)]
    pub siliconflow: OpenAiCompatibleConfig,
    #[serde(default)]
    pub ollama: OpenAiCompatibleConfig,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PromptTemplates {
    pub dictation: String,
    pub ask_anything: String,
    pub translation: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GeminiConfig {
    #[serde(default = "default_gemini_model")]
    pub model: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OpenAiCompatibleConfig {
    pub model: String,
    pub base_url: String,
}

impl Default for SttConfig {
    fn default() -> Self {
        Self {
            provider: "groq".to_string(),
            api_key: String::new(),
            groq: SttProviderConfig::groq_default(),
            openai: SttProviderConfig::openai_default(),
            openrouter: SttProviderConfig::openrouter_default(),
            deepgram: SttProviderConfig::deepgram_default(),
            siliconflow: SttProviderConfig::siliconflow_default(),
        }
    }
}

impl SttProviderConfig {
    fn groq_default() -> Self {
        Self {
            model: DEFAULT_STT_MODEL.to_string(),
            language: Some("zh".to_string()),
        }
    }

    fn openai_default() -> Self {
        Self {
            model: DEFAULT_OPENAI_STT_MODEL.to_string(),
            language: None,
        }
    }

    fn openrouter_default() -> Self {
        Self {
            model: DEFAULT_OPENROUTER_STT_MODEL.to_string(),
            language: None,
        }
    }

    fn deepgram_default() -> Self {
        Self {
            model: DEFAULT_DEEPGRAM_MODEL.to_string(),
            language: Some("en".to_string()),
        }
    }

    fn siliconflow_default() -> Self {
        Self {
            model: DEFAULT_SILICONFLOW_STT_MODEL.to_string(),
            language: Some("zh".to_string()),
        }
    }
}

impl Default for SttProviderConfig {
    fn default() -> Self {
        SttProviderConfig::groq_default()
    }
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            provider: "none".to_string(),
            api_key: String::new(),
            system_prompt: default_llm_system_prompt(),
            target_lang: default_target_lang(),
            prompts: PromptTemplates::default(),
            gemini: GeminiConfig::default(),
            openai: OpenAiCompatibleConfig::openai_default(),
            openrouter: OpenAiCompatibleConfig::openrouter_default(),
            deepseek: OpenAiCompatibleConfig::deepseek_default(),
            groq: OpenAiCompatibleConfig::groq_default(),
            moonshot: OpenAiCompatibleConfig::moonshot_default(),
            qwen: OpenAiCompatibleConfig::qwen_default(),
            siliconflow: OpenAiCompatibleConfig::siliconflow_default(),
            ollama: OpenAiCompatibleConfig::ollama_default(),
        }
    }
}

impl Default for PromptTemplates {
    fn default() -> Self {
        Self {
            dictation: default_prompt_dictation(),
            ask_anything: default_prompt_ask_anything(),
            translation: default_prompt_translation(),
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

impl OpenAiCompatibleConfig {
    fn openai_default() -> Self {
        Self {
            model: DEFAULT_OPENAI_MODEL.to_string(),
            base_url: DEFAULT_OPENAI_BASE_URL.to_string(),
        }
    }

    fn openrouter_default() -> Self {
        Self {
            model: DEFAULT_OPENROUTER_MODEL.to_string(),
            base_url: DEFAULT_OPENROUTER_BASE_URL.to_string(),
        }
    }

    fn deepseek_default() -> Self {
        Self {
            model: DEFAULT_DEEPSEEK_MODEL.to_string(),
            base_url: DEFAULT_DEEPSEEK_BASE_URL.to_string(),
        }
    }

    fn groq_default() -> Self {
        Self {
            model: DEFAULT_GROQ_MODEL.to_string(),
            base_url: DEFAULT_GROQ_BASE_URL.to_string(),
        }
    }

    fn moonshot_default() -> Self {
        Self {
            model: DEFAULT_MOONSHOT_MODEL.to_string(),
            base_url: DEFAULT_MOONSHOT_BASE_URL.to_string(),
        }
    }

    fn qwen_default() -> Self {
        Self {
            model: DEFAULT_QWEN_MODEL.to_string(),
            base_url: DEFAULT_QWEN_BASE_URL.to_string(),
        }
    }

    fn siliconflow_default() -> Self {
        Self {
            model: DEFAULT_SILICONFLOW_LLM_MODEL.to_string(),
            base_url: DEFAULT_SILICONFLOW_LLM_BASE_URL.to_string(),
        }
    }

    fn ollama_default() -> Self {
        Self {
            model: DEFAULT_OLLAMA_MODEL.to_string(),
            base_url: DEFAULT_OLLAMA_BASE_URL.to_string(),
        }
    }
}

impl Default for OpenAiCompatibleConfig {
    fn default() -> Self {
        OpenAiCompatibleConfig::openai_default()
    }
}

fn default_llm_system_prompt() -> String {
    DEFAULT_LLM_SYSTEM_PROMPT.to_string()
}

fn default_target_lang() -> String {
    DEFAULT_TARGET_LANG.to_string()
}

fn default_prompt_dictation() -> String {
    DEFAULT_PROMPT_DICTATION.to_string()
}

fn default_prompt_ask_anything() -> String {
    DEFAULT_PROMPT_ASK_ANYTHING.to_string()
}

fn default_prompt_translation() -> String {
    DEFAULT_PROMPT_TRANSLATION.to_string()
}

fn default_gemini_model() -> String {
    DEFAULT_GEMINI_MODEL.to_string()
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
