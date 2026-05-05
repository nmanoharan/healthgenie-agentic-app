export const DEFAULT_ONBOARDING_PATH = '/webhook/healthgenie/onboarding'
export const DEFAULT_CHECKPOINT_PATH = '/webhook/healthgenie/checkpoint'

export function onboardingPath(): string {
  return process.env.EXPO_PUBLIC_ONBOARDING_PATH || DEFAULT_ONBOARDING_PATH
}

export function checkpointPath(): string {
  return process.env.EXPO_PUBLIC_CHECKPOINT_PATH || DEFAULT_CHECKPOINT_PATH
}
