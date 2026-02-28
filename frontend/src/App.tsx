import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './App.css'
import { LOCALES, t, useLocale } from './i18n'

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

type AppConfig = {
  stt: {
    provider: 'groq' | 'mock'
    api_key: string
    groq: {
      model: string
      language: string | null
    }
  }
  llm: {
    provider: 'gemini' | 'openai' | 'none'
    api_key: string
    system_prompt: string
    gemini: {
      model: string
    }
    openai: {
      model: string
      base_url: string
    }
  }
}

type SettingsStatusKey = 'settings.saving' | 'settings.saved' | 'settings.saveFailed'

const HISTORY_KEY = 'vokey.history.v1'

const defaultConfig = (): AppConfig => ({
  stt: {
    provider: 'groq',
    api_key: '',
    groq: {
      model: 'whisper-large-v3-turbo',
      language: 'zh',
    },
  },
  llm: {
    provider: 'none',
    api_key: '',
    system_prompt: t('settings.defaultSystemPrompt'),
    gemini: {
      model: 'gemini-2.0-flash',
    },
    openai: {
      model: 'gpt-4o-mini',
      base_url: 'https://api.openai.com',
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
    },
    llm: {
      provider: incoming.llm?.provider ?? fallback.llm.provider,
      api_key: incoming.llm?.api_key ?? fallback.llm.api_key,
      system_prompt: incoming.llm?.system_prompt ?? fallback.llm.system_prompt,
      gemini: {
        model: incoming.llm?.gemini?.model ?? fallback.llm.gemini.model,
      },
      openai: {
        model: incoming.llm?.openai?.model ?? fallback.llm.openai.model,
        base_url: incoming.llm?.openai?.base_url ?? fallback.llm.openai.base_url,
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

const formatStage = (stage: string): string => {
  switch (stage) {
    case 'idle':
      return t('status.idle')
    case 'recording':
      return t('status.recording')
    case 'transcribing':
      return t('status.transcribing')
    case 'polishing':
      return t('status.polishing')
    case 'done':
      return t('status.done')
    case 'error':
      return t('status.error')
    default:
      return stage
  }
}

function App() {
  const { locale, setLocale } = useLocale()
  const [page, setPage] = useState<Page>('home')
  const [isRecording, setIsRecording] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [pipelineStage, setPipelineStage] = useState('idle')
  const [lastResult, setLastResult] = useState<TranscriptionResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [config, setConfig] = useState<AppConfig>(defaultConfig)
  const [isLoadingConfig, setIsLoadingConfig] = useState(true)
  const [settingsStatus, setSettingsStatus] = useState<SettingsStatusKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

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

      if (payload.stage === 'done' || payload.stage === 'error') {
        setIsWorking(false)
        setIsRecording(false)
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

  const startRecording = async () => {
    setError(null)
    try {
      await invoke('start_recording')
      setPipelineStage('recording')
      setIsRecording(true)
    } catch (err) {
      setError(String(err))
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
      setPipelineStage('done')

      const nextItem: HistoryItem = {
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        rawText: result.raw_text,
        polishedText: result.polished_text,
      }
      const nextHistory = [nextItem, ...history].slice(0, 100)
      setHistory(nextHistory)
      saveHistory(nextHistory)
    } catch (err) {
      setPipelineStage('error')
      setError(String(err))
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
      setError(`${t('error.failedSaveConfig')}: ${String(err)}`)
    }
  }

  return (
    <div className="app-layout" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OT</div>
          <div>
            <p className="brand-title">{t('app.title')}</p>
            <p className="brand-subtitle">{t('app.subtitle')}</p>
          </div>
        </div>

        <nav className="nav">
          <button type="button" className={`nav-item ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
            <span>🏠</span>
            <span>{t('nav.home')}</span>
          </button>
          <button type="button" className={`nav-item ${page === 'history' ? 'active' : ''}`} onClick={() => setPage('history')}>
            <span>🕘</span>
            <span>{t('nav.history')}</span>
          </button>
          <button
            type="button"
            className={`nav-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => setPage('settings')}
          >
            <span>⚙️</span>
            <span>{t('nav.settings')}</span>
          </button>
        </nav>
      </aside>

      <main className="content">
        {isRecording && (
          <div className="recording-overlay">
            <span className="recording-dot" />
            {t('overlay.recording')}
          </div>
        )}

        {page === 'home' && (
          <section className="page">
            <header className="hero">
              <h1>{t('home.title')}</h1>
              <p>{t('home.tagline')}</p>
            </header>

            <div className="card recorder-card">
              <button
                type="button"
                className={`record-button ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isWorking}
              >
                <span className="mic-icon">🎤</span>
              </button>
              <p className="record-hint">{isRecording ? t('home.clickToStop') : t('home.clickToStart')}</p>

              <div className="pipeline-track">
                {['idle', 'recording', 'transcribing', 'polishing', 'done'].map((stage) => (
                  <div
                    key={stage}
                    className={`pipeline-step ${pipelineStage === stage ? 'active' : ''}`}
                  >
                    {formatStage(stage)}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2">
              <article className="card stats-card">
                <h2>{t('home.stats')}</h2>
                <div className="stat-row">
                  <span>{t('home.totalDictations')}</span>
                  <strong>{history.length}</strong>
                </div>
                <div className="stat-row">
                  <span>{t('home.totalWords')}</span>
                  <strong>{totalWords}</strong>
                </div>
              </article>

              <article className="card result-card">
                <h2>{t('home.lastTranscription')}</h2>
                {!lastResult && <p className="muted">{t('home.noTranscriptionYet')}</p>}
                {lastResult && (
                  <div className="result-fields">
                    <div>
                      <p className="field-label">{t('home.raw')}</p>
                      <p>{lastResult.raw_text}</p>
                    </div>
                    <div>
                      <p className="field-label">{t('home.polished')}</p>
                      <p>{lastResult.polished_text}</p>
                    </div>
                  </div>
                )}
              </article>
            </div>
          </section>
        )}

        {page === 'history' && (
          <section className="page">
            <header className="page-header">
              <h1>{t('history.title')}</h1>
              <p>{t('history.subtitle')}</p>
            </header>

            <div className="history-list">
              {history.length === 0 && <p className="card muted">{t('history.empty')}</p>}
              {history.map((entry) => (
                <article key={entry.id} className="card history-item">
                  <p className="history-time">{new Date(entry.timestamp).toLocaleString(locale)}</p>
                  <p>
                    <span className="field-label">{t('history.rawLabel')}</span> {entry.rawText}
                  </p>
                  <p>
                    <span className="field-label">{t('history.polishedLabel')}</span> {entry.polishedText}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {page === 'settings' && (
          <section className="page">
            <header className="page-header">
              <h1>{t('settings.title')}</h1>
              <p>{t('settings.subtitle')}</p>
            </header>

            <div className="card settings-form">
              <label>
                <span>{t('settings.uiLanguage')}</span>
                <select value={locale} onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number]['code'])}>
                  {LOCALES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.nativeName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{t('settings.shortcut')}</span>
                <input value={t('settings.shortcutValue')} disabled />
              </label>

              <label>
                <span>{t('settings.primaryLanguage')}</span>
                <select
                  value={config.stt.groq.language ?? 'auto'}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      stt: {
                        ...prev.stt,
                        groq: {
                          ...prev.stt.groq,
                          language: event.target.value === 'auto' ? null : event.target.value,
                        },
                      },
                    }))
                  }
                  disabled={isLoadingConfig}
                >
                  <option value="auto">{t('settings.languageAuto')}</option>
                  <option value="en">{t('settings.languageEnglish')}</option>
                  <option value="zh">{t('settings.languageChinese')}</option>
                  <option value="ja">{t('settings.languageJapanese')}</option>
                </select>
              </label>

              <label>
                <span>{t('settings.sttProvider')}</span>
                <select
                  value={config.stt.provider}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      stt: {
                        ...prev.stt,
                        provider: event.target.value as AppConfig['stt']['provider'],
                      },
                    }))
                  }
                  disabled={isLoadingConfig}
                >
                  <option value="groq">{t('settings.sttProviderGroq')}</option>
                  <option value="mock">{t('settings.sttProviderMock')}</option>
                </select>
              </label>

              <label>
                <span>{t('settings.sttApiKey')}</span>
                <input
                  type="password"
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
                  disabled={isLoadingConfig}
                />
              </label>

              {config.stt.provider === 'groq' && (
                <label>
                  <span>{t('settings.sttModel')}</span>
                  <input
                    value={config.stt.groq.model}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        stt: {
                          ...prev.stt,
                          groq: {
                            ...prev.stt.groq,
                            model: event.target.value,
                          },
                        },
                      }))
                    }
                    disabled={isLoadingConfig}
                  />
                </label>
              )}

              <hr />

              <label>
                <span>{t('settings.llmProvider')}</span>
                <select
                  value={config.llm.provider}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      llm: {
                        ...prev.llm,
                        provider: event.target.value as AppConfig['llm']['provider'],
                      },
                    }))
                  }
                  disabled={isLoadingConfig}
                >
                  <option value="gemini">{t('settings.llmProviderGemini')}</option>
                  <option value="openai">{t('settings.llmProviderOpenAiCompatible')}</option>
                  <option value="none">{t('settings.llmProviderNone')}</option>
                </select>
              </label>

              {config.llm.provider !== 'none' && (
                <label>
                  <span>{t('settings.llmApiKey')}</span>
                  <input
                    type="password"
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
                </label>
              )}

              {config.llm.provider === 'gemini' && (
                <label>
                  <span>{t('settings.geminiModel')}</span>
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
                </label>
              )}

              {config.llm.provider === 'openai' && (
                <>
                  <label>
                    <span>{t('settings.llmModel')}</span>
                    <input
                      value={config.llm.openai.model}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          llm: {
                            ...prev.llm,
                            openai: {
                              ...prev.llm.openai,
                              model: event.target.value,
                            },
                          },
                        }))
                      }
                      disabled={isLoadingConfig}
                    />
                  </label>

                  <label>
                    <span>{t('settings.llmBaseUrl')}</span>
                    <input
                      value={config.llm.openai.base_url}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          llm: {
                            ...prev.llm,
                            openai: {
                              ...prev.llm.openai,
                              base_url: event.target.value,
                            },
                          },
                        }))
                      }
                      placeholder={t('settings.llmBaseUrlPlaceholder')}
                      disabled={isLoadingConfig}
                    />
                  </label>
                </>
              )}

              <label>
                <span>{t('settings.systemPrompt')}</span>
                <textarea
                  rows={6}
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
              </label>

              <button type="button" className="primary" onClick={saveSettings} disabled={isLoadingConfig}>
                {t('settings.save')}
              </button>
              {settingsStatus && <p className="muted">{t(settingsStatus)}</p>}
            </div>
          </section>
        )}

        {error && <p className="error-banner">{error}</p>}
      </main>
    </div>
  )
}

export default App
