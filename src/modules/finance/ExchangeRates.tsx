import { useEffect, useState } from 'react'
import { updateSettings, useSettings } from '../../settings'
import { fetchRates, readRatesCache, type RateSource, type RatesSnapshot } from '../../infrastructure/rates'
import { Eye, EyeOff, RefreshCw, TrendingUp } from 'lucide-react'

const fmt = (n: number) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const fmtDate = (iso: string) => new Date(iso).toLocaleString('es-VE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function ExchangeRates() {
  const [snap, setSnap] = useState<RatesSnapshot | null>(readRatesCache)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const visible = useSettings().ratesVisible
  function toggle() { updateSettings({ ratesVisible: !visible }) }

  async function load() {
    setLoading(true); setFailed(false)
    try {
      const next = await fetchRates()
      setSnap(next)
    } catch { setFailed(true) } finally { setLoading(false) }
  }
  useEffect(() => { if (visible) void load() }, [visible])

  const rate = (f: RateSource) => snap?.rates.find((r) => r.fuente === f)
  const items: { key: RateSource; label: string }[] = [{ key: 'oficial', label: 'Dólar oficial (BCV)' }, { key: 'paralelo', label: 'Dólar paralelo' }]

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
