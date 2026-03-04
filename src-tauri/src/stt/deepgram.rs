use reqwest::blocking::Client;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use reqwest::Url;
use serde::Deserialize;

use super::{SttError, SttProvider};

const DEEPGRAM_STT_URL: &str = "https://api.deepgram.com/v1/listen";

pub struct DeepgramProvider {
    client: Client,
    api_key: String,
    model: String,
    language: Option<String>,
}

#[derive(Deserialize)]
struct DeepgramResponse {
    results: DeepgramResults,
}

#[derive(Deserialize)]
struct DeepgramResults {
    channels: Vec<DeepgramChannel>,
}

#[derive(Deserialize)]
struct DeepgramChannel {
    alternatives: Vec<DeepgramAlternative>,
}

#[derive(Deserialize)]
struct DeepgramAlternative {
    transcript: String,
}

impl DeepgramProvider {
    pub fn new(api_key: String, model: String, language: Option<String>) -> Self {
        Self {
            client: Client::new(),
            api_key,
            model,
            language,
        }
    }

    fn endpoint(&self) -> Result<Url, SttError> {
        let mut url = Url::parse(DEEPGRAM_STT_URL)
            .map_err(|err| SttError::Api(format!("invalid deepgram endpoint: {err}")))?;

        {
            let mut query = url.query_pairs_mut();
            query.append_pair("model", &self.model);
            query.append_pair("smart_format", "true");
            query.append_pair("punctuate", "true");
            if let Some(language) = self.language.as_ref() {
                if !language.is_empty() {
                    query.append_pair("language", language);
                }
            }
        }

        Ok(url)
    }
}

impl SttProvider for DeepgramProvider {
    fn transcribe(&self, wav_data: &[u8]) -> Result<String, SttError> {
        let response = self
            .client
            .post(self.endpoint()?)
            .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
            .header(CONTENT_TYPE, "audio/wav")
            .body(wav_data.to_vec())
            .send()
            .map_err(SttError::Http)?;

        let status = response.status();
        let body = response.text().map_err(SttError::Http)?;

        if !status.is_success() {
            return Err(SttError::Api(format!("status {status}: {body}")));
        }

        let parsed: DeepgramResponse = serde_json::from_str(&body).map_err(SttError::Json)?;

        parsed
            .results
            .channels
            .first()
            .and_then(|channel| channel.alternatives.first())
            .map(|alternative| alternative.transcript.trim().to_string())
            .filter(|text| !text.is_empty())
            .ok_or_else(|| {
                SttError::Api(
                    "deepgram response missing results.channels[0].alternatives[0].transcript"
                        .to_string(),
                )
            })
    }

    fn name(&self) -> &str {
        "deepgram"
    }
}
