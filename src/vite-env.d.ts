/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_KEY?: string
  readonly VITE_OPENWEATHER_KEY?: string
  readonly VITE_OXR_APP_ID?: string
  readonly VITE_TRANSLATE_ENDPOINT?: string
  readonly VITE_AUDD_TOKEN?: string
  readonly VITE_PARKING_ENDPOINT?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
