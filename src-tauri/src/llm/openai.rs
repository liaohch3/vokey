use reqwest::blocking::Client;
use reqwest::header::AUTHORIZATION;
use serde::{Deserialize, Serialize};

use super::{LlmError, LlmProvider};

pub struct OpenAiCompatibleProvider {
    client: Client,
    api_key: String,
    model: String,
    base_url: String,
}

#[derive(Serialize)]
struct ChatCompletionsRequest {
    model: String,
    messages: Vec<ChatMessage>,
}

#[derive(Serialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionsResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: serde_json::Value,
}

impl OpenAiCompatibleProvider {
    pub fn new(api_key: String, model: String, base_url: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
            base_url,
        }
    }

    fn endpoint(&self) -> String {
        let base = self.base_url.trim_end_matches('/');
        format!("{base}/v1/chat/completions")
    }
}

impl LlmProvider for OpenAiCompatibleProvider {
    fn polish(&self, raw_text: &str, system_prompt: &str) -> Result<String, LlmError> {
        let body = ChatCompletionsRequest {
            model: self.model.clone(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: raw_text.to_string(),
                },
            ],
        };

        let mut request = self.client.post(self.endpoint());
        if !self.api_key.trim().is_empty() {
            request = request.header(AUTHORIZATION, format!("Bearer {}", self.api_key));
        }

        let response = request.json(&body).send().map_err(LlmError::Http)?;

        let status = response.status();
        let payload = response.text().map_err(LlmError::Http)?;

        if !status.is_success() {
            return Err(LlmError::Api(format!("status {status}: {payload}")));
        }

        let parsed: ChatCompletionsResponse =
            serde_json::from_str(&payload).map_err(LlmError::Json)?;
        let content = parsed
            .choices
            .first()
            .ok_or_else(|| LlmError::InvalidResponse("missing choices[0]".to_string()))?
            .message
            .content
            .clone();

        let text = extract_text(content)?;
        Ok(text)
    }

    fn name(&self) -> &str {
        "openai"
    }
}

fn extract_text(content: serde_json::Value) -> Result<String, LlmError> {
    if let Some(text) = content.as_str() {
        let trimmed = text.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    if let Some(parts) = content.as_array() {
        let mut merged = String::new();
        for part in parts {
            if let Some(text) = part.get("text").and_then(serde_json::Value::as_str) {
                merged.push_str(text);
            }
        }
        let trimmed = merged.trim();
        if !trimmed.is_empty() {
            return Ok(trimmed.to_string());
        }
    }

    Err(LlmError::InvalidResponse(
        "missing choices[0].message.content text".to_string(),
    ))
}
