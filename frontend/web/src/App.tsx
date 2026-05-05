import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { ESCALATION_MESSAGE } from './config/safety'
import { postCheckpoint, postOnboarding } from './lib/n8nClient'

type Screen = 'welcome' | 'onboarding' | 'plan' | 'checkpoint' | 'safety'

const STORAGE_ONBOARDING = 'healthgenie_last_onboarding'
const STORAGE_CHECKPOINT = 'healthgenie_last_checkpoint'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function responseIndicatesFailure(data: unknown): boolean {
  if (!isRecord(data)) return false
  return data.ok === false
}

function responseIndicatesSafety(data: unknown): boolean {
  if (!isRecord(data)) return false
  if (data.ok !== false) return false
  const stage = String(data.stage ?? '')
  if (stage === 'safety' || stage === 'escalation' || stage === 'safety_escalation' || stage.includes('safety')) {
    return true
  }
  if (Array.isArray(data.red_flags) && data.red_flags.length > 0) return true
  return false
}

type OnboardingForm = {
  age: string
  height_cm: string
  weight_kg: string
  activity_level: string
  goal: string
  diet_pref: string
  ethnicity: string
  family_history: string
  medical_constraints: string
  sex: string
  allergies: string
}

const defaultOnboarding: OnboardingForm = {
  age: '45',
  height_cm: '173',
  weight_kg: '86',
  activity_level: 'low',
  goal: 'weight_loss',
  diet_pref: 'vegetarian',
  ethnicity: 'south_asian',
  family_history: 'diabetes',
  medical_constraints: 'none',
  sex: '',
  allergies: '',
}

type CheckpointForm = {
  activity_done: string
  steps: string
  energy: string
  sleep_quality: string
  pain_reported: string
  meal_adherence: string
}

const defaultCheckpoint: CheckpointForm = {
  activity_done: 'true',
  steps: '6200',
  energy: '4',
  sleep_quality: '3',
  pain_reported: 'none',
  meal_adherence: 'high',
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('welcome')
  const [consent, setConsent] = useState(false)
  const [onboardingForm, setOnboardingForm] = useState<OnboardingForm>(defaultOnboarding)
  const [checkpointForm, setCheckpointForm] = useState<CheckpointForm>(defaultCheckpoint)
  const [lastOnboarding, setLastOnboarding] = useState<unknown>(null)
  const [lastCheckpoint, setLastCheckpoint] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [safetySnapshot, setSafetySnapshot] = useState<unknown>(null)

  useEffect(() => {
    try {
      const o = sessionStorage.getItem(STORAGE_ONBOARDING)
      const c = sessionStorage.getItem(STORAGE_CHECKPOINT)
      if (o) setLastOnboarding(JSON.parse(o))
      if (c) setLastCheckpoint(JSON.parse(c))
    } catch {
      /* ignore */
    }
  }, [])

  const persistOnboarding = useCallback((data: unknown) => {
    setLastOnboarding(data)
    try {
      sessionStorage.setItem(STORAGE_ONBOARDING, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }, [])

  const persistCheckpoint = useCallback((data: unknown) => {
    setLastCheckpoint(data)
    try {
      sessionStorage.setItem(STORAGE_CHECKPOINT, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }, [])

  const submitOnboarding = async () => {
    setError(null)
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        age: Number(onboardingForm.age),
        height_cm: Number(onboardingForm.height_cm),
        weight_kg: Number(onboardingForm.weight_kg),
        activity_level: onboardingForm.activity_level,
        goal: onboardingForm.goal,
        diet_pref: onboardingForm.diet_pref,
        ethnicity: onboardingForm.ethnicity,
        family_history: onboardingForm.family_history,
        medical_constraints: onboardingForm.medical_constraints,
      }
      if (onboardingForm.sex.trim()) body.sex = onboardingForm.sex.trim()
      if (onboardingForm.allergies.trim()) body.allergies = onboardingForm.allergies.trim()

      const data = await postOnboarding(body)
      persistOnboarding(data)
      if (responseIndicatesSafety(data)) {
        setSafetySnapshot(data)
        setScreen('safety')
      } else if (responseIndicatesFailure(data)) {
        setError(
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : 'Onboarding returned ok: false. Check payload or workflow.',
        )
        setScreen('plan')
      } else {
        setScreen('plan')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const submitCheckpoint = async () => {
    setError(null)
    setLoading(true)
    try {
      const body = {
        activity_done: checkpointForm.activity_done === 'true',
        steps: Number(checkpointForm.steps),
        energy: Number(checkpointForm.energy),
        sleep_quality: Number(checkpointForm.sleep_quality),
        pain_reported: checkpointForm.pain_reported,
        meal_adherence: checkpointForm.meal_adherence,
      }
      const data = await postCheckpoint(body)
      persistCheckpoint(data)
      if (responseIndicatesSafety(data)) {
        setSafetySnapshot(data)
        setScreen('safety')
      } else {
        setScreen('plan')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>HealthGenie</h1>
        <nav className="nav-pills" aria-label="Sections">
          <button type="button" onClick={() => setScreen('welcome')}>
            Home
          </button>
          <button type="button" onClick={() => setScreen('onboarding')} disabled={!consent}>
            Profile
          </button>
          <button
            type="button"
            onClick={() => setScreen('plan')}
            disabled={!lastOnboarding && !lastCheckpoint}
          >
            Plan
          </button>
          <button type="button" onClick={() => setScreen('checkpoint')} disabled={!consent}>
            Checkpoint
          </button>
        </nav>
      </header>

      {screen === 'welcome' && (
        <section className="card">
          <h2>Welcome</h2>
          <p className="muted">
            Preventive wellness prototype. This chat UI calls your n8n webhooks (onboarding and daily
            checkpoint). Not a substitute for medical care.
          </p>
          <div className="consent-row">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent">
              I understand this is guidance only, not diagnosis or treatment.
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn-primary" disabled={!consent} onClick={() => setScreen('onboarding')}>
              Start profile
            </button>
            <button type="button" className="btn-ghost" disabled={!consent} onClick={() => setScreen('checkpoint')}>
              Daily checkpoint
            </button>
          </div>
        </section>
      )}

      {screen === 'onboarding' && (
        <section className="card">
          <h2>Profile onboarding</h2>
          <p className="muted">Fields align with `n8n_flows/export/IMPORT_INSTRUCTIONS.md` sample payload.</p>
          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <label>
              Age
              <input
                type="number"
                min={1}
                value={onboardingForm.age}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, age: e.target.value }))}
              />
            </label>
            <label>
              Height (cm)
              <input
                type="number"
                min={1}
                value={onboardingForm.height_cm}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, height_cm: e.target.value }))}
              />
            </label>
            <label>
              Weight (kg)
              <input
                type="number"
                min={1}
                value={onboardingForm.weight_kg}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, weight_kg: e.target.value }))}
              />
            </label>
            <label>
              Sex / gender (optional)
              <input
                value={onboardingForm.sex}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, sex: e.target.value }))}
                placeholder="optional"
              />
            </label>
            <label>
              Activity level
              <select
                value={onboardingForm.activity_level}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, activity_level: e.target.value }))}
              >
                <option value="low">low</option>
                <option value="moderate">moderate</option>
                <option value="high">high</option>
              </select>
            </label>
            <label>
              Goal
              <input
                value={onboardingForm.goal}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, goal: e.target.value }))}
              />
            </label>
            <label>
              Diet preference
              <input
                value={onboardingForm.diet_pref}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, diet_pref: e.target.value }))}
              />
            </label>
            <label>
              Allergies (optional)
              <input
                value={onboardingForm.allergies}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, allergies: e.target.value }))}
                placeholder="optional"
              />
            </label>
            <label>
              Ethnicity / context
              <input
                value={onboardingForm.ethnicity}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, ethnicity: e.target.value }))}
              />
            </label>
            <label>
              Family history
              <input
                value={onboardingForm.family_history}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, family_history: e.target.value }))}
              />
            </label>
            <label>
              Medical constraints
              <textarea
                value={onboardingForm.medical_constraints}
                onChange={(e) => setOnboardingForm((f) => ({ ...f, medical_constraints: e.target.value }))}
              />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn-primary" disabled={loading} onClick={submitOnboarding}>
              {loading ? 'Sending…' : 'Submit to n8n'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setScreen('welcome')}>
              Back
            </button>
          </div>
          {error && <div className="error-banner">{error}</div>}
        </section>
      )}

      {screen === 'checkpoint' && (
        <section className="card">
          <h2>Daily checkpoint</h2>
          <p className="muted">POST body matches checkpoint sample in IMPORT_INSTRUCTIONS.</p>
          <div className="form-grid" style={{ marginTop: '1rem' }}>
            <label>
              Activity completed
              <select
                value={checkpointForm.activity_done}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, activity_done: e.target.value }))}
              >
                <option value="true">yes</option>
                <option value="false">no</option>
              </select>
            </label>
            <label>
              Steps
              <input
                type="number"
                min={0}
                value={checkpointForm.steps}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, steps: e.target.value }))}
              />
            </label>
            <label>
              Energy (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={checkpointForm.energy}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, energy: e.target.value }))}
              />
            </label>
            <label>
              Sleep quality (1–5)
              <input
                type="number"
                min={1}
                max={5}
                value={checkpointForm.sleep_quality}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, sleep_quality: e.target.value }))}
              />
            </label>
            <label>
              Pain reported
              <input
                value={checkpointForm.pain_reported}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, pain_reported: e.target.value }))}
              />
            </label>
            <label>
              Meal adherence
              <input
                value={checkpointForm.meal_adherence}
                onChange={(e) => setCheckpointForm((f) => ({ ...f, meal_adherence: e.target.value }))}
              />
            </label>
          </div>
          <div className="actions">
            <button type="button" className="btn-primary" disabled={loading} onClick={submitCheckpoint}>
              {loading ? 'Sending…' : 'Send checkpoint'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setScreen('welcome')}>
              Back
            </button>
          </div>
          {error && <div className="error-banner">{error}</div>}
        </section>
      )}

      {screen === 'plan' && (
        <section className="card">
          <h2>Today&apos;s response</h2>
          <p className="muted">Latest onboarding or checkpoint JSON from n8n. Daily plan cron runs in n8n separately.</p>
          {error && <div className="error-banner">{error}</div>}
          {!lastOnboarding && !lastCheckpoint ? (
            <p className="muted">Complete onboarding or checkpoint to see data here.</p>
          ) : (
            <>
              {lastOnboarding != null && (
                <>
                  <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.9rem' }}>Last onboarding</h3>
                  <pre className="pre-json">{JSON.stringify(lastOnboarding, null, 2)}</pre>
                </>
              )}
              {lastCheckpoint != null && (
                <>
                  <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.9rem' }}>Last checkpoint</h3>
                  <pre className="pre-json">{JSON.stringify(lastCheckpoint, null, 2)}</pre>
                </>
              )}
            </>
          )}
          <div className="actions">
            <button type="button" className="btn-ghost" onClick={() => setScreen('onboarding')}>
              Edit profile
            </button>
            <button type="button" className="btn-ghost" onClick={() => setScreen('checkpoint')}>
              New checkpoint
            </button>
          </div>
        </section>
      )}

      {screen === 'safety' && (
        <section className="card">
          <h2>Safety</h2>
          <div className="safety-banner">{ESCALATION_MESSAGE}</div>
          {safetySnapshot != null && (
            <details style={{ marginTop: '1rem' }}>
              <summary className="muted">Raw response</summary>
              <pre className="pre-json" style={{ marginTop: '0.5rem' }}>
                {JSON.stringify(safetySnapshot, null, 2)}
              </pre>
            </details>
          )}
          <div className="actions">
            <button type="button" className="btn-primary" onClick={() => setScreen('welcome')}>
              Back to home
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
