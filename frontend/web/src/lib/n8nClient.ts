import { checkpointPath, onboardingPath } from './paths'

function useProxy(): boolean {
  return import.meta.env.VITE_USE_PROXY === 'true'
}

function absoluteBase(): string {
  const base = (import.meta.env.VITE_N8N_BASE_URL || '').replace(/\/$/, '')
  return base
}

/** Full URL for a webhook path (either same-origin proxy or direct n8n origin). */
export function webhookUrl(path: string): string {
  if (useProxy()) {
    return path
  }
  const base = absoluteBase()
  if (!base) {
    throw new Error(
      'Set VITE_N8N_BASE_URL in .env.local, or VITE_USE_PROXY=true with VITE_N8N_PROXY_TARGET for dev.',
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
    headers: { 'Content-Type': 'application/json' },
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
