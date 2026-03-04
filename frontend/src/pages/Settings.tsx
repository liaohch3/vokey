import { useState, type Dispatch, type SetStateAction } from 'react'
import { t } from '../i18n'
import type { AppConfig, LlmProvider, SettingsStatusKey } from '../types/app'
import {
  APP_VERSION,
  getActiveLlmPreset,
  getActiveSttConfig,
  LLM_BASE_URL_PRESETS,
  OPENAI_COMPATIBLE_LLM_PROVIDERS,
  setActiveLlmPreset,
  setActiveSttConfig,
} from '../utils/app'

type SettingsProps = {
  config: AppConfig
  setConfig: Dispatch<SetStateAction<AppConfig>>
  isLoadingConfig: boolean
  showSttKey: boolean
  setShowSttKey: Dispatch<SetStateAction<boolean>>
  showLlmKey: boolean
  setShowLlmKey: Dispatch<SetStateAction<boolean>>
  settingsStatus: SettingsStatusKey | null
  saveErrorShake: boolean
  error: string | null
  onSaveSettings: () => Promise<void>
  dictionaryText: string
  setDictionaryText: Dispatch<SetStateAction<string>>
  dictionaryStatus: SettingsStatusKey | null
  onSaveDictionary: () => Promise<void>
}

type SettingsTab = 'general' | 'stt' | 'llm' | 'dictionary' | 'about'

export function Settings({
  config,
  setConfig,
  isLoadingConfig,
  showSttKey,
  setShowSttKey,
  showLlmKey,
  setShowLlmKey,
  settingsStatus,
  saveErrorShake,
  error,
  onSaveSettings,
  dictionaryText,
  setDictionaryText,
  dictionaryStatus,
  onSaveDictionary,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const activeSttConfig = getActiveSttConfig(config)
  const activeLlmPreset = getActiveLlmPreset(config)
  const isOpenAiCompatibleProvider = OPENAI_COMPATIBLE_LLM_PROVIDERS.includes(config.llm.provider)

  const selectLlmProvider = (provider: LlmProvider) => {
    setConfig((prev) => {
      const next = { ...prev, llm: { ...prev.llm, provider } }
      if (provider === 'gemini' || provider === 'none') {
        return next
      }

      const preset = LLM_BASE_URL_PRESETS[provider]
      const currentPreset = getActiveLlmPreset(next)
      if (!currentPreset.base_url.trim()) {
        return setActiveLlmPreset(next, { ...currentPreset, base_url: preset })
      }
      return next
    })
  }

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: 'general', label: t('settings.general') },
    { id: 'stt', label: t('settings.tabStt') },
    { id: 'llm', label: t('settings.tabLlm') },
    { id: 'dictionary', label: t('settings.dictionary') },
    { id: 'about', label: t('settings.about') },
  ]

  const renderGeneralTab = () => (
    <article className="section-card settings-panel-card">
      <h2>{t('settings.general')}</h2>
      <div className="field-stack">
        <div className="field-row">
          <label>{t('settings.shortcutDictationLabel')}</label>
          <span className="badge">{t('settings.shortcutDictationValue')}</span>
        </div>
        <div className="field-row">
          <label>{t('settings.shortcutAskLabel')}</label>
          <span className="badge">{t('settings.shortcutAskValue')}</span>
        </div>
        <div className="field-row">
          <label>{t('settings.shortcutTranslateLabel')}</label>
          <span className="badge">{t('settings.shortcutTranslateValue')}</span>
        </div>
        <p className="caption">{t('settings.generalDescription')}</p>
      </div>
    </article>
  )

  const renderSttTab = () => (
    <article className="section-card settings-panel-card">
      <h2>{t('settings.tabStt')}</h2>
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
              className={config.stt.provider === 'openrouter' ? 'active' : ''}
              onClick={() => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: 'openrouter' } }))}
              disabled={isLoadingConfig}
            >
              {t('settings.sttOpenRouter')}
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
                  stt: { ...prev.stt, api_key: event.target.value },
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
            value={activeSttConfig.model}
            onChange={(event) =>
              setConfig((prev) => setActiveSttConfig(prev, { ...getActiveSttConfig(prev), model: event.target.value }))
            }
            disabled={isLoadingConfig}
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
  )

  const renderLlmTab = () => (
    <article className="section-card settings-panel-card">
      <h2>{t('settings.tabLlm')}</h2>
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
                    llm: { ...prev.llm, api_key: event.target.value },
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
                    gemini: { ...prev.llm.gemini, model: event.target.value },
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
                  setConfig((prev) => setActiveLlmPreset(prev, { ...getActiveLlmPreset(prev), model: event.target.value }))
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
                llm: { ...prev.llm, system_prompt: event.target.value },
              }))
            }
            disabled={isLoadingConfig}
          />
          <p className="caption">{config.llm.system_prompt.length} chars</p>
        </div>
      </div>
    </article>
  )

  const renderDictionaryTab = () => (
    <article className="section-card settings-panel-card">
      <h2>{t('settings.dictionary')}</h2>
      <p className="caption">{t('settings.dictionaryDescription')}</p>
      <div className="field-stack">
        <div className="field-group">
          <label>{t('settings.dictionaryEntries')}</label>
          <textarea
            rows={10}
            value={dictionaryText}
            onChange={(event) => setDictionaryText(event.target.value)}
            placeholder={t('settings.dictionaryPlaceholder')}
            disabled={isLoadingConfig}
          />
          <p className="caption">{t('settings.dictionaryFormatHint')}</p>
        </div>
        <div className="field-row">
          <button type="button" className="primary-save" onClick={onSaveDictionary} disabled={isLoadingConfig}>
            {t('settings.dictionarySave')}
          </button>
          {dictionaryStatus && <p className="settings-feedback">{t(dictionaryStatus)}</p>}
        </div>
      </div>
    </article>
  )

  const renderAboutTab = () => (
    <article className="section-card settings-panel-card">
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
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralTab()
      case 'stt':
        return renderSttTab()
      case 'llm':
        return renderLlmTab()
      case 'dictionary':
        return renderDictionaryTab()
      case 'about':
      default:
        return renderAboutTab()
    }
  }

  return (
    <section className="page page-enter settings-page">
      <header className="page-header">
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
      </header>

      <div className="settings-layout">
        <aside className="card settings-tabs" aria-label={t('settings.title')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              disabled={isLoadingConfig}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="card settings-panel">
          <div className="settings-tab-scroll">{renderActiveTab()}</div>

          <div className="settings-panel-footer">
            <button
              type="button"
              className={`primary-save ${settingsStatus === 'settings.saved' ? 'saved' : ''} ${saveErrorShake ? 'shake' : ''}`}
              onClick={onSaveSettings}
              disabled={isLoadingConfig}
            >
              <span>{t('settings.save')}</span>
              {settingsStatus === 'settings.saved' && <span className="save-check">✓</span>}
            </button>
            {settingsStatus && <p className="settings-feedback">{t(settingsStatus)}</p>}
            {error && <p className="inline-error">{error}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
