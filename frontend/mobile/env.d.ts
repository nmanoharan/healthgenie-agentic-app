/**
 * Metro/Expo inlines `EXPO_PUBLIC_*` at bundle time. `process` exists at runtime but is
 * not declared by default React Native typings when `types` excludes Node.
 */
declare const process: {
  env: {
    EXPO_PUBLIC_N8N_BASE_URL?: string
    EXPO_PUBLIC_ONBOARDING_PATH?: string
    EXPO_PUBLIC_CHECKPOINT_PATH?: string
  }
}
