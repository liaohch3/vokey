import { t, type Locale } from '../i18n'
import type {
  AppConfig,
  BackendHistoryEntry,
  HistoryItem,
  LlmProvider,
  OpenAiCompatibleConfig,
  SttProviderConfig,
} from '../types/app'

export const HISTORY_KEY = 'vokey.history.v1'
export const APP_VERSION = 'v0.1.0'

export const OPENAI_COMPATIBLE_LLM_PROVIDERS: LlmProvider[] = [
  'openai',
  'openrouter',
  'deepseek',
  'groq',
  'moonshot',
  'qwen',
  'siliconflow',
  'ollama',
]

export const LLM_BASE_URL_PRESETS: Record<Exclude<LlmProvider, 'gemini' | 'none'>, string> = {
  openai: 'https://api.openai.com',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com',
  groq: 'https://api.groq.com/openai',
  moonshot: 'https://api.moonshot.cn',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  siliconflow: 'https://api.siliconflow.cn',
  ollama: 'http://localhost:11434',
}

export const defaultConfig = (): AppConfig => ({
  stt: {
    provider: 'groq',
    api_key: '',
    groq: { model: 'whisper-large-v3-turbo', language: 'zh' },
    openai: { model: 'whisper-1', language: null },
    openrouter: { model: 'openai/whisper-large-v3', language: null },
    deepgram: { model: 'nova-3', language: 'en' },
    siliconflow: { model: 'FunAudioLLM/SenseVoiceSmall', language: 'zh' },
  },
  llm: {
    provider: 'none',
    api_key: '',
    system_prompt: t('settings.defaultSystemPrompt'),
    target_lang: 'English',
    prompts: {
      dictation:
        "You are a dictation cleanup assistant.\n\nRules (in priority order):\n1. PUNCTUATION - Add punctuation at speech pauses\n2. CLEANUP - Remove filler words, false starts, repetitions\n3. LISTS - Detect enumeration signals, format as numbered lists\n4. PARAGRAPHS - Separate distinct topics with blank lines\n5. PRESERVE - Keep original language, technical terms, proper nouns\n6. OUTPUT - Return only the cleaned text, no explanation\n\n{dictionary_injection}",
      ask_anything:
        "You are a helpful assistant. Answer the user's question concisely.\nIf the user references selected text, apply their instruction to that text.\nOutput only the result, no explanation or preamble.\n\n{dictionary_injection}",
      translation:
        'Translate the following text to {target_language}.\nPreserve the original meaning, tone, and formatting.\nOutput only the translation, no explanation.\n\n{dictionary_injection}',
    },
    gemini: { model: 'gemini-2.0-flash' },
    openai: { model: 'gpt-4o-mini', base_url: 'https://api.openai.com' },
    openrouter: { model: 'openai/gpt-4o-mini', base_url: 'https://openrouter.ai/api/v1' },
    deepseek: { model: 'deepseek-chat', base_url: 'https://api.deepseek.com' },
    groq: { model: 'llama-3.3-70b-versatile', base_url: 'https://api.groq.com/openai' },
    moonshot: { model: 'moonshot-v1-8k', base_url: 'https://api.moonshot.cn' },
    qwen: { model: 'qwen-plus', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    siliconflow: { model: 'Qwen/Qwen2.5-7B-Instruct', base_url: 'https://api.siliconflow.cn' },
    ollama: { model: 'qwen2.5:7b', base_url: 'http://localhost:11434' },
  },
})

export const normalizeConfig = (incoming: Partial<AppConfig> | null | undefined): AppConfig => {
  const fallback = defaultConfig()
  if (!incoming) {
    return fallback
  }

  return {
    stt: {
      provider: incoming.stt?.provider ?? fallback.stt.provider,
      api_key: incoming.stt?.api_key ?? fallback.stt.api_key,
      groq: {
        model: incoming.stt?.groq?.model ?? fallback.stt.groq.model,
        language: incoming.stt?.groq?.language ?? fallback.stt.groq.language,
      },
      openai: {
        model: incoming.stt?.openai?.model ?? fallback.stt.openai.model,
        language: incoming.stt?.openai?.language ?? fallback.stt.openai.language,
      },
      openrouter: {
        model: incoming.stt?.openrouter?.model ?? fallback.stt.openrouter.model,
        language: incoming.stt?.openrouter?.language ?? fallback.stt.openrouter.language,
      },
      deepgram: {
        model: incoming.stt?.deepgram?.model ?? fallback.stt.deepgram.model,
        language: incoming.stt?.deepgram?.language ?? fallback.stt.deepgram.language,
      },
      siliconflow: {
        model: incoming.stt?.siliconflow?.model ?? fallback.stt.siliconflow.model,
        language: incoming.stt?.siliconflow?.language ?? fallback.stt.siliconflow.language,
      },
    },
    llm: {
      provider: incoming.llm?.provider ?? fallback.llm.provider,
      api_key: incoming.llm?.api_key ?? fallback.llm.api_key,
      system_prompt: incoming.llm?.system_prompt ?? fallback.llm.system_prompt,
      target_lang: incoming.llm?.target_lang ?? fallback.llm.target_lang,
      prompts: {
        dictation: incoming.llm?.prompts?.dictation ?? fallback.llm.prompts.dictation,
        ask_anything: incoming.llm?.prompts?.ask_anything ?? fallback.llm.prompts.ask_anything,
        translation: incoming.llm?.prompts?.translation ?? fallback.llm.prompts.translation,
      },
      gemini: { model: incoming.llm?.gemini?.model ?? fallback.llm.gemini.model },
      openai: {
        model: incoming.llm?.openai?.model ?? fallback.llm.openai.model,
        base_url: incoming.llm?.openai?.base_url ?? fallback.llm.openai.base_url,
      },
      openrouter: {
        model: incoming.llm?.openrouter?.model ?? fallback.llm.openrouter.model,
        base_url: incoming.llm?.openrouter?.base_url ?? fallback.llm.openrouter.base_url,
      },
      deepseek: {
        model: incoming.llm?.deepseek?.model ?? fallback.llm.deepseek.model,
        base_url: incoming.llm?.deepseek?.base_url ?? fallback.llm.deepseek.base_url,
      },
      groq: {
        model: incoming.llm?.groq?.model ?? fallback.llm.groq.model,
        base_url: incoming.llm?.groq?.base_url ?? fallback.llm.groq.base_url,
      },
      moonshot: {
        model: incoming.llm?.moonshot?.model ?? fallback.llm.moonshot.model,
        base_url: incoming.llm?.moonshot?.base_url ?? fallback.llm.moonshot.base_url,
      },
      qwen: {
        model: incoming.llm?.qwen?.model ?? fallback.llm.qwen.model,
        base_url: incoming.llm?.qwen?.base_url ?? fallback.llm.qwen.base_url,
      },
      siliconflow: {
        model: incoming.llm?.siliconflow?.model ?? fallback.llm.siliconflow.model,
        base_url: incoming.llm?.siliconflow?.base_url ?? fallback.llm.siliconflow.base_url,
      },
      ollama: {
        model: incoming.llm?.ollama?.model ?? fallback.llm.ollama.model,
        base_url: incoming.llm?.ollama?.base_url ?? fallback.llm.ollama.base_url,
      },
    },
  }
}

export const loadLegacyHistory = (): HistoryItem[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as HistoryItem[]
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
  } catch {
    return []
  }
}

export const saveHistory = (items: HistoryItem[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

export const clearLegacyHistory = () => {
  localStorage.removeItem(HISTORY_KEY)
}

export const fromBackendHistory = (entry: BackendHistoryEntry): HistoryItem => ({
  id: String(entry.id),
  timestamp: entry.timestamp,
  mode: entry.mode,
  rawText: entry.raw_text,
  polishedText: entry.polished_text,
  sttProvider: entry.stt_provider,
  llmProvider: entry.llm_provider,
  durationMs: entry.duration_ms,
})

export const getLocaleFlag = (code: Locale): string => {
  switch (code) {
    case 'en':
      return '🇺🇸'
    case 'zh-CN':
      return '🇨🇳'
    case 'zh-TW':
      return '🇹🇼'
    case 'ja':
      return '🇯🇵'
    case 'ko':
      return '🇰🇷'
    case 'fr':
      return '🇫🇷'
    case 'de':
      return '🇩🇪'
    case 'ar':
      return '🇸🇦'
    case 'ru':
      return '🇷🇺'
    case 'pt':
      return '🇵🇹'
    case 'es':
      return '🇪🇸'
    default:
      return '🌐'
  }
}

export const formatRelativeTime = (timestamp: string, locale: Locale): string => {
  const target = new Date(timestamp)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  const absMinutes = Math.abs(Math.round(diffMs / 60000))

  if (absMinutes < 60) {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    return rtf.format(Math.round(diffMs / 60000), 'minute')
  }

  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()

  if (sameDay) {
    return `Today ${target.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}`
  }

  return target.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

export const getActiveSttConfig = (config: AppConfig): SttProviderConfig => {
  switch (config.stt.provider) {
    case 'openai':
      return config.stt.openai
    case 'openrouter':
      return config.stt.openrouter
    case 'deepgram':
      return config.stt.deepgram
    case 'siliconflow':
      return config.stt.siliconflow
    case 'groq':
    default:
      return config.stt.groq
  }
}

export const setActiveSttConfig = (config: AppConfig, next: SttProviderConfig): AppConfig => {
  switch (config.stt.provider) {
    case 'openai':
      return { ...config, stt: { ...config.stt, openai: next } }
    case 'openrouter':
      return { ...config, stt: { ...config.stt, openrouter: next } }
    case 'deepgram':
      return { ...config, stt: { ...config.stt, deepgram: next } }
    case 'siliconflow':
      return { ...config, stt: { ...config.stt, siliconflow: next } }
    case 'groq':
    default:
      return { ...config, stt: { ...config.stt, groq: next } }
  }
}

export const getActiveLlmPreset = (config: AppConfig): OpenAiCompatibleConfig => {
  switch (config.llm.provider) {
    case 'openrouter':
      return config.llm.openrouter
    case 'deepseek':
      return config.llm.deepseek
    case 'groq':
      return config.llm.groq
    case 'moonshot':
      return config.llm.moonshot
    case 'qwen':
      return config.llm.qwen
    case 'siliconflow':
      return config.llm.siliconflow
    case 'ollama':
      return config.llm.ollama
    case 'openai':
    default:
      return config.llm.openai
  }
}

export const setActiveLlmPreset = (config: AppConfig, next: OpenAiCompatibleConfig): AppConfig => {
  switch (config.llm.provider) {
    case 'openrouter':
      return { ...config, llm: { ...config.llm, openrouter: next } }
    case 'deepseek':
      return { ...config, llm: { ...config.llm, deepseek: next } }
    case 'groq':
      return { ...config, llm: { ...config.llm, groq: next } }
    case 'moonshot':
      return { ...config, llm: { ...config.llm, moonshot: next } }
    case 'qwen':
      return { ...config, llm: { ...config.llm, qwen: next } }
    case 'siliconflow':
      return { ...config, llm: { ...config.llm, siliconflow: next } }
    case 'ollama':
      return { ...config, llm: { ...config.llm, ollama: next } }
    case 'openai':
    default:
      return { ...config, llm: { ...config.llm, openai: next } }
  }
}
