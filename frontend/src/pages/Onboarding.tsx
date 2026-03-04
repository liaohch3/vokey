import { useState, type Dispatch, type SetStateAction } from 'react'
import { t } from '../i18n'
import type { AppConfig } from '../types/app'

type OnboardingProps = {
  config: AppConfig
  setConfig: Dispatch<SetStateAction<AppConfig>>
  isLoading: boolean
  onComplete: () => Promise<void>
}

const TOTAL_STEPS = 5

export function Onboarding({ config, setConfig, isLoading, onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [isCompleting, setIsCompleting] = useState(false)

  const next = () => setStep((value) => Math.min(TOTAL_STEPS, value + 1))
  const prev = () => setStep((value) => Math.max(1, value - 1))

  const finish = async () => {
    setIsCompleting(true)
    try {
      await onComplete()
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <section className="page page-enter">
      <header className="page-header">
        <h1>{t('onboarding.title')}</h1>
        <p>{t('onboarding.subtitle')}</p>
        <p className="caption">
          {t('onboarding.step')} {step}/{TOTAL_STEPS}
        </p>
      </header>

      <article className="card section-card">
        {step === 1 && (
          <div className="field-stack">
            <h2>{t('onboarding.welcomeTitle')}</h2>
            <p>{t('onboarding.welcomeBody')}</p>
          </div>
        )}

        {step === 2 && (
          <div className="field-stack">
            <h2>{t('onboarding.sttTitle')}</h2>
            <div className="field-group">
              <label>{t('settings.sttProvider')}</label>
              <select
                value={config.stt.provider}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, stt: { ...prev.stt, provider: event.target.value as AppConfig['stt']['provider'] } }))
                }
              >
                <option value="groq">Groq</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="deepgram">Deepgram</option>
                <option value="siliconflow">SiliconFlow</option>
              </select>
            </div>
            <div className="field-group">
              <label>{t('settings.sttApiKey')}</label>
              <input
                value={config.stt.api_key}
                onChange={(event) => setConfig((prev) => ({ ...prev, stt: { ...prev.stt, api_key: event.target.value } }))}
                placeholder={t('settings.sttApiKeyPlaceholder')}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="field-stack">
            <h2>{t('onboarding.llmTitle')}</h2>
            <div className="field-group">
              <label>{t('settings.llmProvider')}</label>
              <select
                value={config.llm.provider}
                onChange={(event) =>
                  setConfig((prev) => ({ ...prev, llm: { ...prev.llm, provider: event.target.value as AppConfig['llm']['provider'] } }))
                }
              >
                <option value="none">None</option>
                <option value="gemini">Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
                <option value="groq">Groq</option>
                <option value="moonshot">Moonshot</option>
                <option value="qwen">Qwen</option>
                <option value="siliconflow">SiliconFlow</option>
                <option value="ollama">Ollama</option>
              </select>
            </div>
            <div className="field-group">
              <label>{t('settings.llmApiKey')}</label>
              <input
                value={config.llm.api_key}
                onChange={(event) => setConfig((prev) => ({ ...prev, llm: { ...prev.llm, api_key: event.target.value } }))}
                placeholder={t('settings.llmApiKeyPlaceholder')}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="field-stack">
            <h2>{t('onboarding.testTitle')}</h2>
            <p>{t('onboarding.testBody')}</p>
            <p className="caption">{t('onboarding.testHint')}</p>
          </div>
        )}

        {step === 5 && (
          <div className="field-stack">
            <h2>{t('onboarding.doneTitle')}</h2>
            <p>{t('onboarding.doneBody')}</p>
            <p className="caption">{t('onboarding.doneHint')}</p>
          </div>
        )}

        <div className="settings-panel-footer">
          {step > 1 && (
            <button type="button" className="text-button" onClick={prev} disabled={isLoading || isCompleting}>
              {t('onboarding.back')}
            </button>
          )}
          {step < TOTAL_STEPS && (
            <button type="button" className="primary-save" onClick={next} disabled={isLoading || isCompleting}>
              {t('onboarding.next')}
            </button>
          )}
          {step === TOTAL_STEPS && (
            <button type="button" className="primary-save" onClick={finish} disabled={isLoading || isCompleting}>
              {isCompleting ? t('settings.saving') : t('onboarding.finish')}
            </button>
          )}
        </div>
      </article>
    </section>
  )
}

