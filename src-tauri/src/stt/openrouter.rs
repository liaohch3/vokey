use reqwest::blocking::Client;
use reqwest::header::AUTHORIZATION;
use serde::Deserialize;

use super::{SttError, SttProvider};

const OPENROUTER_STT_URL: &str = "https://openrouter.ai/api/v1/audio/transcriptions";

pub struct OpenRouterWhisperProvider {
    client: Client,
    api_key: String,
    model: String,
    language: Option<String>,
}

#[derive(Deserialize)]
struct OpenRouterTranscriptionResponse {
    text: String,
}

impl OpenRouterWhisperProvider {
    pub fn new(api_key: String, model: String, language: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
            language,
        }
    }
}

impl SttProvider for OpenRouterWhisperProvider {
    fn transcribe(&self, wav_data: &[u8]) -> Result<String, SttError> {
        let file = reqwest::blocking::multipart::Part::bytes(wav_data.to_vec())
            .file_name("recording.wav")
            .mime_str("audio/wav")
            .map_err(SttError::Http)?;

        let mut form = reqwest::blocking::multipart::Form::new()
            .text("model", self.model.clone())
            .part("file", file);

        if let Some(language) = self.language.as_ref() {
            if !language.is_empty() {
                form = form.text("language", language.clone());
            }
        }

        let response = self
            .client
            .post(OPENROUTER_STT_URL)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .map_err(SttError::Http)?;

        let status = response.status();
        let body = response.text().map_err(SttError::Http)?;

        if !status.is_success() {
            return Err(SttError::Api(format!("status {status}: {body}")));
        }

        let parsed: OpenRouterTranscriptionResponse =
            serde_json::from_str(&body).map_err(SttError::Json)?;
        Ok(parsed.text)
    }

    fn name(&self) -> &str {
        "openrouter"
    }
}
