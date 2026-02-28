import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import './App.css'

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [lastAudioBytes, setLastAudioBytes] = useState<number | null>(null)
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
    try {
      const audioBase64 = await invoke<string>('stop_recording')
      setIsRecording(false)
      setLastAudioBytes(Math.floor((audioBase64.length * 3) / 4))
    } catch (err) {
      setError(String(err))
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
        <button type="button" onClick={stopRecording} disabled={!isRecording}>
          Stop Recording
        </button>
      </div>

      {isRecording && <div className="recording-overlay">Recording...</div>}

      {lastAudioBytes !== null && <p>Last recording size: {lastAudioBytes} bytes</p>}
      {error && <p className="error">{error}</p>}
    </main>
  )
}

export default App
