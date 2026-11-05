export type RateSource = 'oficial' | 'paralelo'
export type Rate = { fuente: RateSource; promedio: number | null; fechaActualizacion: string }
export type RatesSnapshot = { rates: Rate[]; fetchedAt: string }
export type ReferenceRate = { source: RateSource; label: string; rate: number; updatedAt: string }

const API_URL = 'https://ve.dolarapi.com/v1/dolares'
const CACHE_KEY = 'reportesTOC.rates'

export const sourceLabel: Record<RateSource, string> = { oficial: 'Dólar oficial (BCV)', paralelo: 'Dólar paralelo' }

export function readRatesCache(): RatesSnapshot | null {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) as RatesSnapshot : null } catch { return null }
}
function writeRatesCache(s: RatesSnapshot) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)) } catch { /* sin almacenamiento */ } }

/** Consulta la API pública y guarda el último resultado. Lanza error si no hay conexión o datos. */
export async function fetchRates(): Promise<RatesSnapshot> {
  const res = await fetch(API_URL, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(String(res.status))
  const data = await res.json() as Rate[]
  const rates = data.filter((r) => (r.fuente === 'oficial' || r.fuente === 'paralelo') && typeof r.promedio === 'number' && r.promedio > 0)
  if (!rates.length) throw new Error('sin datos')
  const snapshot = { rates, fetchedAt: new Date().toISOString() }
  writeRatesCache(snapshot)
  return snapshot
}

export function pickReference(snapshot: RatesSnapshot | null, source: RateSource): ReferenceRate | null {
  const found = snapshot?.rates.find((r) => r.fuente === source)
  return found?.promedio ? { source, label: sourceLabel[source], rate: found.promedio, updatedAt: found.fechaActualizacion } : null
}
