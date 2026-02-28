use super::{SttError, SttProvider};

pub struct MockSttProvider;

impl SttProvider for MockSttProvider {
    fn transcribe(&self, _wav_data: &[u8]) -> Result<String, SttError> {
        Ok("mock transcription".to_string())
    }

    fn name(&self) -> &str {
        "mock"
    }
}
