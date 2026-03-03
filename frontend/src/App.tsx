import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './App.css'
import { LOCALES, type Locale, t, useLocale } from './i18n'

type Page = 'home' | 'history' | 'settings'

type TranscriptionResult = {
  wav_base64: string
  raw_text: string
  polished_text: string
}

type PipelineStatusPayload = {
  stage: string
  text?: string | null
  message?: string | null
}

type HistoryItem = {
  id: string
  timestamp: string
  rawText: string
  polishedText: string
}

type SttProvider = 'groq' | 'openai' | 'deepgram' | 'siliconflow' | 'mock'
type LlmProvider =
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

type SttProviderConfig = {
  model: string
  language: string | null
}

type OpenAiCompatibleConfig = {
  model: string
  base_url: string
}

type AppConfig = {
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

type SettingsStatusKey = 'settings.saving' | 'settings.saved' | 'settings.saveFailed'

const HISTORY_KEY = 'vokey.history.v1'
const APP_VERSION = 'v0.1.0'
const OPENAI_COMPATIBLE_LLM_PROVIDERS: LlmProvider[] = [
  'openai',
  'openrouter',
  'deepseek',
  'groq',
  'moonshot',
  'qwen',
  'siliconflow',
  'ollama',
]
const LLM_BASE_URL_PRESETS: Record<Exclude<LlmProvider, 'gemini' | 'none'>, string> = {
  openai: 'https://api.openai.com',
  openrouter: 'https://openrouter.ai/api/v1',
  deepseek: 'https://api.deepseek.com',
  groq: 'https://api.groq.com/openai',
  moonshot: 'https://api.moonshot.cn',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  siliconflow: 'https://api.siliconflow.cn',
  ollama: 'http://localhost:11434',
}

const defaultConfig = (): AppConfig => ({
  stt: {
    provider: 'groq',
    api_key: '',
    groq: {
      model: 'whisper-large-v3-turbo',
      language: 'zh',
    },
    openai: {
      model: 'whisper-1',
      language: null,
    },
    deepgram: {
      model: 'nova-3',
      language: 'en',
    },
    siliconflow: {
      model: 'FunAudioLLM/SenseVoiceSmall',
      language: 'zh',
    },
  },
  llm: {
    provider: 'none',
    api_key: '',
    system_prompt: t('settings.defaultSystemPrompt'),
    target_lang: 'English',
    gemini: {
      model: 'gemini-2.0-flash',
    },
    openai: {
      model: 'gpt-4o-mini',
      base_url: 'https://api.openai.com',
    },
    openrouter: {
      model: 'openai/gpt-4o-mini',
      base_url: 'https://openrouter.ai/api/v1',
    },
    deepseek: {
      model: 'deepseek-chat',
      base_url: 'https://api.deepseek.com',
    },
    groq: {
      model: 'llama-3.3-70b-versatile',
      base_url: 'https://api.groq.com/openai',
    },
    moonshot: {
      model: 'moonshot-v1-8k',
      base_url: 'https://api.moonshot.cn',
    },
    qwen: {
      model: 'qwen-plus',
      base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
    siliconflow: {
      model: 'Qwen/Qwen2.5-7B-Instruct',
      base_url: 'https://api.siliconflow.cn',
    },
    ollama: {
      model: 'qwen2.5:7b',
      base_url: 'http://localhost:11434',
    },
  },
})

const normalizeConfig = (incoming: Partial<AppConfig> | null | undefined): AppConfig => {
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
      gemini: {
        model: incoming.llm?.gemini?.model ?? fallback.llm.gemini.model,
      },
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

const loadHistory = (): HistoryItem[] => {
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

const saveHistory = (items: HistoryItem[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items))
}

const getLocaleFlag = (code: Locale): string => {
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

const formatRelativeTime = (timestamp: string, locale: Locale): string => {
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

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

const getActiveSttConfig = (config: AppConfig): SttProviderConfig => {
  switch (config.stt.provider) {
    case 'openai':
      return config.stt.openai
    case 'deepgram':
      return config.stt.deepgram
    case 'siliconflow':
      return config.stt.siliconflow
    case 'groq':
    case 'mock':
    default:
      return config.stt.groq
  }
}

const setActiveSttConfig = (config: AppConfig, next: SttProviderConfig): AppConfig => {
  switch (config.stt.provider) {
    case 'openai':
      return { ...config, stt: { ...config.stt, openai: next } }
    case 'deepgram':
      return { ...config, stt: { ...config.stt, deepgram: next } }
    case 'siliconflow':
      return { ...config, stt: { ...config.stt, siliconflow: next } }
    case 'groq':
    case 'mock':
    default:
      return { ...config, stt: { ...config.stt, groq: next } }
  }
}

const getActiveLlmPreset = (config: AppConfig): OpenAiCompatibleConfig => {
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

const setActiveLlmPreset = (config: AppConfig, next: OpenAiCompatibleConfig): AppConfig => {
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

function App() {
  const { locale, setLocale } = useLocale()
  const [page, setPage] = useState<Page>('home')

  const [isRecording, setIsRecording] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [pipelineStage, setPipelineStage] = useState('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())

  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatusKey | null>(null)

  const [showSttKey, setShowSttKey] = useState(false)
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [copySuccessId, setCopySuccessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [doneFlash, setDoneFlash] = useState(false)
  const [micErrorShake, setMicErrorShake] = useState(false)
  const [saveErrorShake, setSaveErrorShake] = useState(false)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  useEffect(() => {
    if (history.length > 0 && !lastResult) {
      const latest = history[0]
      setLastResult({
        wav_base64: '',
        raw_text: latest.rawText,
        polished_text: latest.polishedText,
      })
    }
  }, [history, lastResult])

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0)
      return
    }

    const interval = window.setInterval(() => {
      setRecordingSeconds((value) => value + 1)
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [isRecording])

  useEffect(() => {
    let mounted = true

    const fetchConfig = async () => {
      setIsLoadingConfig(true)
      try {
        const loaded = await invoke<AppConfig>('get_config')
        if (mounted) {
          setConfig(normalizeConfig(loaded))
        }
      } catch (err) {
        if (mounted) {
          setError(`${t('error.failedLoadConfig')}: ${String(err)}`)
        }
      } finally {
        if (mounted) {
          setIsLoadingConfig(false)
        }
      }
    }

    void fetchConfig()

    const unlistenRecordingPromise = listen<boolean>('recording-state-changed', (event) => {
      if (!mounted) {
        return
      }

      setIsRecording(event.payload)
      if (event.payload) {
        setPipelineStage('recording')
        setIsWorking(false)
      }
    })

    const unlistenPipelinePromise = listen<PipelineStatusPayload>('pipeline-status-changed', (event) => {
      if (!mounted) {
        return
      }

      const payload = event.payload
      setPipelineStage(payload.stage)

      if (payload.message) {
        setError(payload.message)
      }

      if (payload.stage === 'transcribing' || payload.stage === 'polishing') {
        setIsWorking(true)
      }

      if (payload.stage === 'done') {
        setIsWorking(false)
        setIsRecording(false)
        setDoneFlash(true)
        window.setTimeout(() => {
          setDoneFlash(false)
          setPipelineStage('idle')
        }, 900)
      }

      if (payload.stage === 'error') {
        setIsWorking(false)
        setIsRecording(false)
        setMicErrorShake(true)
        window.setTimeout(() => setMicErrorShake(false), 400)
      }
    })

    return () => {
      mounted = false
      void Promise.all([unlistenRecordingPromise, unlistenPipelinePromise]).then(
        ([unlistenRecording, unlistenPipeline]) => {
          unlistenRecording()
          unlistenPipeline()
        },
      )
    }
  }, [])

  const totalWords = useMemo(() => {
    return history.reduce((sum, item) => {
      const words = item.polishedText.trim().split(/\s+/).filter(Boolean)
      return sum + words.length
    }, 0)
  }, [history])

  const timeSavedMinutes = useMemo(() => {
    return Math.max(1, Math.round(totalWords / 40))
  }, [totalWords])

  const startRecording = async () => {
    setError(null)
    setDoneFlash(false)
    try {
      await invoke('start_recording')
      setPipelineStage('recording')
      setIsRecording(true)
    } catch (err) {
      setPipelineStage('error')
      setMicErrorShake(true)
      setError(String(err))
      window.setTimeout(() => setMicErrorShake(false), 400)
    }
  }

  const stopRecording = async () => {
    setError(null)
    setSettingsStatus(null)
    setIsWorking(true)
    setPipelineStage('transcribing')

    try {
      const result = await invoke<TranscriptionResult>('stop_recording_and_transcribe')
      setLastResult(result)

      const nextItem: HistoryItem = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        rawText: result.raw_text,
        polishedText: result.polished_text,
      }

      const nextHistory = [nextItem, ...history].slice(0, 100)
      setHistory(nextHistory)
      saveHistory(nextHistory)

      setPipelineStage('done')
      setDoneFlash(true)
      window.setTimeout(() => {
        setDoneFlash(false)
        setPipelineStage('idle')
      }, 900)
    } catch (err) {
      setPipelineStage('error')
      setMicErrorShake(true)
      setError(String(err))
      window.setTimeout(() => setMicErrorShake(false), 400)
    } finally {
      setIsRecording(false)
      setIsWorking(false)
    }
  }

  const saveSettings = async () => {
    setError(null)
    setSettingsStatus('settings.saving')

    try {
      await invoke('save_config', { config })
      setSettingsStatus('settings.saved')
    } catch (err) {
      setSettingsStatus('settings.saveFailed')
      setSaveErrorShake(true)
      window.setTimeout(() => setSaveErrorShake(false), 400)
      setError(`${t('error.failedSaveConfig')}: ${String(err)}`)
    }
  }

  const clearHistory = () => {
    setHistory([])
    setLastResult(null)
    saveHistory([])
  }

  const copyHistoryText = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopySuccessId(id)
      window.setTimeout(() => setCopySuccessId(null), 1200)
    } catch {
      setError(t('status.error'))
    }
  }

  const heroTitle = (() => {
    if (pipelineStage === 'recording') {
      return 'Recording...'
    }
    if (pipelineStage === 'transcribing') {
      return 'Transcribing...'
    }
    if (pipelineStage === 'polishing') {
      return 'Polishing...'
    }
    return t('home.readyToDictate')
  })()

  const heroSubtext = pipelineStage === 'recording' ? formatDuration(recordingSeconds) : t('home.pressHotkey')

  const selectedLocale = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0]
  const activeSttConfig = getActiveSttConfig(config)
  const activeLlmPreset = getActiveLlmPreset(config)
  const isOpenAiCompatibleProvider = OPENAI_COMPATIBLE_LLM_PROVIDERS.includes(config.llm.provider)

  const selectLlmProvider = (provider: LlmProvider) => {
    setConfig((prev) => {
      const next = {
        ...prev,
        llm: {
          ...prev.llm,
          provider,
        },
      }

      if (provider === 'gemini' || provider === 'none') {
        return next
      }

      const preset = LLM_BASE_URL_PRESETS[provider]
      const currentPreset = getActiveLlmPreset(next)
      if (!currentPreset.base_url.trim()) {
        return setActiveLlmPreset(next, {
          ...currentPreset,
          base_url: preset,
        })
      }

      return next
    })
  }

  return (
    <div className="app-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <p className="brand-title">{t('app.title')}</p>
            <p className="brand-subtitle">{t('app.subtitle')}</p>
          </div>
        </div>

        <nav className="nav-list">
          <button type="button" className={`nav-item ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
            <span className="nav-icon" aria-hidden="true">
              🏠
            </span>
            <span>{t('nav.home')}</span>
          </button>
          <button type="button" className={`nav-item ${page === 'history' ? 'active' : ''}`} onClick={() => setPage('history')}>
            <span className="nav-icon" aria-hidden="true">
              📋
            </span>
            <span>{t('nav.history')}</span>
          </button>
          <button type="button" className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
            <span className="nav-icon" aria-hidden="true">
              ⚙️
            </span>
            <span>{t('nav.settings')}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <label className="locale-select-wrap">
            <span className="caption">{t('settings.uiLanguage')}</span>
            <div className="locale-select-row">
              <span className="locale-flag" aria-hidden="true">
                {getLocaleFlag(selectedLocale.code)}
              </span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="locale-select"
                aria-label={t('settings.uiLanguage')}
              >
                {LOCALES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.nativeName}
                  </option>
                ))}
              </select>
            </div>
          </label>
          <p className="version">{APP_VERSION}</p>
        </div>
      </aside>

      <main className="content-area">
        {page === 'home' && (
          <section className="page page-enter">
            <article className="card hero-card">
              <div className="hero-copy">
                <h1>{heroTitle}</h1>
                <p>{heroSubtext}</p>
              </div>

              <div className="mic-block">
                <button
                  type="button"
                  className={`mic-button ${pipelineStage} ${doneFlash ? 'done' : ''} ${micErrorShake ? 'shake' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isWorking && !isRecording}
                  aria-label={isRecording ? t('home.clickToStop') : t('home.clickToStart')}
                >
                  {pipelineStage === 'transcribing' || pipelineStage === 'polishing' ? (
                    <span className="loader-ring" aria-hidden="true" />
                  ) : doneFlash ? (
                    <span className="done-mark" aria-hidden="true">
                      ✓
                    </span>
                  ) : (
                    <span className="mic-glyph" aria-hidden="true">
                      🎤
                    </span>
                  )}
                  {pipelineStage === 'recording' && (
                    <>
                      <span className="pulse-ring" aria-hidden="true" />
                      <span className="pulse-ring second" aria-hidden="true" />
                    </>
                  )}
                </button>

                <p className="status-note">
                  {pipelineStage === 'recording' && `${t('status.recording')} ${formatDuration(recordingSeconds)}`}
                  {pipelineStage === 'transcribing' && `${t('status.transcribing')}...`}
                  {pipelineStage === 'polishing' && `${t('status.polishing')}...`}
                  {pipelineStage === 'idle' && t('home.readyToDictate')}
                  {pipelineStage === 'done' && `${t('status.done')}!`}
                  {pipelineStage === 'error' && `${t('status.error')}`}
                </p>
                {error && <p className="inline-error">{error}</p>}
              </div>
            </article>

            <div className="stats-grid">
              <article className="card stat-card">
                <p className="stat-icon" aria-hidden="true">
                  📝
                </p>
                <p className="stat-value">{history.length}</p>
                <p className="stat-label">{t('home.totalDictations').toLowerCase()}</p>
              </article>
              <article className="card stat-card">
                <p className="stat-icon" aria-hidden="true">
                  💬
                </p>
                <p className="stat-value">{totalWords}</p>
                <p className="stat-label">{t('home.totalWords').toLowerCase()}</p>
              </article>
              <article className="card stat-card">
                <p className="stat-icon" aria-hidden="true">
                  ⏱️
                </p>
                <p className="stat-value">{timeSavedMinutes}m</p>
                <p className="stat-label">{t('home.timeSaved').toLowerCase()}</p>
              </article>
            </div>

            <article className="card latest-card">
              <div className="latest-header">
                <h2>{t('home.latest')}</h2>
                <p>{history[0] ? formatRelativeTime(history[0].timestamp, locale) : '--'}</p>
              </div>

              {!lastResult && (
                <div className="empty-state">
                  <p className="empty-emoji" aria-hidden="true">
                    ✨
                  </p>
                  <p>{t('home.emptyState')}</p>
                </div>
              )}

              {lastResult && (
                <div className="latest-content">
                  <div className="latest-panel original">
                    <p className="panel-title">{t('home.original')}</p>
                    <p>{lastResult.raw_text}</p>
                  </div>
                  <div className="latest-panel polished">
                    <p className="panel-title">{t('home.polished')}</p>
                    <p>{lastResult.polished_text}</p>
                  </div>
                </div>
              )}
            </article>
          </section>
        )}

        {page === 'history' && (
          <section className="page page-enter">
            <header className="page-header split">
              <div>
                <h1>{t('history.title')}</h1>
                <p>{t('history.subtitle')}</p>
              </div>
              <button type="button" className="danger-text" onClick={clearHistory} disabled={history.length === 0}>
                {t('history.clearAll')}
              </button>
            </header>

            {history.length === 0 && (
              <div className="card empty-state history-empty">
                <p className="empty-emoji" aria-hidden="true">
                  🗂️
                </p>
                <p>{t('history.empty')}</p>
              </div>
            )}

            {history.length > 0 && (
              <div className="history-list">
                {history.map((entry) => (
                  <article key={entry.id} className="card history-item">
                    <div className="history-head">
                      <p className="history-time">{formatRelativeTime(entry.timestamp, locale)}</p>
                      <button
                        type="button"
                        className="text-button copy-btn"
                        onClick={() => copyHistoryText(entry.id, entry.polishedText)}
                      >
                        {copySuccessId === entry.id ? t('history.copySuccess') : '⧉'}
                      </button>
                    </div>
                    <p className="history-raw">{entry.rawText}</p>
                    <p className="history-polished">{entry.polishedText}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {page === 'settings' && (
          <section className="page page-enter">
            <header className="page-header">
              <h1>{t('settings.title')}</h1>
              <p>{t('settings.subtitle')}</p>
            </header>

            <div className="settings-grid">
              <article className="card section-card">
                <h2>{t('settings.general')}</h2>
                <div className="field-row">
                  <label>{t('settings.shortcut')}</label>
                  <span className="badge">{t('settings.shortcutValue')}</span>
                </div>
              </article>

              <article className="card section-card">
                <h2>{t('settings.stt')}</h2>
                <div className="field-stack">
                  <div className="field-group">
                    <label>{t('settings.sttProvider')}</label>
                    <p className="caption">{t('settings.sttProviderDescription')}</p>
                    <div className="segmented" role="group" aria-label={t('settings.sttProvider')}>
                      <button
                        type="button"
                        className={config.stt.provider === 'groq' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: 'groq' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.sttProviderGroq')}
                      </button>
                      <button
                        type="button"
                        className={config.stt.provider === 'openai' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: 'openai' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.sttProviderOpenAi')}
                      </button>
                      <button
                        type="button"
                        className={config.stt.provider === 'deepgram' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: 'deepgram' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.sttProviderDeepgram')}
                      </button>
                      <button
                        type="button"
                        className={config.stt.provider === 'siliconflow' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: 'siliconflow' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.sttProviderSiliconFlow')}
                      </button>
                      <button
                        type="button"
                        className={config.stt.provider === 'mock' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: 'mock' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.sttProviderMock')}
                      </button>
                    </div>
                  </div>

                  <div className="field-group">
                    <label>{t('settings.sttApiKey')}</label>
                    <div className="input-with-action">
                      <input
                        type={showSttKey ? 'text' : 'password'}
                        value={config.stt.api_key}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            stt: {
                              ...prev.stt,
                              api_key: event.target.value,
                            },
                          }))
                        }
                        placeholder={t('settings.sttApiKeyPlaceholder')}
                        disabled={isLoadingConfig || config.stt.provider === 'mock'}
                      />
                      <button type="button" className="text-button" onClick={() => setShowSttKey((value) => !value)}>
                        {showSttKey ? t('settings.hideKey') : t('settings.showKey')}
                      </button>
                    </div>
                  </div>

                  <div className="field-group">
                    <label>{t('settings.sttModel')}</label>
                    <input
                      value={activeSttConfig.model}
                      onChange={(event) =>
                        setConfig((prev) => setActiveSttConfig(prev, { ...getActiveSttConfig(prev), model: event.target.value }))
                      }
                      disabled={isLoadingConfig || config.stt.provider === 'mock'}
                    />
                  </div>

                  <div className="field-group">
                    <label>{t('settings.primaryLanguage')}</label>
                    <select
                      value={activeSttConfig.language ?? 'auto'}
                      onChange={(event) =>
                        setConfig((prev) =>
                          setActiveSttConfig(prev, {
                            ...getActiveSttConfig(prev),
                            language: event.target.value === 'auto' ? null : event.target.value,
                          }),
                        )
                      }
                      disabled={isLoadingConfig || config.stt.provider === 'mock'}
                    >
                      <option value="auto">{t('settings.languageAuto')}</option>
                      <option value="zh">{t('settings.languageChinese')}</option>
                      <option value="en">{t('settings.languageEnglish')}</option>
                      <option value="ja">{t('settings.languageJapanese')}</option>
                    </select>
                  </div>
                </div>
              </article>

              <article className="card section-card">
                <h2>{t('settings.aiPolish')}</h2>
                <div className="field-stack">
                  <div className="field-group">
                    <label>{t('settings.llmProvider')}</label>
                    <p className="caption">{t('settings.llmProviderDescription')}</p>
                    <div className="segmented" role="group" aria-label={t('settings.llmProvider')}>
                      <button
                        type="button"
                        className={config.llm.provider === 'gemini' ? 'active' : ''}
                        onClick={() => selectLlmProvider('gemini')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderGemini')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'openai' ? 'active' : ''}
                        onClick={() => selectLlmProvider('openai')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderOpenAi')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'openrouter' ? 'active' : ''}
                        onClick={() => selectLlmProvider('openrouter')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderOpenRouter')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'deepseek' ? 'active' : ''}
                        onClick={() => selectLlmProvider('deepseek')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderDeepSeek')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'groq' ? 'active' : ''}
                        onClick={() => selectLlmProvider('groq')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderGroq')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'moonshot' ? 'active' : ''}
                        onClick={() => selectLlmProvider('moonshot')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderMoonshot')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'qwen' ? 'active' : ''}
                        onClick={() => selectLlmProvider('qwen')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderQwen')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'siliconflow' ? 'active' : ''}
                        onClick={() => selectLlmProvider('siliconflow')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderSiliconFlow')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'ollama' ? 'active' : ''}
                        onClick={() => selectLlmProvider('ollama')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderOllama')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'none' ? 'active' : ''}
                        onClick={() => selectLlmProvider('none')}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderNone')}
                      </button>
                    </div>
                  </div>

                  {config.llm.provider !== 'none' && (
                    <div className="field-group">
                      <label>{t('settings.llmApiKey')}</label>
                      <div className="input-with-action">
                        <input
                          type={showLlmKey ? 'text' : 'password'}
                          value={config.llm.api_key}
                          onChange={(event) =>
                            setConfig((prev) => ({
                              ...prev,
                              llm: {
                                ...prev.llm,
                                api_key: event.target.value,
                              },
                            }))
                          }
                          placeholder={t('settings.llmApiKeyPlaceholder')}
                          disabled={isLoadingConfig}
                        />
                        <button type="button" className="text-button" onClick={() => setShowLlmKey((value) => !value)}>
                          {showLlmKey ? t('settings.hideKey') : t('settings.showKey')}
                        </button>
                      </div>
                    </div>
                  )}

                  {config.llm.provider === 'gemini' && (
                    <div className="field-group">
                      <label>{t('settings.geminiModel')}</label>
                      <input
                        value={config.llm.gemini.model}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            llm: {
                              ...prev.llm,
                              gemini: {
                                ...prev.llm.gemini,
                                model: event.target.value,
                              },
                            },
                          }))
                        }
                        disabled={isLoadingConfig}
                      />
                    </div>
                  )}

                  {isOpenAiCompatibleProvider && (
                    <>
                      <div className="field-group">
                        <label>{t('settings.llmModel')}</label>
                        <input
                          value={activeLlmPreset.model}
                          onChange={(event) =>
                            setConfig((prev) =>
                              setActiveLlmPreset(prev, { ...getActiveLlmPreset(prev), model: event.target.value }),
                            )
                          }
                          disabled={isLoadingConfig}
                        />
                      </div>

                      <div className="field-group">
                        <label>{t('settings.llmBaseUrl')}</label>
                        <input
                          value={activeLlmPreset.base_url}
                          onChange={(event) =>
                            setConfig((prev) =>
                              setActiveLlmPreset(prev, { ...getActiveLlmPreset(prev), base_url: event.target.value }),
                            )
                          }
                          placeholder={t('settings.llmBaseUrlPlaceholder')}
                          disabled={isLoadingConfig}
                        />
                      </div>
                    </>
                  )}

                  <div className="field-group">
                    <label>{t('settings.systemPrompt')}</label>
                    <textarea
                      rows={5}
                      value={config.llm.system_prompt}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          llm: {
                            ...prev.llm,
                            system_prompt: event.target.value,
                          },
                        }))
                      }
                      disabled={isLoadingConfig}
                    />
                    <p className="caption">{config.llm.system_prompt.length} chars</p>
                  </div>
                </div>
              </article>

              <article className="card section-card">
                <h2>{t('settings.about')}</h2>
                <div className="about-list">
                  <p>
                    <span>{t('settings.version')}</span>
                    <strong>{APP_VERSION}</strong>
                  </p>
                  <p>
                    <span>{t('settings.github')}</span>
                    <a href="https://github.com/liaohch3/vokey" target="_blank" rel="noreferrer">
                      github.com/liaohch3/vokey
                    </a>
                  </p>
                  <p>
                    <span>{t('settings.license')}</span>
                    <strong>MIT</strong>
                  </p>
                </div>
              </article>

              <button
                type="button"
                className={`primary-save ${settingsStatus === 'settings.saved' ? 'saved' : ''} ${
                  saveErrorShake ? 'shake' : ''
                }`}
                onClick={saveSettings}
                disabled={isLoadingConfig}
              >
                <span>{t('settings.save')}</span>
                {settingsStatus === 'settings.saved' && <span className="save-check">✓</span>}
              </button>
            </div>

            {settingsStatus && <p className="settings-feedback">{t(settingsStatus)}</p>}
            {error && <p className="inline-error">{error}</p>}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
