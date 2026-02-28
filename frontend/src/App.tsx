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
const APP_VERSION = 'v0.1.0'

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
                        disabled={isLoadingConfig}
                      />
                      <button type="button" className="text-button" onClick={() => setShowSttKey((value) => !value)}>
                        {showSttKey ? t('settings.hideKey') : t('settings.showKey')}
                      </button>
                    </div>
                  </div>

                  <div className="field-group">
                    <label>{t('settings.sttModel')}</label>
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
                  </div>

                  <div className="field-group">
                    <label>{t('settings.primaryLanguage')}</label>
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
                    <div className="segmented" role="group" aria-label={t('settings.llmProvider')}>
                      <button
                        type="button"
                        className={config.llm.provider === 'gemini' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, llm: { ...prev.llm, provider: 'gemini' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderGemini')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'openai' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, llm: { ...prev.llm, provider: 'openai' } }))}
                        disabled={isLoadingConfig}
                      >
                        {t('settings.llmProviderOpenAiCompatible')}
                      </button>
                      <button
                        type="button"
                        className={config.llm.provider === 'none' ? 'active' : ''}
                        onClick={() => setConfig((prev) => ({ ...prev, llm: { ...prev.llm, provider: 'none' } }))}
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

                  {config.llm.provider === 'openai' && (
                    <>
                      <div className="field-group">
                        <label>{t('settings.llmModel')}</label>
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
                      </div>

                      <div className="field-group">
                        <label>{t('settings.llmBaseUrl')}</label>
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
