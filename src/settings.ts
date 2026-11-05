import { useSyncExternalStore } from 'react'

export type TextScale = 'normal' | 'large' | 'xlarge'
export type Settings = { textScale: TextScale; ratesVisible: boolean; orgName: string; responsible: string; rateSource: 'oficial' | 'paralelo' }

const KEY = 'reportesTOC.settings'
const LEGACY_RATES_KEY = 'reportesTOC.ratesVisible'
export const DEFAULT_ORG = 'Tercera Orden Carmelita'
export const SCALES: Record<TextScale, number> = { normal: 1, large: 1.15, xlarge: 1.3 }

const defaults: Settings = { textScale: 'normal', ratesVisible: true, orgName: DEFAULT_ORG, responsible: '', rateSource: 'oficial' }

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    const stored = raw ? JSON.parse(raw) as Partial<Settings> : {}
    const legacy = localStorage.getItem(LEGACY_RATES_KEY)
    return {
      textScale: stored.textScale && stored.textScale in SCALES ? stored.textScale : defaults.textScale,
      ratesVisible: typeof stored.ratesVisible === 'boolean' ? stored.ratesVisible : legacy !== '0',
      orgName: typeof stored.orgName === 'string' && stored.orgName.trim() ? stored.orgName.trim().slice(0, 80) : DEFAULT_ORG,
      rateSource: stored.rateSource === 'paralelo' ? 'paralelo' : 'oficial',
      responsible: typeof stored.responsible === 'string' ? stored.responsible.trim().slice(0, 80) : '',
    }
  } catch { return { ...defaults } }
}

let current = load()
const listeners = new Set<() => void>()

export function getSettings() { return current }
export function getOrgName() { return current.orgName }
export function applyTextScale(scale: TextScale = current.textScale) {
  if (typeof document !== 'undefined') (document.documentElement.style as CSSStyleDeclaration & { zoom: string }).zoom = scale === 'normal' ? '' : String(SCALES[scale])
}
export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(current)) } catch { /* sin almacenamiento */ }
  if ('textScale' in patch) applyTextScale()
  listeners.forEach((l) => l())
}
export function useSettings() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, getSettings)
}
