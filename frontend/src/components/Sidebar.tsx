import { LOCALES, type Locale, t } from '../i18n'
import type { Page } from '../types/app'
import { APP_VERSION, getLocaleFlag } from '../utils/app'

type SidebarProps = {
  page: Page
  locale: Locale
  setPage: (page: Page) => void
  setLocale: (locale: Locale) => void
}

export function Sidebar({ page, locale, setPage, setLocale }: SidebarProps) {
  const selectedLocale = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0]

  return (
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
  )
}
