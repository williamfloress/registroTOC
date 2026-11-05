import { useEffect, useState } from 'react'
import { Eye, EyeOff, RefreshCw, TrendingUp } from 'lucide-react'

type Rate = { fuente: 'oficial' | 'paralelo'; promedio: number | null; fechaActualizacion: string }
type Snapshot = { rates: Rate[]; fetchedAt: string }

const API_URL = 'https://ve.dolarapi.com/v1/dolares'
const CACHE_KEY = 'reportesTOC.rates'
const VISIBLE_KEY = 'reportesTOC.ratesVisible'

function readCache(): Snapshot | null {
  try { const raw = localStorage.getItem(CACHE_KEY); return raw ? JSON.parse(raw) as Snapshot : null } catch { return null }
}
function writeCache(s: Snapshot) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)) } catch { /* sin almacenamiento */ } }

function readVisible() { try { return localStorage.getItem(VISIBLE_KEY) !== '0' } catch { return true } }

const fmt = (n: number) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function ExchangeRates() {
  const [snap, setSnap] = useState<Snapshot | null>(readCache)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(readVisible)
  function toggle() { const next = !visible; setVisible(next); try { localStorage.setItem(VISIBLE_KEY, next ? '1' : '0') } catch { /* sin almacenamiento */ } }

  async function load() {
    setLoading(true); setFailed(false)
    try {
      const res = await fetch(API_URL, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json() as Rate[]
      const rates = data.filter((r) => (r.fuente === 'oficial' || r.fuente === 'paralelo') && typeof r.promedio === 'number')
      if (!rates.length) throw new Error('sin datos')
      const next = { rates, fetchedAt: new Date().toISOString() }
      setSnap(next); writeCache(next)
    } catch { setFailed(true) } finally { setLoading(false) }
  }
  useEffect(() => { if (visible) void load() }, [visible])

  const rate = (f: Rate['fuente']) => snap?.rates.find((r) => r.fuente === f)
  const items: { key: Rate['fuente']; label: string }[] = [{ key: 'oficial', label: 'Dólar oficial (BCV)' }, { key: 'paralelo', label: 'Dólar paralelo' }]

  return <section className="dashboard-section rates-section" data-tour="rates">
    <div className="dashboard-section-heading"><div><h2>Referencia del dólar</h2></div>
      <div className="rates-actions">{visible && <button className="icon-button" onClick={() => void load()} disabled={loading} aria-label="Actualizar tasas" title="Actualizar tasas"><RefreshCw size={16} className={loading ? 'spin' : ''}/></button>}
        <button className="icon-button" onClick={toggle} aria-label={visible ? 'Ocultar referencia del dólar' : 'Mostrar referencia del dólar'} aria-pressed={visible} title={visible ? 'Ocultar' : 'Mostrar'}>{visible ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
    {visible && <>
    <div className="rates-grid">
      {items.map(({ key, label }) => { const r = rate(key); return <article className="rate-card" key={key}>
        <span className="account-icon"><TrendingUp size={18}/></span>
        <div><span className="rate-label">{label}</span><strong className="rate-value">{r?.promedio ? `Bs.S ${fmt(r.promedio)}` : loading ? 'Cargando…' : '—'}</strong>{r && <small>Actualizado: {fmtDate(r.fechaActualizacion)}</small>}</div>
      </article> })}
    </div>
    {failed && <p className="rates-note" role="status">{snap ? `Sin conexión: mostrando los últimos valores consultados (${fmtDate(snap.fetchedAt)}).` : 'No se pudo consultar la tasa en este momento.'}</p>}
    </>}
  </section>
}
