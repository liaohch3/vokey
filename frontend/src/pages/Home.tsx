import { t, type Locale } from '../i18n'
import type { HistoryItem, TranscriptionResult } from '../types/app'
import { formatDuration, formatRelativeTime } from '../utils/app'

type HomeProps = {
  locale: Locale
  pipelineStage: string
  recordingSeconds: number
  doneFlash: boolean
  micErrorShake: boolean
  isRecording: boolean
  isWorking: boolean
  error: string | null
  history: HistoryItem[]
  lastResult: TranscriptionResult | null
  totalWords: number
  timeSavedMinutes: number
  onStartRecording: () => Promise<void>
  onStopRecording: () => Promise<void>
}

export function Home({
  locale,
  pipelineStage,
  recordingSeconds,
  doneFlash,
  micErrorShake,
  isRecording,
  isWorking,
  error,
  history,
  lastResult,
  totalWords,
  timeSavedMinutes,
  onStartRecording,
  onStopRecording,
}: HomeProps) {
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

  return (
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
            onClick={isRecording ? onStopRecording : onStartRecording}
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
  )
}
