import { checkpointPath, onboardingPath } from './paths'

function absoluteBase(): string {
  return (process.env.EXPO_PUBLIC_N8N_BASE_URL || '').replace(/\/$/, '')
}

export function webhookUrl(path: string): string {
  const base = absoluteBase()
  if (!base) {
    throw new Error(
      'EXPO_PUBLIC_N8N_BASE_URL is missing. For local dev: create frontend/mobile/.env from .env.example and restart with npx expo start -c. For EAS builds: set EXPO_PUBLIC_N8N_BASE_URL in eas.json (env) or Expo project secrets, then rebuild.',
    )
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export async function postOnboarding(body: unknown): Promise<unknown> {
  return postJson(webhookUrl(onboardingPath()), body)
}

export async function postCheckpoint(body: unknown): Promise<unknown> {
  return postJson(webhookUrl(checkpointPath()), body)
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text, parseError: true }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : res.statusText
    throw new Error(`HTTP ${res.status}: ${msg}`)
  }
  return data
}
