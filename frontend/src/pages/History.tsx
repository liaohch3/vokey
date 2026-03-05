import { t, type Locale } from '../i18n'
import type { HistoryItem } from '../types/app'
import { formatRelativeTime } from '../utils/app'

type HistoryProps = {
  locale: Locale
  history: HistoryItem[]
  copySuccessId: string | null
  onClearHistory: () => Promise<void>
  onCopyHistoryText: (id: string, value: string) => Promise<void>
}

export function History({ locale, history, copySuccessId, onClearHistory, onCopyHistoryText }: HistoryProps) {
  return (
    <section className="page page-enter">
      <header className="page-header split">
        <div>
          <h1>{t('history.title')}</h1>
          <p>{t('history.subtitle')}</p>
        </div>
        <button type="button" className="danger-text" onClick={onClearHistory} disabled={history.length === 0}>
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
                  onClick={() => onCopyHistoryText(entry.id, entry.polishedText)}
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
  )
}
