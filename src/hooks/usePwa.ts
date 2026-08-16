import { useEffect, useState } from 'react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let pendingInstallPrompt: InstallPromptEvent | null = null
const installPromptListeners = new Set<(event: InstallPromptEvent) => void>()

// Capture the one-shot browser event as soon as this module loads. Keeping it
// outside React prevents a fast browser prompt from being missed during mount.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    pendingInstallPrompt = event as InstallPromptEvent
    installPromptListeners.forEach((listener) => listener(pendingInstallPrompt!))
  })
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

export function usePwa() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(pendingInstallPrompt)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [installed, setInstalled] = useState(isStandalone)
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (event: InstallPromptEvent) => setInstallPrompt(event)
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null) }
    installPromptListeners.add(onPrompt)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      installPromptListeners.delete(onPrompt)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) return false
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    pendingInstallPrompt = null
    setInstallPrompt(null)
    return choice.outcome === 'accepted'
  }

  return {
    offline,
    installed,
    canInstall: Boolean(installPrompt),
    showIosHint: isIos && !installed,
    install,
  }
}
