export type StoragePersistence = 'checking' | 'persistent' | 'best-effort' | 'unsupported'

export async function requestStoragePersistence(): Promise<StoragePersistence> {
  if (!navigator.storage?.persisted) return 'unsupported'
  try {
    const alreadyPersisted = await navigator.storage.persisted()
    if (alreadyPersisted) return 'persistent'
    if (!navigator.storage.persist) return 'best-effort'
    return (await navigator.storage.persist()) ? 'persistent' : 'best-effort'
  } catch {
    return 'best-effort'
  }
}

export function registerServiceWorker() {
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const appBase = new URL(import.meta.env.BASE_URL, location.href)
      const workerUrl = new URL('sw.js', appBase)
      void navigator.serviceWorker.register(workerUrl, { scope: appBase.pathname }).then(async () => {
        const registration = await navigator.serviceWorker.ready
        const urls = performance.getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => {
            try { return new URL(url).origin === location.origin } catch { return false }
          })
        const channel = new MessageChannel()
        channel.port1.onmessage = () => window.dispatchEvent(new Event('pwa-offline-ready'))
        registration.active?.postMessage({ type: 'CACHE_APP_RESOURCES', urls }, [channel.port2])
      }).catch((error: unknown) => console.error('No se pudo preparar el uso sin conexión.', error))
    }, { once: true })
  }
}
