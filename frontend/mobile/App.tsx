import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { ESCALATION_MESSAGE } from './src/config/safety'
import { postCheckpoint, postOnboarding } from './src/lib/n8nClient'
import { responseIndicatesFailure, responseIndicatesSafety } from './src/logic/response'

type Screen = 'welcome' | 'onboarding' | 'plan' | 'checkpoint' | 'safety'

/** Inlined at bundle time; empty string in .env is treated as unset. */
const N8N_BASE_CONFIGURED = Boolean(String(process.env.EXPO_PUBLIC_N8N_BASE_URL || '').trim())

const STORAGE_ONBOARDING = 'healthgenie_last_onboarding'
const STORAGE_CHECKPOINT = 'healthgenie_last_checkpoint'

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

type ParsedPlan = {
  caloriesTarget: string
  proteinTarget: string
  meals: string[]
  activities: string[]
}

type ChecklistState = {
  hydration: boolean
  mealsDone: boolean
  activityDone: boolean
  sleepPrep: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function parsePlan(payload: unknown): ParsedPlan | null {
  const root = asRecord(payload)
  if (!root) return null

  const dietPlan = asRecord(root.diet_plan)
  const exercisePlan = asRecord(root.exercise_plan)

  if (!dietPlan && !exercisePlan) return null

  const caloriesRaw = dietPlan?.calories_target
  const proteinRaw = dietPlan?.protein_target_g
  const mealsRaw = Array.isArray(dietPlan?.meals) ? dietPlan?.meals : []
  const activitiesRaw = Array.isArray(exercisePlan?.weekly_plan) ? exercisePlan?.weekly_plan : []

  return {
    caloriesTarget:
      typeof caloriesRaw === 'number' || typeof caloriesRaw === 'string' ? String(caloriesRaw) : 'Not provided',
    proteinTarget:
      typeof proteinRaw === 'number' || typeof proteinRaw === 'string' ? String(proteinRaw) : 'Not provided',
    meals: mealsRaw.map((m) => String(m)),
    activities: activitiesRaw.map((a) => String(a)),
  }
}

function mealLabel(index: number): string {
  const labels = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
  return labels[index] || `Meal ${index + 1}`
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { key: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.chip, value === o.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, value === o.key && styles.chipTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
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
  const [rawOpen, setRawOpen] = useState(false)
  const [planDebugOpen, setPlanDebugOpen] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistState>({
    hydration: false,
    mealsDone: false,
    activityDone: false,
    sleepPrep: false,
  })

  useEffect(() => {
    void (async () => {
      try {
        const [o, c] = await Promise.all([
          AsyncStorage.getItem(STORAGE_ONBOARDING),
          AsyncStorage.getItem(STORAGE_CHECKPOINT),
        ])
        if (o) setLastOnboarding(JSON.parse(o))
        if (c) setLastCheckpoint(JSON.parse(c))
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const persistOnboarding = useCallback(async (data: unknown) => {
    setLastOnboarding(data)
    try {
      await AsyncStorage.setItem(STORAGE_ONBOARDING, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }, [])

  const persistCheckpoint = useCallback(async (data: unknown) => {
    setLastCheckpoint(data)
    try {
      await AsyncStorage.setItem(STORAGE_CHECKPOINT, JSON.stringify(data))
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
      await persistOnboarding(data)
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
      await persistCheckpoint(data)
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

  const payloadWithPlan = parsePlan(lastOnboarding) ? lastOnboarding : parsePlan(lastCheckpoint) ? lastCheckpoint : null
  const parsedPlan = parsePlan(payloadWithPlan)

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.title}>HealthGenie</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            <Pressable style={styles.tab} onPress={() => setScreen('welcome')}>
              <Text style={styles.tabText}>Home</Text>
            </Pressable>
            <Pressable style={styles.tab} disabled={!consent} onPress={() => setScreen('onboarding')}>
              <Text style={[styles.tabText, !consent && styles.tabDisabled]}>Profile</Text>
            </Pressable>
            <Pressable
              style={styles.tab}
              disabled={!lastOnboarding && !lastCheckpoint}
              onPress={() => setScreen('plan')}
            >
              <Text style={[styles.tabText, !lastOnboarding && !lastCheckpoint && styles.tabDisabled]}>Plan</Text>
            </Pressable>
            <Pressable style={styles.tab} disabled={!consent} onPress={() => setScreen('checkpoint')}>
              <Text style={[styles.tabText, !consent && styles.tabDisabled]}>Checkpoint</Text>
            </Pressable>
          </ScrollView>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {!N8N_BASE_CONFIGURED ? (
            <View style={styles.envBanner}>
              <Text style={styles.envBannerTitle}>n8n base URL not set</Text>
              <Text style={styles.envBannerText}>
                Add EXPO_PUBLIC_N8N_BASE_URL to frontend/mobile/.env (copy from .env.example), then run npx expo start -c.
                For TestFlight/EAS, define the same variable at build time in eas.json or Expo project environment variables.
              </Text>
            </View>
          ) : null}
          {screen === 'welcome' && (
            <View style={styles.card}>
              <Text style={styles.h2}>Welcome</Text>
              <Text style={styles.muted}>
                Preventive wellness prototype. Calls your n8n webhooks (onboarding and daily checkpoint). Not medical
                care.
              </Text>
              <View style={styles.consentRow}>
                <Switch value={consent} onValueChange={setConsent} />
                <Text style={styles.consentLabel}>I understand this is guidance only, not diagnosis or treatment.</Text>
              </View>
              <Pressable style={[styles.btnPrimary, !consent && styles.btnDisabled]} disabled={!consent} onPress={() => setScreen('onboarding')}>
                <Text style={styles.btnPrimaryText}>Start profile</Text>
              </Pressable>
              <Pressable style={[styles.btnGhost, !consent && styles.btnDisabled]} disabled={!consent} onPress={() => setScreen('checkpoint')}>
                <Text style={styles.btnGhostText}>Daily checkpoint</Text>
              </Pressable>
            </View>
          )}

          {screen === 'onboarding' && (
            <View style={styles.card}>
              <Text style={styles.h2}>Profile onboarding</Text>
              <Text style={styles.muted}>Payload matches IMPORT_INSTRUCTIONS sample.</Text>
              {(
                [
                  ['age', 'Age', 'numeric'] as const,
                  ['height_cm', 'Height (cm)', 'numeric'] as const,
                  ['weight_kg', 'Weight (kg)', 'numeric'] as const,
                  ['sex', 'Sex / gender (optional)', 'default'] as const,
                  ['goal', 'Goal', 'default'] as const,
                  ['diet_pref', 'Diet preference', 'default'] as const,
                  ['allergies', 'Allergies (optional)', 'default'] as const,
                  ['ethnicity', 'Ethnicity / context', 'default'] as const,
                  ['family_history', 'Family history', 'default'] as const,
                ] as const
              ).map(([key, lbl, kb]) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.label}>{lbl}</Text>
                  <TextInput
                    style={styles.input}
                    value={onboardingForm[key]}
                    onChangeText={(t) => setOnboardingForm((f) => ({ ...f, [key]: t }))}
                    keyboardType={kb === 'numeric' ? 'numeric' : 'default'}
                    placeholder={key === 'sex' || key === 'allergies' ? 'optional' : undefined}
                  />
                </View>
              ))}
              <ChipRow
                label="Activity level"
                options={[
                  { key: 'low', label: 'low' },
                  { key: 'moderate', label: 'moderate' },
                  { key: 'high', label: 'high' },
                ]}
                value={onboardingForm.activity_level}
                onChange={(v) => setOnboardingForm((f) => ({ ...f, activity_level: v }))}
              />
              <View style={styles.field}>
                <Text style={styles.label}>Medical constraints</Text>
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={onboardingForm.medical_constraints}
                  onChangeText={(t) => setOnboardingForm((f) => ({ ...f, medical_constraints: t }))}
                  multiline
                />
              </View>
              <Pressable
                style={[styles.btnPrimary, (loading || !N8N_BASE_CONFIGURED) && styles.btnDisabled]}
                disabled={loading || !N8N_BASE_CONFIGURED}
                onPress={submitOnboarding}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Submit to n8n</Text>}
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => setScreen('welcome')}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          )}

          {screen === 'checkpoint' && (
            <View style={styles.card}>
              <Text style={styles.h2}>Daily checkpoint</Text>
              <Text style={styles.muted}>Matches checkpoint sample in IMPORT_INSTRUCTIONS.</Text>
              <ChipRow
                label="Activity completed"
                options={[
                  { key: 'true', label: 'yes' },
                  { key: 'false', label: 'no' },
                ]}
                value={checkpointForm.activity_done}
                onChange={(v) => setCheckpointForm((f) => ({ ...f, activity_done: v }))}
              />
              {(
                [
                  ['steps', 'Steps', 'numeric'] as const,
                  ['energy', 'Energy (1–5)', 'numeric'] as const,
                  ['sleep_quality', 'Sleep quality (1–5)', 'numeric'] as const,
                  ['pain_reported', 'Pain reported', 'default'] as const,
                  ['meal_adherence', 'Meal adherence', 'default'] as const,
                ] as const
              ).map(([key, lbl, kb]) => (
                <View key={key} style={styles.field}>
                  <Text style={styles.label}>{lbl}</Text>
                  <TextInput
                    style={styles.input}
                    value={checkpointForm[key]}
                    onChangeText={(t) => setCheckpointForm((f) => ({ ...f, [key]: t }))}
                    keyboardType={kb === 'numeric' ? 'numeric' : 'default'}
                  />
                </View>
              ))}
              <Pressable
                style={[styles.btnPrimary, (loading || !N8N_BASE_CONFIGURED) && styles.btnDisabled]}
                disabled={loading || !N8N_BASE_CONFIGURED}
                onPress={submitCheckpoint}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Send checkpoint</Text>}
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => setScreen('welcome')}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          )}

          {screen === 'plan' && (
            <View style={styles.card}>
              <Text style={styles.h2}>Today&apos;s plan</Text>
              <Text style={styles.muted}>Structured from the latest n8n response that includes a diet/exercise plan.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {!lastOnboarding && !lastCheckpoint ? (
                <Text style={styles.muted}>Complete onboarding or checkpoint first.</Text>
              ) : (
                <>
                  {parsedPlan ? (
                    <>
                      <View style={styles.planCard}>
                        <Text style={styles.sectionTitle}>Plan highlights</Text>
                        <View style={styles.planMetricsRow}>
                          <View style={styles.metricBox}>
                            <Text style={styles.metricLabel}>🔥 Calories</Text>
                            <Text style={styles.metricValue}>{parsedPlan.caloriesTarget}</Text>
                          </View>
                          <View style={styles.metricBox}>
                            <Text style={styles.metricLabel}>💪 Protein (g)</Text>
                            <Text style={styles.metricValue}>{parsedPlan.proteinTarget}</Text>
                          </View>
                        </View>

                        <Text style={styles.subh}>🍽️ Meals</Text>
                        {parsedPlan.meals.length > 0 ? (
                          parsedPlan.meals.map((meal, index) => (
                            <View key={`meal-${index}`} style={styles.itemCard}>
                              <Text style={styles.itemTitle}>{mealLabel(index)}</Text>
                              <Text style={styles.bulletItem}>{meal}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.muted}>No meals returned.</Text>
                        )}

                        <Text style={styles.subh}>🏃 Activity</Text>
                        {parsedPlan.activities.length > 0 ? (
                          parsedPlan.activities.map((item, index) => (
                            <View key={`activity-${index}`} style={styles.itemCard}>
                              <Text style={styles.bulletItem}>{item}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={styles.muted}>No activity plan returned.</Text>
                        )}

                        <Text style={styles.subh}>✅ Today checklist</Text>
                        <View style={styles.checklistCard}>
                          <View style={styles.checkItem}>
                            <Text style={styles.checkLabel}>Drink enough water</Text>
                            <Switch
                              value={checklist.hydration}
                              onValueChange={(v) => setChecklist((s) => ({ ...s, hydration: v }))}
                            />
                          </View>
                          <View style={styles.checkItem}>
                            <Text style={styles.checkLabel}>Follow planned meals</Text>
                            <Switch
                              value={checklist.mealsDone}
                              onValueChange={(v) => setChecklist((s) => ({ ...s, mealsDone: v }))}
                            />
                          </View>
                          <View style={styles.checkItem}>
                            <Text style={styles.checkLabel}>Complete activity block</Text>
                            <Switch
                              value={checklist.activityDone}
                              onValueChange={(v) => setChecklist((s) => ({ ...s, activityDone: v }))}
                            />
                          </View>
                          <View style={styles.checkItem}>
                            <Text style={styles.checkLabel}>Prep for sleep routine</Text>
                            <Switch
                              value={checklist.sleepPrep}
                              onValueChange={(v) => setChecklist((s) => ({ ...s, sleepPrep: v }))}
                            />
                          </View>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.muted}>
                      A response exists, but no `diet_plan` / `exercise_plan` block was found yet.
                    </Text>
                  )}

                  <Pressable onPress={() => setPlanDebugOpen((v) => !v)}>
                    <Text style={styles.muted}>{planDebugOpen ? 'Hide raw debug payloads' : 'Show raw debug payloads'}</Text>
                  </Pressable>
                  {planDebugOpen ? (
                    <>
                      {lastOnboarding != null ? (
                        <>
                          <Text style={styles.subh}>Last onboarding (raw)</Text>
                          <Text selectable style={styles.pre}>
                            {JSON.stringify(lastOnboarding, null, 2)}
                          </Text>
                        </>
                      ) : null}
                      {lastCheckpoint != null ? (
                        <>
                          <Text style={styles.subh}>Last checkpoint (raw)</Text>
                          <Text selectable style={styles.pre}>
                            {JSON.stringify(lastCheckpoint, null, 2)}
                          </Text>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
              <Pressable style={styles.btnGhost} onPress={() => setScreen('onboarding')}>
                <Text style={styles.btnGhostText}>Edit profile</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => setScreen('checkpoint')}>
                <Text style={styles.btnGhostText}>New checkpoint</Text>
              </Pressable>
            </View>
          )}

          {screen === 'safety' && (
            <View style={styles.card}>
              <Text style={styles.h2}>Safety</Text>
              <View style={styles.safetyBox}>
                <Text style={styles.safetyText}>{ESCALATION_MESSAGE}</Text>
              </View>
              {safetySnapshot != null ? (
                <>
                  <Pressable onPress={() => setRawOpen((v) => !v)}>
                    <Text style={styles.muted}>{rawOpen ? 'Hide raw response' : 'Show raw response'}</Text>
                  </Pressable>
                  {rawOpen ? (
                    <Text selectable style={styles.pre}>
                      {JSON.stringify(safetySnapshot, null, 2)}
                    </Text>
                  ) : null}
                </>
              ) : null}
              <Pressable style={styles.btnPrimary} onPress={() => setScreen('welcome')}>
                <Text style={styles.btnPrimaryText}>Back to home</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1419' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d3a4d',
  },
  title: { color: '#e8eef5', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    backgroundColor: '#1a2332',
  },
  tabText: { color: '#e8eef5', fontSize: 13 },
  tabDisabled: { opacity: 0.45 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#1a2332',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    padding: 16,
    gap: 12,
  },
  h2: { color: '#e8eef5', fontSize: 18, fontWeight: '600' },
  subh: { color: '#8b9cb3', fontSize: 14, marginTop: 8 },
  muted: { color: '#8b9cb3', fontSize: 14, lineHeight: 20 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  consentLabel: { flex: 1, color: '#e8eef5', fontSize: 14 },
  field: { marginTop: 4 },
  label: { color: '#8b9cb3', fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#0f1419',
    borderWidth: 1,
    borderColor: '#2d3a4d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e8eef5',
    fontSize: 16,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    backgroundColor: '#0f1419',
  },
  chipActive: { borderColor: '#3d9cf5', backgroundColor: '#1a2a3d' },
  chipText: { color: '#e8eef5', fontSize: 14 },
  chipTextActive: { color: '#3d9cf5', fontWeight: '600' },
  btnPrimary: {
    backgroundColor: '#3d9cf5',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnGhost: {
    borderWidth: 1,
    borderColor: '#2d3a4d',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnGhostText: { color: '#e8eef5', fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  error: { color: '#f87171', fontSize: 14, marginTop: 8 },
  sectionTitle: { color: '#c4d4e8', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  planCard: {
    backgroundColor: '#0f1419',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    padding: 12,
    gap: 8,
  },
  itemCard: {
    backgroundColor: '#141d2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  itemTitle: { color: '#8b9cb3', fontSize: 12, marginBottom: 2 },
  planMetricsRow: { flexDirection: 'row', gap: 8 },
  metricBox: {
    flex: 1,
    backgroundColor: '#141d2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metricLabel: { color: '#8b9cb3', fontSize: 12 },
  metricValue: { color: '#e8eef5', fontSize: 18, fontWeight: '600', marginTop: 4 },
  bulletItem: { color: '#e8eef5', fontSize: 14, lineHeight: 20 },
  checklistCard: {
    backgroundColor: '#141d2a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2d3a4d',
  },
  checkLabel: { color: '#e8eef5', fontSize: 14, flex: 1, paddingRight: 10 },
  pre: {
    fontFamily: 'Menlo',
    fontSize: 11,
    color: '#c4d4e8',
    backgroundColor: '#0f1419',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2d3a4d',
    padding: 12,
    marginTop: 6,
  },
  safetyBox: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    padding: 12,
  },
  safetyText: { color: '#fcd34d', fontSize: 14, lineHeight: 20 },
  envBanner: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  envBannerTitle: { color: '#fcd34d', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  envBannerText: { color: '#e8eef5', fontSize: 13, lineHeight: 19 },
})
