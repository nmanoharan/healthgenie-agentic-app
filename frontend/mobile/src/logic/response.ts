export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function responseIndicatesFailure(data: unknown): boolean {
  if (!isRecord(data)) return false
  return data.ok === false
}

/** Matches n8n export stages: safety_escalation, validation, etc. */
export function responseIndicatesSafety(data: unknown): boolean {
  if (!isRecord(data)) return false
  if (data.ok !== false) return false
  const stage = String(data.stage || '')
  if (
    stage === 'safety' ||
    stage === 'escalation' ||
    stage === 'safety_escalation' ||
    stage.includes('safety')
  ) {
    return true
  }
  if (Array.isArray(data.red_flags) && data.red_flags.length > 0) return true
  return false
}
