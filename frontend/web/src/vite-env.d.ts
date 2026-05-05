/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_N8N_BASE_URL?: string
  readonly VITE_USE_PROXY?: string
  readonly VITE_N8N_PROXY_TARGET?: string
  readonly VITE_ONBOARDING_PATH?: string
  readonly VITE_CHECKPOINT_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
