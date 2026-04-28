// Stub that replaces `virtual:pwa-register` in Capacitor builds, where the
// PWA service worker is intentionally disabled. Returning a no-op keeps
// PWAUpdatePrompt safe to render without affecting native behavior.
export function registerSW(_options?: unknown) {
  return async (_reload?: boolean) => {
    /* no-op */
  }
}
