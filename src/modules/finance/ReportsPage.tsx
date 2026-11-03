import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Filter } from 'lucide-react'
import { formatMoney } from '../../domain/finance'
import { buildContributionReport, buildFinanceReport } from '../../domain/reports'
import { contributionRepository } from '../../infrastructure/contributions'
import { financeRepository, participantRepository } from '../../infrastructure/database'
import { exportContributionsExcel, exportFinanceExcel } from '../../infrastructure/exports/excel'
import { exportContributionsPdf, exportFinancePdf } from '../../infrastructure/exports/pdf'
import './reports.css'

type ReportKind = 'book' | 'contributions'
type RangeKind = 'month' | 'year' | 'range' | 'all'
const localYear = new Date().getFullYear()
const today = new Date()
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
const monthEnd = (value: string) => `${value}-${new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)), 0).getDate()}`

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>('book')
  const [rangeKind, setRangeKind] = useState<RangeKind>('month')
  const [accountId, setAccountId] = useState('all')
  const [month, setMonth] = useState(currentMonth)
  const [year, setYear] = useState(localYear)
  const [from, setFrom] = useState(`${localYear}-01-01`)
  const [to, setTo] = useState(`${localYear}-12-31`)
  const [participantId, setParticipantId] = useState('all')
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof financeRepository.accounts>>>([])
  const [movements, setMovements] = useState<Awaited<ReturnType<typeof financeRepository.movements>>>([])
  const [participants, setParticipants] = useState<Awaited<ReturnType<typeof participantRepository.list>>>([])
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof contributionRepository.forYear>>>([])
  const [history, setHistory] = useState<Awaited<ReturnType<typeof contributionRepository.historyForYear>>>([])
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof contributionRepository.allBatches>>>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void Promise.all([financeRepository.accounts(), financeRepository.movements(), participantRepository.list(), contributionRepository.allBatches()])
      .then(([a, m, p, b]) => { setAccounts(a); setMovements(m); setParticipants(p); setBatches(b); setReady(true) })
      .catch(() => setError('No fue posible cargar los datos locales.'))
  }, [])
  useEffect(() => {
    let active = true
    void Promise.all([contributionRepository.forYear(year), contributionRepository.historyForYear(year)])
      .then(([paid, archived]) => { if (active) { setCurrent(paid); setHistory(archived) } })
      .catch(() => { if (active) setError('No fue posible cargar los aportes del año seleccionado.') })
    return () => { active = false }
  }, [year])

  const dateRange = useMemo(() => {
    if (rangeKind === 'month') return { from: `${month}-01`, to: monthEnd(month), label: month }
    if (rangeKind === 'year') return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) }
    if (rangeKind === 'all') return { from: '0001-01-01', to: '9999-12-31', label: 'Historial completo' }
    return { from, to, label: `${from} a ${to}` }
  }, [rangeKind, month, year, from, to])
  const financeReport = useMemo(() => buildFinanceReport(accounts, movements, { accountId, ...dateRange, periodLabel: dateRange.label }), [accounts, movements, accountId, dateRange])
  const contributionReport = useMemo(() => buildContributionReport(participants, current, history, year, participantId, batches), [participants, current, history, year, participantId, batches])
  const movementCount = financeReport.accounts.reduce((sum, item) => sum + item.movements.length, 0)

  async function download(format: 'pdf' | 'excel') {
    setBusy(true); setError(''); setNotice('')
    try {
      if (kind === 'book') {
        if (format === 'pdf') await exportFinancePdf(financeReport)
        else await exportFinanceExcel(financeReport)
      } else if (format === 'pdf') await exportContributionsPdf(contributionReport)
      else await exportContributionsExcel(contributionReport)
      setNotice('El archivo se generó y descargó correctamente.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo generar el archivo.') }
    finally { setBusy(false) }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">DOCUMENTOS Y CIERRES</div><h1>Reportes</h1><p>Prepara documentos imprimibles con los datos guardados en este dispositivo.</p></div></div>
    <section className="ledger-panel reports-panel">
      <div className="report-tabs" role="tablist" aria-label="Tipo de reporte">
        <button role="tab" aria-selected={kind === 'book'} className={kind === 'book' ? 'selected' : ''} onClick={() => { setKind('book'); setError(''); setNotice('') }}><FileText size={18}/> Libro financiero</button>
        <button role="tab" aria-selected={kind === 'contributions'} className={kind === 'contributions' ? 'selected' : ''} onClick={() => { setKind('contributions'); setError(''); setNotice('') }}><Filter size={18}/> Aportes</button>
      </div>
      {!ready ? <div className="report-empty">Cargando datos locales…</div> : kind === 'book' ? <>
        <div className="report-filter-grid">
          <label className="field-label">Cuenta<select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="all">Todas las cuentas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.currency}</option>)}</select></label>
          <label className="field-label">Período<select value={rangeKind} onChange={(e) => setRangeKind(e.target.value as RangeKind)}><option value="month">Mes</option><option value="year">Año</option><option value="range">Rango de fechas</option><option value="all">Historial completo</option></select></label>
          {rangeKind === 'month' && <label className="field-label">Mes<input type="month" value={month} onChange={(e) => setMonth(e.target.value)}/></label>}
          {rangeKind === 'year' && <label className="field-label">Año<input type="number" min="2000" max="9999" value={year} onChange={(e) => setYear(Number(e.target.value))}/></label>}
          {rangeKind === 'range' && <><label className="field-label">Desde<input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label><label className="field-label">Hasta<input type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label></>}
        </div>
        <div className="report-preview"><div><strong>{movementCount}</strong><span>movimientos</span></div><span>Período: {dateRange.label}</span><div className="report-balances">{financeReport.accounts.map((item) => <div key={item.account.id}><span>{item.account.name} · saldo de cierre</span><strong>{formatMoney(item.closing, item.account.currency)}</strong></div>)}</div></div>
      </> : <>
        <div className="report-filter-grid"><label className="field-label">Año<input type="number" min="2000" max="9999" value={year} onChange={(e) => setYear(Number(e.target.value))}/></label><label className="field-label">Participante<select value={participantId} onChange={(e) => setParticipantId(e.target.value)}><option value="all">Todos los participantes</option>{participants.map((person) => <option key={person.id} value={person.id}>{person.firstName} {person.lastName}{person.active ? '' : ' · Inactivo'}</option>)}</select></label></div>
        <div className="report-preview"><div><strong>{contributionReport.details.length}</strong><span>pagos e historial de anulaciones</span></div><span>Resumen de pagos registrados (anulados excluidos):</span><div className="report-balances"><div><span>USD recibido</span><strong>{formatMoney(contributionReport.currencySummary.usdMinor, 'USD')}</strong></div><div><span>VES recibido</span><strong>{formatMoney(contributionReport.currencySummary.vesMinor, 'VES')}</strong></div><div><span>VES equivalente informativo</span><strong>{formatMoney(contributionReport.currencySummary.vesEquivalentUsdMinor, 'USD')}</strong></div></div></div>
      </>}
      <div className="report-actions"><span>Los archivos se generan localmente y descargan en el navegador.</span><div><button className="button secondary" disabled={!ready || busy || (kind === 'book' && from > to && rangeKind === 'range')} onClick={() => void download('excel')}><FileSpreadsheet size={17}/>{busy ? 'Generando…' : 'Descargar Excel'}</button><button className="button primary" disabled={!ready || busy || (kind === 'book' && from > to && rangeKind === 'range')} onClick={() => void download('pdf')}><Download size={17}/>{busy ? 'Generando…' : 'Descargar PDF'}</button></div></div>
      {error && <div className="form-error report-message" role="alert">{error}</div>}{notice && <div className="report-success report-message" role="status">{notice}</div>}
    </section>
  </>
}
