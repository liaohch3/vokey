import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './App.css'

type TranscriptionResult = {
  wav_base64: string
  text: string
}

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [lastAudioBytes, setLastAudioBytes] = useState<number | null>(null)
  const [transcribedText, setTranscribedText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const unlistenPromise = listen<boolean>('recording-state-changed', (event) => {
      if (mounted) {
        setIsRecording(event.payload)
      }
    })

    return () => {
      mounted = false
      void unlistenPromise.then((unlisten) => unlisten())
    }
  }, [])

  const startRecording = async () => {
    setError(null)
    try {
      await invoke('start_recording')
      setIsRecording(true)
    } catch (err) {
      setError(String(err))
    }
  }

  const stopRecording = async () => {
    setError(null)
    setIsTranscribing(true)
    try {
      const result = await invoke<TranscriptionResult>('stop_recording_and_transcribe')
      setIsRecording(false)
      setLastAudioBytes(Math.floor((result.wav_base64.length * 3) / 4))
      setTranscribedText(result.text)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsTranscribing(false)
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

      {lastAudioBytes !== null && <p>Last recording size: {lastAudioBytes} bytes</p>}
      {transcribedText && <p>Transcription: {transcribedText}</p>}
      {error && <p className="error">{error}</p>}
    </main>
  )
}

export default App
