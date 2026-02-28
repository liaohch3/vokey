import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './App.css'

type TranscriptionResult = {
  wav_base64: string
  text: string
}

type PipelineStatusPayload = {
  stage: string
  text?: string | null
  message?: string | null
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [lastAudioBytes, setLastAudioBytes] = useState<number | null>(null)
  const [transcribedText, setTranscribedText] = useState<string | null>(null)
  const [pipelineStatus, setPipelineStatus] = useState('Idle')
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const unlistenRecordingPromise = listen<boolean>('recording-state-changed', (event) => {
      if (!mounted) {
        return
      }
      setIsRecording(event.payload)
    })

    const unlistenPipelinePromise = listen<PipelineStatusPayload>(
      'pipeline-status-changed',
      (event) => {
        if (!mounted) {
          return
        }

        const payload = event.payload
        if (payload.message) {
          setError(payload.message)
        }

        switch (payload.stage) {
          case 'recording':
            setPipelineStatus('Recording...')
            setIsRecording(true)
            setIsTranscribing(false)
            break
          case 'transcribing':
            setPipelineStatus('Transcribing...')
            setIsTranscribing(true)
            break
          case 'pasting':
            setPipelineStatus('Pasting...')
            setIsTranscribing(false)
            break
          case 'done':
            setIsRecording(false)
            setIsTranscribing(false)
            if (payload.text) {
              setTranscribedText(payload.text)
              setPipelineStatus(`Done: ${payload.text}`)
            } else {
              setPipelineStatus('Done')
            }
            break
          case 'error':
            setIsRecording(false)
            setIsTranscribing(false)
            setPipelineStatus('Error')
            break
          default:
            setPipelineStatus(payload.stage)
            break
        }
      },
    )

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

  const startRecording = async () => {
    setError(null)
    setCopyStatus(null)
    try {
      await invoke('start_recording')
      setIsRecording(true)
      setPipelineStatus('Recording...')
    } catch (err) {
      setError(String(err))
    }
  }

  const stopRecording = async () => {
    setError(null)
    setCopyStatus(null)
    setIsTranscribing(true)
    setPipelineStatus('Transcribing...')
    try {
      const result = await invoke<TranscriptionResult>('stop_recording_and_transcribe')
      setIsRecording(false)
      setLastAudioBytes(Math.floor((result.wav_base64.length * 3) / 4))
      setTranscribedText(result.text)
      setPipelineStatus(`Done: ${result.text}`)
    } catch (err) {
      setError(String(err))
      setPipelineStatus('Error')
    } finally {
      setIsTranscribing(false)
    }
  }

  const copyTranscribedText = async () => {
    if (!transcribedText) {
      return
    }

    try {
      await navigator.clipboard.writeText(transcribedText)
      setCopyStatus('Copied')
    } catch (err) {
      setCopyStatus(`Copy failed: ${String(err)}`)
    }
  }

  return (
    <main className="app-shell">
      <h1>OpenTypeless</h1>
      <p>Press Cmd+Shift+Space to toggle recording.</p>

      <div className="actions">
        <button type="button" onClick={startRecording} disabled={isRecording}>
          Start Recording
        </button>
        <button type="button" onClick={stopRecording} disabled={!isRecording || isTranscribing}>
          {isTranscribing ? 'Transcribing...' : 'Stop Recording'}
        </button>
      </div>

      {isRecording && <div className="recording-overlay">Recording...</div>}
      {isTranscribing && <p>Transcribing audio...</p>}
      <p className="pipeline-status">{pipelineStatus}</p>

      {lastAudioBytes !== null && <p>Last recording size: {lastAudioBytes} bytes</p>}
      {transcribedText && (
        <section className="transcription-result">
          <p>Transcription: {transcribedText}</p>
          <button type="button" onClick={copyTranscribedText}>
            Copy
          </button>
          {copyStatus && <p>{copyStatus}</p>}
        </section>
      )}
      {error && <p className="error">{error}</p>}
    </main>
  )
}

export default App
