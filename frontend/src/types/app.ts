export type Page = 'home' | 'history' | 'settings'

export type TranscriptionResult = {
  wav_base64: string
  raw_text: string
  polished_text: string
}

export type PipelineStatusPayload = {
  stage: string
  text?: string | null
  message?: string | null
}

export type HistoryItem = {
  id: string
  timestamp: string
  rawText: string
  polishedText: string
}

export type SttProvider = 'groq' | 'openai' | 'deepgram' | 'siliconflow' | 'mock'

export type LlmProvider =
  | 'gemini'
  | 'openai'
  | 'openrouter'
  | 'deepseek'
  | 'groq'
  | 'moonshot'
  | 'qwen'
  | 'siliconflow'
  | 'ollama'
  | 'none'

export type SttProviderConfig = {
  model: string
  language: string | null
}

export type OpenAiCompatibleConfig = {
  model: string
  base_url: string
}

export type AppConfig = {
  stt: {
    provider: SttProvider
    api_key: string
    groq: SttProviderConfig
    openai: SttProviderConfig
    deepgram: SttProviderConfig
    siliconflow: SttProviderConfig
  }
  llm: {
    provider: LlmProvider
    api_key: string
    system_prompt: string
    target_lang: string
    gemini: {
      model: string
    }
    openai: OpenAiCompatibleConfig
    openrouter: OpenAiCompatibleConfig
    deepseek: OpenAiCompatibleConfig
    groq: OpenAiCompatibleConfig
    moonshot: OpenAiCompatibleConfig
    qwen: OpenAiCompatibleConfig
    siliconflow: OpenAiCompatibleConfig
    ollama: OpenAiCompatibleConfig
  }
}

export type SettingsStatusKey = 'settings.saving' | 'settings.saved' | 'settings.saveFailed'
