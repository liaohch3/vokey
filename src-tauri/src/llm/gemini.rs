use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

use super::{LlmError, LlmProvider};

pub struct GeminiProvider {
    client: Client,
    api_key: String,
    model: String,
}

#[derive(Serialize)]
struct GeminiRequest {
    system_instruction: GeminiContent,
    contents: Vec<GeminiMessage>,
}

#[derive(Serialize)]
struct GeminiMessage {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Vec<GeminiCandidate>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiCandidateContent,
}

#[derive(Deserialize)]
struct GeminiCandidateContent {
    parts: Vec<GeminiPart>,
}

impl GeminiProvider {
    pub fn new(api_key: String, model: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
        }
    }
}

impl LlmProvider for GeminiProvider {
    fn generate(&self, system_prompt: &str, user_message: &str) -> Result<String, LlmError> {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let body = GeminiRequest {
            system_instruction: GeminiContent {
                parts: vec![GeminiPart {
                    text: system_prompt.to_string(),
                }],
            },
            contents: vec![GeminiMessage {
                role: "user".to_string(),
                parts: vec![GeminiPart {
                    text: user_message.to_string(),
                }],
            }],
        };

        let response = self
            .client
            .post(url)
            .json(&body)
            .send()
            .map_err(LlmError::Http)?;

        let status = response.status();
        let payload = response.text().map_err(LlmError::Http)?;
        if !status.is_success() {
            return Err(LlmError::Api(format!("status {status}: {payload}")));
        }

        let parsed: GeminiResponse = serde_json::from_str(&payload).map_err(LlmError::Json)?;
        let polished = parsed
            .candidates
            .first()
            .and_then(|candidate| candidate.content.parts.first())
            .map(|part| part.text.trim().to_string())
            .filter(|text| !text.is_empty())
            .ok_or_else(|| {
                LlmError::InvalidResponse("missing candidates[0].content.parts[0].text".to_string())
            })?;

        Ok(polished)
    }

    fn name(&self) -> &str {
        "gemini"
    }
}
