import { useEffect, useMemo, useState } from 'react'
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen as tauriListen } from '@tauri-apps/api/event'

// In non-Tauri environments (e.g. screenshot capture via http.server),
// Tauri IPC is unavailable. Provide safe stubs to avoid runtime errors.
const isTauri = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
const invoke: typeof tauriInvoke = isTauri ? tauriInvoke : (async () => undefined) as never
const listen: typeof tauriListen = isTauri ? tauriListen : (async () => () => {}) as never
import './App.css'
import { t, useLocale } from './i18n'
import { Sidebar } from './components/Sidebar'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import type { AppConfig, HistoryItem, Page, PipelineStatusPayload, SettingsStatusKey, TranscriptionResult } from './types/app'
import { defaultConfig, loadHistory, normalizeConfig, saveHistory } from './utils/app'

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
  const [dictionaryStatus, setDictionaryStatus] = useState<SettingsStatusKey | null>(null)
  const [showSttKey, setShowSttKey] = useState(false)
  const [showLlmKey, setShowLlmKey] = useState(false)
  const [dictionaryText, setDictionaryText] = useState('')
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
      setLastResult({ wav_base64: '', raw_text: latest.rawText, polished_text: latest.polishedText })
    }
  }, [history, lastResult])

  useEffect(() => {
    if (!isRecording) return setRecordingSeconds(0)
    const interval = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [isRecording])

  useEffect(() => {
    let mounted = true
    const fetchConfig = async () => {
      setIsLoadingConfig(true)
      try {
        const loaded = await invoke<AppConfig>('get_config')
        if (mounted) setConfig(normalizeConfig(loaded))
        const loadedDictionary = await invoke<string>('load_dictionary')
        if (mounted) setDictionaryText(loadedDictionary)
      } catch (err) {
        if (mounted) setError(`${t('error.failedLoadConfig')}: ${String(err)}`)
      } finally {
        if (mounted) setIsLoadingConfig(false)
      }
    }
    void fetchConfig()

    const unlistenRecordingPromise = listen<boolean>('recording-state-changed', (event) => {
      if (!mounted) return
      setIsRecording(event.payload)
      if (event.payload) {
        setPipelineStage('recording')
        setIsWorking(false)
      }
    })
    const unlistenPipelinePromise = listen<PipelineStatusPayload>('pipeline-status-changed', (event) => {
      if (!mounted) return
      const { stage, message } = event.payload
      setPipelineStage(stage)
      if (message) setError(message)
      if (stage === 'transcribing' || stage === 'polishing') setIsWorking(true)
      if (stage === 'done') {
        setIsWorking(false); setIsRecording(false); setDoneFlash(true)
        window.setTimeout(() => { setDoneFlash(false); setPipelineStage('idle') }, 900)
      }
      if (stage === 'error') {
        setIsWorking(false); setIsRecording(false); setMicErrorShake(true)
        window.setTimeout(() => setMicErrorShake(false), 400)
      }
    })

    return () => {
      mounted = false
      void Promise.all([unlistenRecordingPromise, unlistenPipelinePromise]).then(([u1, u2]) => { u1(); u2() })
    }
  }, [])

  const totalWords = useMemo(() => history.reduce((sum, item) => sum + item.polishedText.trim().split(/\s+/).filter(Boolean).length, 0), [history])
  const timeSavedMinutes = useMemo(() => Math.max(1, Math.round(totalWords / 40)), [totalWords])

  const startRecording = async () => {
    setError(null); setDoneFlash(false)
    try { await invoke('start_recording'); setPipelineStage('recording'); setIsRecording(true) } catch (err) {
      setPipelineStage('error'); setMicErrorShake(true); setError(String(err)); window.setTimeout(() => setMicErrorShake(false), 400)
    }
  }
  const stopRecording = async () => {
    setError(null); setSettingsStatus(null); setIsWorking(true); setPipelineStage('transcribing')
    try {
      const result = await invoke<TranscriptionResult>('stop_recording_and_transcribe')
      setLastResult(result)
      const nextItem: HistoryItem = { id: `${Date.now()}`, timestamp: new Date().toISOString(), rawText: result.raw_text, polishedText: result.polished_text }
      const nextHistory = [nextItem, ...history].slice(0, 100)
      setHistory(nextHistory); saveHistory(nextHistory); setPipelineStage('done'); setDoneFlash(true)
      window.setTimeout(() => { setDoneFlash(false); setPipelineStage('idle') }, 900)
    } catch (err) {
      setPipelineStage('error'); setMicErrorShake(true); setError(String(err)); window.setTimeout(() => setMicErrorShake(false), 400)
    } finally { setIsRecording(false); setIsWorking(false) }
  }
  const saveSettings = async () => {
    setError(null); setSettingsStatus('settings.saving')
    try { await invoke('save_config', { config }); setSettingsStatus('settings.saved') } catch (err) {
      setSettingsStatus('settings.saveFailed'); setSaveErrorShake(true); window.setTimeout(() => setSaveErrorShake(false), 400)
      setError(`${t('error.failedSaveConfig')}: ${String(err)}`)
    }
  }
  const saveDictionary = async () => {
    setError(null)
    setDictionaryStatus('settings.saving')
    try {
      await invoke('save_dictionary', { content: dictionaryText })
      setDictionaryStatus('settings.saved')
    } catch (err) {
      setDictionaryStatus('settings.saveFailed')
      setError(`${t('error.failedSaveConfig')}: ${String(err)}`)
    }
  }
  const clearHistory = () => { setHistory([]); setLastResult(null); saveHistory([]) }
  const copyHistoryText = async (id: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopySuccessId(id); window.setTimeout(() => setCopySuccessId(null), 1200) } catch { setError(t('status.error')) }
  }

  return (
    <div className="app-shell" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Sidebar page={page} locale={locale} setPage={setPage} setLocale={setLocale} />
      <main className="content-area">
        {page === 'home' && <Home locale={locale} pipelineStage={pipelineStage} recordingSeconds={recordingSeconds} doneFlash={doneFlash} micErrorShake={micErrorShake} isRecording={isRecording} isWorking={isWorking} error={error} history={history} lastResult={lastResult} totalWords={totalWords} timeSavedMinutes={timeSavedMinutes} onStartRecording={startRecording} onStopRecording={stopRecording} />}
        {page === 'history' && <History locale={locale} history={history} copySuccessId={copySuccessId} onClearHistory={clearHistory} onCopyHistoryText={copyHistoryText} />}
        {page === 'settings' && (
          <Settings
            config={config}
            setConfig={setConfig}
            isLoadingConfig={isLoadingConfig}
            showSttKey={showSttKey}
            setShowSttKey={setShowSttKey}
            showLlmKey={showLlmKey}
            setShowLlmKey={setShowLlmKey}
            settingsStatus={settingsStatus}
            saveErrorShake={saveErrorShake}
            error={error}
            onSaveSettings={saveSettings}
            dictionaryText={dictionaryText}
            setDictionaryText={setDictionaryText}
            dictionaryStatus={dictionaryStatus}
            onSaveDictionary={saveDictionary}
          />
        )}
      </main>
    </div>
  )
}

export default App
