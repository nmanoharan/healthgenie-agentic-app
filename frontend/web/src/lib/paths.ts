/** Matches repo `config.yaml` workflows.*_webhook paths. */
export const DEFAULT_ONBOARDING_PATH = '/webhook/healthgenie/onboarding'
export const DEFAULT_CHECKPOINT_PATH = '/webhook/healthgenie/checkpoint'

export function onboardingPath(): string {
  return import.meta.env.VITE_ONBOARDING_PATH || DEFAULT_ONBOARDING_PATH
}

export function checkpointPath(): string {
  return import.meta.env.VITE_CHECKPOINT_PATH || DEFAULT_CHECKPOINT_PATH
}
