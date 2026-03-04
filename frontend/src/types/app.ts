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
  mode: string
  rawText: string
  polishedText: string
  sttProvider: string
  llmProvider: string
  durationMs: number
}

export type BackendHistoryEntry = {
  id: number
  timestamp: string
  mode: string
  raw_text: string
  polished_text: string
  stt_provider: string
  llm_provider: string
  duration_ms: number
}

export type NewHistoryEntry = {
  timestamp: string
  mode: string
  raw_text: string
  polished_text: string
  stt_provider: string
  llm_provider: string
  duration_ms: number
}

export type SttProvider = 'groq' | 'openai' | 'openrouter' | 'deepgram' | 'siliconflow'

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

export type PromptTemplates = {
  dictation: string
  ask_anything: string
  translation: string
}

export type AppConfig = {
  stt: {
    provider: SttProvider
    api_key: string
    groq: SttProviderConfig
    openai: SttProviderConfig
    openrouter: SttProviderConfig
    deepgram: SttProviderConfig
    siliconflow: SttProviderConfig
  }
  llm: {
    provider: LlmProvider
    api_key: string
    system_prompt: string
    target_lang: string
    prompts: PromptTemplates
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
  onboarding_completed: boolean
}

export type SettingsStatusKey = 'settings.saving' | 'settings.saved' | 'settings.saveFailed'
