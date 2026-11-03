import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, CircleHelp, FileBarChart2, HandCoins, LayoutDashboard, ListFilter, Menu, Plus, Search, Settings2, ShieldCheck, Users, Wallet, X } from 'lucide-react'
import { balanceAt, contributionPaymentSchema, convertUsdMinorToVesMinor, convertVesMinorToUsdMinor, formatMoney, movementSchema, obligationSchema, participantSchema, parseAmountToMinor, summarizePeriod, type Contribution, type ContributionBatch, type ContributionPeriod, type FinancialAccount, type FinancialMovement, type MovementType, type ObligationSchedule, type Participant } from '../../domain/finance'
import { ensureInitialAccounts, ensureInitialObligations, financeRepository, obligationRepository, participantRepository } from '../../infrastructure/database'
import { contributionRepository } from '../../infrastructure/contributions'
import './participants.css'
import './contributions.css'

const links = [
  { label: 'Resumen', icon: LayoutDashboard }, { label: 'Libro financiero', icon: BookOpen },
  { label: 'Aportes mensuales', icon: HandCoins }, { label: 'Participantes', icon: Users },
  { label: 'Reportes', icon: FileBarChart2 }, { label: 'Respaldo', icon: ShieldCheck }, { label: 'Configuración', icon: Settings2 },
]
const monthStart = (month: string) => `${month}-01`
const monthEnd = (month: string) => `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}`
const todayLocal = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}` }
const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const periodKey = ({year,month}: ContributionPeriod) => `${year}-${String(month).padStart(2,'0')}`

export default function App() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [movements, setMovements] = useState<FinancialMovement[]>([])
  const [ready, setReady] = useState(false)
  const [activePage, setActivePage] = useState('Libro financiero')
  const [accountId, setAccountId] = useState('all')
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'new' | 'edit' | 'opening' | null>(null)
  const [selected, setSelected] = useState<FinancialMovement | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')

  async function refresh() {
    const [a, m] = await Promise.all([financeRepository.accounts(), financeRepository.movements()])
    setAccounts(a); setMovements(m); setReady(true)
  }
  useEffect(() => { Promise.all([ensureInitialAccounts(), ensureInitialObligations()]).then(async () => { await refresh(); if (navigator.storage?.persist) void navigator.storage.persist() }).catch(() => setNotice('No fue posible abrir la base local. Revisa la configuración de privacidad del navegador.')) }, [])

  const periodStart = monthStart(period)
  const periodEnd = monthEnd(period)
  const visibleAccounts = accounts.filter((a) => accountId === 'all' || a.id === accountId)
  const summaries = visibleAccounts.map((a) => ({ account: a, ...summarizePeriod(a, movements, periodStart, periodEnd) }))
  const rows = movements.filter((m) => (accountId === 'all' || m.accountId === accountId)
    && m.date >= periodStart && m.date <= periodEnd && m.description.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const currentPage = activePage === 'Resumen' ? 'Resumen' : activePage

  async function remove(movement: FinancialMovement) {
    if (!window.confirm(`¿Eliminar el movimiento «${movement.description}»? Esta acción no se puede deshacer.`)) return
    await financeRepository.removeMovement(movement.id); await refresh(); setNotice('Movimiento eliminado')
  }
  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3500) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark">T</div><div><strong>reportesTOC</strong><small>Tercera Orden Carmelita</small></div><button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
      <div className="workspace-label">ADMINISTRACIÓN</div>
      <nav>{links.map(({ label, icon: Icon }) => <button key={label} className={`nav-link ${activePage === label ? 'active' : ''}`} onClick={() => { setActivePage(label); setMobileNav(false) }}><Icon size={18}/><span>{label}</span>{label === 'Libro financiero' && <span className="nav-current"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-card"><ShieldCheck size={17}/><div><strong>Datos en este dispositivo</strong><span>Guardado local · sin conexión</span></div></div><button className="help-link" onClick={() => notify('Los datos se guardan en IndexedDB de este navegador. Exportación de respaldo pendiente.') }><CircleHelp size={17}/> Ayuda y privacidad</button></div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Cerrar navegación"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={20}/></button><div className="breadcrumb">Inicio <span>/</span> <strong>{currentPage}</strong></div><div className="topbar-right"><span className="offline-pill"><i/> Guardado local</span><div className="avatar">TO</div></div></header>
      <div className="page-content">
        {activePage === 'Libro financiero' ? <>
          <div className="page-heading"><div><div className="eyebrow">GESTIÓN FINANCIERA</div><h1>Libro financiero</h1><p>Controla los ingresos y egresos de cada cuenta.</p></div><button className="button primary" onClick={() => { setSelected(null); setModal('new') }}><Plus size={17}/> Nuevo movimiento</button></div>
          <section className="account-grid">{accounts.map((a) => { const hasMovements = movements.some((m) => m.accountId === a.id); return <article key={a.id} className="account-card"><div className="card-top"><span className={`account-icon ${a.currency.toLowerCase()}`}><Wallet size={18}/></span><span className="currency-tag">{a.currency}</span></div><div className="account-name">{a.name}</div><div className="account-balance">{formatMoney(balanceAt(a, movements), a.currency)}</div><div className="account-meta">Saldo actual <button disabled={hasMovements} title={hasMovements ? 'Bloqueado luego del primer movimiento' : undefined} onClick={() => { setSelected(null); setModal('opening'); setAccountId(a.id) }}>{hasMovements ? 'Saldo inicial bloqueado' : 'Configurar saldo inicial'}</button></div></article> })}</section>
          <section className="summary-strip"><div className="summary-title"><CalendarDays size={17}/><span>Resumen del período</span></div><label className="month-picker"><input type="month" value={period} onChange={(e) => setPeriod(e.target.value)}/><ChevronDown size={14}/></label><div className="summary-stats">{summaries.map((s) => <div className="summary-item" key={s.account.id}><span>{s.account.name}</span><div><span className="income-text"><ArrowDownLeft size={13}/>{formatMoney(s.income, s.account.currency)}</span><span className="expense-text"><ArrowUpRight size={13}/>{formatMoney(s.expense, s.account.currency)}</span></div></div>)}</div></section>
          <section className="ledger-panel"><div className="ledger-header"><div><h2>Movimientos</h2><span>{rows.length} registros en el período</span></div><div className="table-controls"><label className="select-wrap"><ListFilter size={15}/><select value={accountId} onChange={(e) => setAccountId(e.target.value)}><option value="all">Todas las cuentas</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select><ChevronDown size={14}/></label><label className="search-box"><Search size={15}/><input placeholder="Buscar concepto" value={search} onChange={(e) => setSearch(e.target.value)}/></label></div></div>
            <div className="table-scroll"><table><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>CUENTA</th><th className="numeric">DEBE</th><th className="numeric">HABER</th><th className="numeric">SALDO</th><th/></tr></thead><tbody>{!ready ? <tr><td colSpan={7} className="empty-state">Cargando libro local…</td></tr> : rows.length === 0 ? <tr><td colSpan={7} className="empty-state"><span className="empty-icon"><BookOpen size={21}/></span><strong>{movements.length ? 'No hay movimientos para estos filtros' : 'Aún no hay movimientos'}</strong><span>Registra un ingreso o egreso para empezar a llevar el libro.</span>{movements.length === 0 && <button className="button subtle" onClick={() => setModal('new')}><Plus size={15}/> Registrar primer movimiento</button>}</td></tr> : rows.map((m) => {
              const a = accountById.get(m.accountId)!
              const accurateBalance = a.openingBalanceMinor + movements.filter((x) => x.accountId === a.id && (x.date < m.date || (x.date === m.date && (x.createdAt < m.createdAt || (x.createdAt === m.createdAt && x.id <= m.id))))).reduce((s, x) => s + (x.type === 'income' ? x.amountMinor : -x.amountMinor), 0)
              return <tr key={m.id}><td className="date-cell">{new Date(`${m.date}T12:00:00`).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'numeric'})}</td><td><div className="concept-cell"><span className={`type-mark ${m.type}`} >{m.type === 'income' ? <ArrowDownLeft size={15}/> : <ArrowUpRight size={15}/>}</span><span><strong>{m.description}</strong>{m.notes && <small>{m.notes}</small>}</span></div></td><td><span className="account-chip">{a.name}</span></td><td className="numeric money-positive">{m.type === 'income' ? formatMoney(m.amountMinor,a.currency) : '—'}</td><td className="numeric money-negative">{m.type === 'expense' ? formatMoney(m.amountMinor,a.currency) : '—'}</td><td className="numeric balance-cell">{formatMoney(accurateBalance,a.currency)}</td><td><div className="row-actions"><button onClick={() => { setSelected(m); setModal('edit') }} aria-label="Editar movimiento">Editar</button><button onClick={() => remove(m)} aria-label="Eliminar movimiento">Eliminar</button></div></td></tr>
            })}</tbody></table></div>
            <div className="ledger-footer">{summaries.map((s) => <div key={s.account.id} className="footer-account"><span>{s.account.name} · saldo inicial {formatMoney(s.opening,s.account.currency)}</span><strong>Saldo final: {formatMoney(s.closing,s.account.currency)}</strong></div>)}</div>
          </section>
        </> : activePage === 'Participantes' ? <ParticipantsPage /> : activePage === 'Aportes mensuales' ? <ContributionsPage /> : <Placeholder page={activePage} onGo={() => setActivePage('Libro financiero')} />}
        <footer className="page-footer">reportesTOC <span>·</span> Versión inicial local <span>·</span> Sin conexión requerida</footer>
      </div>
    </main>
    {modal && <MovementModal mode={modal} account={accounts.find((a) => a.id === accountId) ?? accounts[0]} accounts={accounts} movement={selected} onClose={() => setModal(null)} onSaved={async (message) => { await refresh(); setModal(null); notify(message) }}/>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}

function Placeholder({ page, onGo }: { page: string; onGo: () => void }) {
  return <div className="placeholder-page"><div className="eyebrow">REPORTESTOC</div><h1>{page}</h1><div className="placeholder-card"><span className="empty-icon"><BookOpen size={22}/></span><h2>Este módulo todavía no está implementado</h2><p>El libro financiero, el padrón y el control de aportes ya están disponibles. Este módulo se añadirá en una fase posterior.</p><button className="button primary" onClick={onGo}>Ir al libro financiero</button></div></div>
}

function ContributionsPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [monthFilter, setMonthFilter] = useState('all')
  const [participantFilter, setParticipantFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all'|'paid'|'pending'>('all')
  const [participants, setParticipants] = useState<Participant[]>([])
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [batches, setBatches] = useState<ContributionBatch[]>([])
  const [payment, setPayment] = useState<{participantId?:string; periods:ContributionPeriod[]}|null>(null)
  const [detailsBatchId, setDetailsBatchId] = useState<string|null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const currentMonth = new Date().getMonth()+1
  const thisMonthKey = periodKey({year:currentYear,month:currentMonth})

  async function refresh() {
    const [people, paid, history] = await Promise.all([participantRepository.list(), contributionRepository.forYear(year), contributionRepository.recentBatches()])
    setParticipants(people); setContributions(paid); setBatches(history); setReady(true); setLoadError('')
  }
  useEffect(() => { setReady(false); void refresh().catch(() => { setReady(true); setLoadError('No fue posible cargar los aportes locales.') }) }, [year])

  const activeParticipants = participants.filter((person) => person.active)
  const contributionByKey = new Map(contributions.map((item) => [`${item.participantId}:${item.year}-${String(item.month).padStart(2,'0')}`, item]))
  const participantById = new Map(participants.map((item) => [item.id,item]))
  const periods = Array.from({length:12}, (_,index) => ({year, month:index+1}))
  const eligibleFor = (_person:Participant, p:ContributionPeriod) => periodKey(p) <= thisMonthKey
  const totalEligible = activeParticipants.reduce((sum,person) => sum+periods.filter((p) => eligibleFor(person,p)).length,0)
  const paidCount = contributions.filter((item) => activeParticipants.some((person) => person.id===item.participantId)).length
  const usdReceived = contributions.filter((item) => item.paymentCurrency==='USD').reduce((sum,item) => sum+item.amountPaidMinor,0)
  const vesReceived = contributions.filter((item) => item.paymentCurrency==='VES').reduce((sum,item) => sum+item.amountPaidMinor,0)
  const vesEquivalent = contributions.filter((item) => item.paymentCurrency==='VES' && item.exchangeRate).reduce((sum,item) => sum+convertVesMinorToUsdMinor(item.amountPaidMinor,item.exchangeRate!),0)

  const filteredParticipants = participants.filter((person) => participantFilter==='all' || person.id===participantFilter).filter((person) => {
    const inspected = monthFilter==='all' ? periods.filter((p) => eligibleFor(person,p)) : periods.filter((p) => p.month===Number(monthFilter) && eligibleFor(person,p))
    if (statusFilter==='all') return true
    return inspected.some((p) => {
      const paid = contributionByKey.has(`${person.id}:${periodKey(p)}`)
      return statusFilter==='paid' ? paid : !paid
    })
  })
  const visiblePeriods = monthFilter==='all' ? periods : periods.filter((p) => p.month===Number(monthFilter))

  return <>
    <div className="page-heading"><div><div className="eyebrow">CONTROL ADMINISTRATIVO</div><h1>Aportes mensuales</h1><p>Consulta y registra los meses cumplidos por cada participante.</p></div><button className="button primary" disabled={!activeParticipants.length} onClick={() => setPayment({periods:[]})}><Plus size={17}/> Registrar pago de varios meses</button></div>
    {loadError && <div className="form-error" role="alert">{loadError}</div>}
    <section className="contribution-stats"><div><span>Obligaciones del año</span><strong>{totalEligible}</strong></div><div><span>Meses pagados</span><strong>{paidCount}</strong></div><div><span>Meses sin registro</span><strong>{Math.max(0,totalEligible-paidCount)}</strong></div><div><span>Recibido en USD</span><strong>{formatMoney(usdReceived,'USD')}</strong></div><div><span>Recibido en VES</span><strong>{formatMoney(vesReceived,'VES')}</strong></div><div><span>Equivalente USD de pagos VES</span><strong>{formatMoney(vesEquivalent,'USD')}</strong></div></section>
    <section className="ledger-panel contribution-panel"><div className="ledger-header contribution-header"><div><h2>Matriz anual</h2><span>Las celdas sin pago muestran “Sin registro”; selecciona un mes pasado o vigente para registrarlo.</span></div><div className="contribution-filters"><label className="field-label">Año<input type="number" min="2000" max={currentYear} value={year} onChange={(e) => setYear(Math.max(2000,Math.min(currentYear,Number(e.target.value)||currentYear)))}/></label><label className="field-label">Participante<select value={participantFilter} onChange={(e) => setParticipantFilter(e.target.value)}><option value="all">Todos</option>{participants.map((p)=><option value={p.id} key={p.id}>{p.firstName} {p.lastName}{p.active?'':' · Inactivo'}</option>)}</select></label><label className="field-label">Estado<select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}><option value="all">Todos</option><option value="paid">Con pago</option><option value="pending">Sin registro</option></select></label><label className="field-label">Mes<select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}><option value="all">Año completo</option>{monthNames.map((m,index)=><option value={index+1} key={m}>{m}</option>)}</select></label></div></div>
      <div className="contribution-matrix-scroll"><table className="contribution-matrix"><thead><tr><th className="matrix-person-heading">PARTICIPANTE</th>{visiblePeriods.map((p)=><th key={p.month}>{monthNames[p.month-1].slice(0,3).toUpperCase()}</th>)}<th className="matrix-action-heading">ACCIÓN</th></tr></thead><tbody>{!ready ? <tr><td colSpan={visiblePeriods.length+2} className="empty-state">Cargando matriz…</td></tr> : filteredParticipants.length===0 ? <tr><td colSpan={visiblePeriods.length+2} className="empty-state"><span className="empty-icon"><HandCoins size={21}/></span><strong>{participants.length ? 'No hay participantes con estos filtros' : 'Aún no hay participantes'}</strong><span>Agrega participantes en el padrón para consultar y registrar sus aportes.</span></td></tr> : filteredParticipants.map((person)=><tr key={person.id}><td className="matrix-person"><span className="person-avatar">{person.firstName[0]}{person.lastName[0]}</span><span><strong>{person.firstName} {person.lastName}</strong>{!person.active&&<small className="inactive-person-label">Inactivo · solo consulta</small>}</span></td>{visiblePeriods.map((p)=>{const key=`${person.id}:${periodKey(p)}`; const entry=contributionByKey.get(key); const eligible=eligibleFor(person,p); return <td className="matrix-cell" key={p.month}>{entry ? <button className={`contribution-mark ${entry.paymentCurrency.toLowerCase()}`} title={`Pagado en ${entry.paymentCurrency}; ver detalle`} onClick={()=>setDetailsBatchId(entry.paymentBatchId)}><span>✓</span><small>{entry.paymentCurrency}</small></button> : eligible&&person.active ? <button className="contribution-empty" title={`Sin registro · ${monthNames[p.month-1]} ${p.year} · Registrar pago`} onClick={()=>setPayment({participantId:person.id,periods:[p]})}>+</button> : <span className="contribution-not-eligible" aria-label={person.active?'Período no disponible':'Sin registro para participante inactivo'}>—</span>}</td>})}<td className="matrix-row-action">{person.active?<button onClick={()=>setPayment({participantId:person.id,periods:[]})}>Registrar meses</button>:<span className="inactive-row-action">Solo consulta</span>}</td></tr>)}</tbody></table></div>
      <div className="matrix-legend"><span><i className="legend-usd"/> Pagado en USD</span><span><i className="legend-ves"/> Pagado en VES</span><span><i className="legend-empty"/> Sin registro</span><small>Un aporte no crea un movimiento en el libro financiero.</small></div>
    </section>
    <section className="ledger-panel payment-history-panel"><div className="ledger-header"><div><h2>Historial de pagos</h2><span>{batches.length} operaciones registradas</span></div></div><div className="table-scroll"><table className="payment-history-table"><thead><tr><th>FECHA</th><th>PARTICIPANTE</th><th>MESES CUBIERTOS</th><th>MONEDA</th><th className="numeric">TOTAL</th><th>ESTADO</th><th/></tr></thead><tbody>{batches.length===0?<tr><td colSpan={7} className="empty-state">Todavía no hay pagos registrados.</td></tr>:batches.slice(0,20).map((batch)=><RecentPaymentRow key={batch.id} batch={batch} participantName={participantById.has(batch.participantId) ? `${participantById.get(batch.participantId)!.firstName} ${participantById.get(batch.participantId)!.lastName}` : 'Participante'} onOpen={()=>setDetailsBatchId(batch.id)}/>)}</tbody></table></div></section>
    {payment && <ContributionPaymentModal initialParticipantId={payment.participantId} initialPeriods={payment.periods} onClose={()=>setPayment(null)} onSaved={async(batchId)=>{await refresh();setPayment(null);setDetailsBatchId(batchId)}}/>}
    {detailsBatchId && <ContributionDetailsModal batchId={detailsBatchId} onClose={()=>setDetailsBatchId(null)} onChanged={refresh}/>}
  </>
}

function RecentPaymentRow({batch,participantName,onOpen}:{batch:ContributionBatch;participantName:string;onOpen:()=>void}){
  const [periods,setPeriods]=useState<ContributionPeriod[]>([])
  useEffect(()=>{void (async()=>{const active=await contributionRepository.periodsForBatch(batch.id);const history=active.length?active:await contributionRepository.historyForBatch(batch.id);setPeriods(history.map(({year,month})=>({year,month})))})()},[batch.id])
  return <tr><td>{new Date(`${batch.paymentDate}T12:00:00`).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'numeric'})}</td><td>{participantName}</td><td>{periods.map((p)=>`${monthNames[p.month-1].slice(0,3)} ${p.year}`).join(', ')||'—'}</td><td><span className={`payment-currency ${batch.currency.toLowerCase()}`}>{batch.currency}</span></td><td className="numeric">{formatMoney(batch.totalAmountMinor,batch.currency)}</td><td><span className={`status-badge ${batch.status==='paid'?'active':'inactive'}`}><i/>{batch.status==='paid'?'Pagado':'Anulado'}</span></td><td><button className="history-detail-button" onClick={onOpen}>Ver detalle</button></td></tr>
}

function ContributionPaymentModal({initialParticipantId,initialPeriods,onClose,onSaved}:{initialParticipantId?:string;initialPeriods:ContributionPeriod[];onClose:()=>void;onSaved:(batchId:string)=>Promise<void>}){
  const [participants,setParticipants]=useState<Participant[]>([])
  const [schedules,setSchedules]=useState<ObligationSchedule[]>([])
  const [paid,setPaid]=useState<Contribution[]>([])
  const [participantId,setParticipantId]=useState(initialParticipantId??'')
  const [selectedKeys,setSelectedKeys]=useState(initialPeriods.map(periodKey))
  const [currency,setCurrency]=useState<'USD'|'VES'>('USD')
  const [rate,setRate]=useState('')
  const [rateSource,setRateSource]=useState('')
  const [paymentDate,setPaymentDate]=useState(todayLocal())
  const [notes,setNotes]=useState('')
  const [ready,setReady]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{void Promise.all([participantRepository.list(),obligationRepository.list()]).then(([people,values])=>{setParticipants(people.filter((person)=>person.active));setSchedules(values);if(!initialParticipantId)setParticipantId(people.find((person)=>person.active)?.id??'')}).catch(()=>setError('No se pudo cargar el formulario local.'))},[])
  useEffect(()=>{if(!participantId){setPaid([]);setReady(true);return} setReady(false);void contributionRepository.forParticipant(participantId).then((items)=>{setPaid(items);setReady(true)}).catch(()=>{setError('No se pudieron consultar los meses registrados.');setReady(true)})},[participantId])
  const participant=participants.find((person)=>person.id===participantId)
  const currentKey=currentMonthLocal()
  const availablePeriods:ContributionPeriod[]=[]
  if(participant){let year=2000;let month=1;while(`${year}-${String(month).padStart(2,'0')}`<=currentKey){availablePeriods.push({year,month});month++;if(month>12){year++;month=1}}}
  const paidKeys=new Set(paid.map((item)=>periodKey(item)))
  const unpaidPeriods=availablePeriods.filter((period)=>!paidKeys.has(periodKey(period)))
  const grouped=new Map<number,ContributionPeriod[]>()
  for(const period of unpaidPeriods){const list=grouped.get(period.year)??[];list.push(period);grouped.set(period.year,list)}
  const selectedPeriods=unpaidPeriods.filter((period)=>selectedKeys.includes(periodKey(period)))
  const assignments=selectedPeriods.map((period)=>{const key=periodKey(period);const obligation=[...schedules].filter((item)=>item.effectiveMonth<=key).sort((a,b)=>a.effectiveMonth.localeCompare(b.effectiveMonth)).at(-1);const requiredUsdMinor=obligation?.amountUsdMinor??100;const amountPaidMinor=currency==='USD'?requiredUsdMinor:(rate?convertUsdMinorToVesMinor(requiredUsdMinor,rate):0);return {period,requiredUsdMinor,amountPaidMinor}})
  const totalMinor=assignments.reduce((sum,item)=>sum+item.amountPaidMinor,0)
  function togglePeriod(period:ContributionPeriod){const key=periodKey(period);setSelectedKeys((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key])}
  async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);try{const input=contributionPaymentSchema.parse({participantId,periods:selectedPeriods,paymentDate,currency,exchangeRate:currency==='VES'?rate:undefined,rateSource:rateSource.trim()||undefined,notes:notes.trim()||undefined});const batch=await contributionRepository.registerPayment(input);await onSaved(batch.id)}catch(err){setError(err instanceof Error?err.message:'No se pudo registrar el pago')}finally{setBusy(false)}}
  const chosenYearGroups=[...grouped.entries()].sort((a,b)=>b[0]-a[0])
  return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><section className="modal payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title"><div className="modal-heading"><div><div className="eyebrow">CONTROL DE APORTES</div><h2 id="payment-modal-title">Registrar pago</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19}/></button></div><form onSubmit={submit}>
    <label className="field-label">Participante<select value={participantId} onChange={(e)=>{setParticipantId(e.target.value);setSelectedKeys([])}} disabled={Boolean(initialParticipantId)}>{participants.map((person)=><option key={person.id} value={person.id}>{person.firstName} {person.lastName}</option>)}</select></label>
    <div className="field-label">Meses a cubrir <span className="optional">Puedes elegir meses de distintos años</span></div>
    <div className="period-picker-list">{!ready?<p>Cargando períodos…</p>:!participant?<p>No hay participantes activos disponibles.</p>:chosenYearGroups.length===0?<p>No hay meses sin registro para este participante hasta el período actual.</p>:chosenYearGroups.map(([groupYear,items],index)=><details key={groupYear} open={index===0}><summary>{groupYear}<span>{items.filter((item)=>selectedKeys.includes(periodKey(item))).length} seleccionados</span></summary><div className="period-pills">{items.map((period)=><button type="button" key={period.month} className={selectedKeys.includes(periodKey(period))?'selected':''} onClick={()=>togglePeriod(period)}>{monthNames[period.month-1].slice(0,3)}</button>)}</div></details>)}</div>
    <div className="field-row"><label className="field-label">Fecha del pago<input type="date" value={paymentDate} max={todayLocal()} onChange={(e)=>setPaymentDate(e.target.value)} required/></label><div className="field-label">Moneda recibida<div className="segmented"><button type="button" className={currency==='USD'?'selected income-selected':''} onClick={()=>setCurrency('USD')}>USD</button><button type="button" className={currency==='VES'?'selected expense-selected':''} onClick={()=>setCurrency('VES')}>VES</button></div></div></div>
    {currency==='VES'&&<><label className="field-label">Tasa aplicada (VES por 1 USD)<input inputMode="decimal" value={rate} onChange={(e)=>setRate(e.target.value)} placeholder="Ej. 450,00" required/></label><label className="field-label">Fuente de la tasa <span className="optional">Opcional</span><input value={rateSource} onChange={(e)=>setRateSource(e.target.value)} maxLength={120} placeholder="Referencia o fuente utilizada"/></label></>}
    <label className="field-label">Nota <span className="optional">Opcional</span><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Detalle del pago, si hace falta"/></label>
    <div className="payment-confirmation"><div className="payment-confirmation-title">Resumen para confirmar</div><div className="payment-month-list">{assignments.length?assignments.map(({period,requiredUsdMinor,amountPaidMinor})=><span key={periodKey(period)}>{monthNames[period.month-1]} {period.year}<small>{currency==='USD'?formatMoney(amountPaidMinor,'USD'):`${formatMoney(requiredUsdMinor,'USD')} → ${formatMoney(amountPaidMinor,'VES')}`}</small></span>):<span>Selecciona uno o más meses para ver el total.</span>}</div><div className="payment-total"><span>Total de esta entrega</span><strong>{formatMoney(totalMinor,currency)}</strong></div></div>
    <p className="payment-separation-note">Este registro administrativo no modifica el libro financiero.</p>
    {error&&<div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||!ready||selectedPeriods.length===0||(currency==='VES'&&!rate)}>{busy?'Guardando…':'Confirmar pago'}</button></div>
  </form></section></div>
}

function ContributionDetailsModal({batchId,onClose,onChanged}:{batchId:string;onClose:()=>void;onChanged:()=>Promise<void>}){
  const [batch,setBatch]=useState<ContributionBatch|null>(null)
  const [entries,setEntries]=useState<Contribution[]>([])
  const [history,setHistory]=useState<Awaited<ReturnType<typeof contributionRepository.historyForBatch>>>([])
  const [participant,setParticipant]=useState<Participant|null>(null)
  const [error,setError]=useState('')
  async function load(){const [current,active,archived,people]=await Promise.all([contributionRepository.batch(batchId),contributionRepository.periodsForBatch(batchId),contributionRepository.historyForBatch(batchId),participantRepository.list()]);setBatch(current??null);setEntries(active);setHistory(archived);setParticipant(people.find((person)=>person.id===current?.participantId)??null)}
  useEffect(()=>{void load().catch(()=>setError('No se pudo cargar el detalle del pago.'))},[batchId])
  async function voidPayment(){if(!batch)return;const name=participant?`${participant.firstName} ${participant.lastName}`:'este participante';if(!window.confirm(`¿Anular el pago de ${name} por ${formatMoney(batch.totalAmountMinor,batch.currency)}? Se anulará el grupo completo; el detalle se conservará en el historial y los meses podrán registrarse nuevamente.`))return;try{await contributionRepository.voidBatch(batch.id);await onChanged();await load()}catch(err){setError(err instanceof Error?err.message:'No se pudo anular el pago')}}
  const shown=batch?.status==='void'?history:entries
  return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="payment-details-title"><div className="modal-heading"><div><div className="eyebrow">HISTORIAL DE APORTES</div><h2 id="payment-details-title">Detalle del pago</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19}/></button></div>{!batch?<p>Cargando detalle…</p>:<><div className="payment-detail-person"><strong>{participant?`${participant.firstName} ${participant.lastName}`:'Participante'}</strong><span className={`status-badge ${batch.status==='paid'?'active':'inactive'}`}><i/>{batch.status==='paid'?'Pagado':'Anulado'}</span></div><div className="payment-detail-grid"><div><span>Fecha real</span><strong>{new Date(`${batch.paymentDate}T12:00:00`).toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'})}</strong></div><div><span>Moneda recibida</span><strong>{batch.currency}</strong></div><div><span>Total de la entrega</span><strong>{formatMoney(batch.totalAmountMinor,batch.currency)}</strong></div>{batch.exchangeRate&&<div><span>Tasa histórica</span><strong>{batch.exchangeRate} VES/USD</strong></div>}{batch.rateSource&&<div><span>Fuente de la tasa</span><strong>{batch.rateSource}</strong></div>}</div><div className="payment-detail-months"><strong>Meses cubiertos</strong>{shown.map((entry)=><div key={entry.id}><span>{monthNames[entry.month-1]} {entry.year}</span><span>{formatMoney(entry.requiredUsdMinor,'USD')}<small> obligación</small></span><span>{formatMoney(entry.amountPaidMinor,entry.paymentCurrency)}<small> recibido</small></span></div>)}{shown.length===0&&<span>No hay meses activos asociados.</span>}</div>{batch.notes&&<div className="callout">{batch.notes}</div>}{batch.status==='void'&&<div className="callout">Anulado el {history[0]?.voidedAt ? new Date(history[0].voidedAt).toLocaleString('es-VE') : '—'}. El registro se conserva para consulta.</div>}{error&&<div className="form-error" role="alert">{error}</div>}<div className="modal-actions">{batch.status==='paid'&&<button type="button" className="button danger-button" onClick={()=>void voidPayment()}>Anular pago completo</button>}<button className="button secondary" onClick={onClose}>Cerrar</button></div></>}</section></div>
}

function ParticipantsPage() {
  const [participants, setParticipants] = useState<Awaited<ReturnType<typeof participantRepository.list>>>([])
  const [schedules, setSchedules] = useState<Awaited<ReturnType<typeof obligationRepository.list>>>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'active'|'inactive'|'all'>('active')
  const [participantDialog, setParticipantDialog] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState<Awaited<ReturnType<typeof participantRepository.list>>[number] | null>(null)
  const [effectiveMonth, setEffectiveMonth] = useState(nextMonthLocal())
  const [amount, setAmount] = useState('1,00')
  const [editingSchedule, setEditingSchedule] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  async function refresh() {
    const [people, obligations] = await Promise.all([participantRepository.list(), obligationRepository.list()])
    setParticipants(people); setSchedules(obligations); setReady(true)
  }
  useEffect(() => { void refresh().catch(() => setError('No fue posible cargar la información local.')) }, [])

  const month = currentMonthLocal()
  const currentObligation = [...schedules].filter((item) => item.effectiveMonth <= month).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))[0]
  const filtered = participants.filter((person) => (status === 'all' || person.active === (status === 'active'))
    && `${person.firstName} ${person.lastName}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')))
  const upcoming = schedules.filter((item) => item.effectiveMonth > month).sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth))

  async function toggle(person: (typeof participants)[number]) {
    const nextState = !person.active
    if (!nextState && !window.confirm(`¿Desactivar a ${person.firstName} ${person.lastName}? Se conservará su historial y podrá reactivarse después.`)) return
    await participantRepository.setActive(person.id, nextState)
    await refresh()
  }
  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault(); setError('')
    try {
      const input = obligationSchema.parse({ effectiveMonth, amountUsdMinor: parseAmountToMinor(amount, 'USD') })
      await obligationRepository.saveFuture(input, editingSchedule)
      setEditingSchedule(undefined); setEffectiveMonth(nextMonthLocal()); setAmount('1,00')
      await refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la obligación') }
  }
  async function deleteSchedule(id: string, label: string) {
    if (!window.confirm(`¿Eliminar la obligación programada para ${label}?`)) return
    await obligationRepository.removeFuture(id); setEditingSchedule(undefined); setEffectiveMonth(nextMonthLocal()); setAmount('1,00'); await refresh()
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">PADRÓN Y OBLIGACIONES</div><h1>Participantes</h1><p>Administra el padrón y las obligaciones mensuales.</p></div><button className="button primary" onClick={() => { setSelectedParticipant(null); setParticipantDialog(true) }}><Plus size={17}/> Nuevo participante</button></div>
    <section className="participant-summary"><div className="participant-summary-icon"><Users size={19}/></div><div><span>Participantes activos</span><strong>{participants.filter((person) => person.active).length}</strong></div><div className="participant-summary-rule"/><div><span>Obligación vigente desde {currentObligation?.effectiveMonth ?? month}</span><strong>{formatMoney(currentObligation?.amountUsdMinor ?? 100, 'USD')} <small>por persona / mes</small></strong></div></section>
    <section className="ledger-panel participant-panel"><div className="ledger-header"><div><h2>Padrón de participantes</h2><span>{filtered.length} {status === 'active' ? 'activos' : status === 'inactive' ? 'inactivos' : 'participantes'}</span></div><div className="table-controls"><label className="select-wrap"><ListFilter size={15}/><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select><ChevronDown size={14}/></label><label className="search-box"><Search size={15}/><input placeholder="Buscar participante" value={query} onChange={(e) => setQuery(e.target.value)}/></label></div></div>
      <div className="table-scroll"><table className="people-table"><thead><tr><th>PARTICIPANTE</th><th>ESTADO</th><th>FECHA DE REGISTRO</th><th>NOTAS</th><th/></tr></thead><tbody>{!ready ? <tr><td colSpan={5} className="empty-state">Cargando padrón local…</td></tr> : filtered.length === 0 ? <tr><td colSpan={5} className="empty-state"><span className="empty-icon"><Users size={21}/></span><strong>{participants.length ? 'No hay participantes con estos filtros' : 'Aún no hay participantes'}</strong><span>Agrega una persona para preparar el control mensual de aportes.</span>{participants.length === 0 && <button className="button subtle" onClick={() => { setSelectedParticipant(null); setParticipantDialog(true) }}><Plus size={15}/> Agregar participante</button>}</td></tr> : filtered.map((person) => <tr key={person.id}><td><div className="person-name"><span className="person-avatar">{person.firstName[0]}{person.lastName[0]}</span><strong>{person.firstName} {person.lastName}</strong></div></td><td><span className={`status-badge ${person.active ? 'active' : 'inactive'}`}><i/>{person.active ? 'Activo' : 'Inactivo'}</span></td><td>{new Date(person.createdAt).toLocaleDateString('es-VE',{day:'2-digit',month:'short',year:'numeric'})}</td><td className="participant-notes">{person.notes || '—'}</td><td><div className="participant-actions"><button onClick={() => { setSelectedParticipant(person); setParticipantDialog(true) }}>Editar</button><button onClick={() => void toggle(person)}>{person.active ? 'Desactivar' : 'Reactivar'}</button></div></td></tr>)}</tbody></table></div>
    </section>
    <section className="ledger-panel obligations-panel"><div className="ledger-header"><div><h2>Obligación mensual</h2><span>Las nuevas tarifas solo se aplican a períodos futuros.</span></div></div><div className="obligation-content"><form className="obligation-form" onSubmit={saveSchedule}><div className="field-row"><label className="field-label">Vigente desde<input type="month" min={nextMonthLocal()} value={effectiveMonth} onChange={(e) => setEffectiveMonth(e.target.value)}/></label><label className="field-label">Monto mensual (USD)<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1,00"/></label></div><div className="obligation-form-footer"><span>Por cada participante · valor predeterminado: 1,00 USD</span><div>{editingSchedule && <button type="button" className="button secondary" onClick={() => { setEditingSchedule(undefined); setEffectiveMonth(nextMonthLocal()); setAmount('1,00'); setError('') }}>Cancelar edición</button>}<button className="button primary"><Plus size={15}/>{editingSchedule ? 'Guardar cambio' : 'Programar monto'}</button></div></div></form>
      {error && <div className="form-error obligation-error" role="alert">{error}</div>}
      {upcoming.length > 0 && <div className="upcoming-list"><div className="upcoming-title">Cambios programados</div>{upcoming.map((item) => <div className="upcoming-row" key={item.id}><span>{item.effectiveMonth}</span><strong>{formatMoney(item.amountUsdMinor, 'USD')}</strong><div><button onClick={() => { setEditingSchedule(item.id); setEffectiveMonth(item.effectiveMonth); setAmount((item.amountUsdMinor / 100).toFixed(2).replace('.', ',')); setError('') }}>Editar</button><button onClick={() => void deleteSchedule(item.id, item.effectiveMonth)}>Eliminar</button></div></div>)}</div>}
    </div></section>
    {participantDialog && <ParticipantModal participant={selectedParticipant} onClose={() => setParticipantDialog(false)} onSaved={async () => { await refresh(); setParticipantDialog(false) }}/>}
  </>
}

function currentMonthLocal() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }
function nextMonthLocal() { const date = new Date(); date.setDate(1); date.setMonth(date.getMonth()+1); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}` }

function ParticipantModal({ participant, onClose, onSaved }: { participant: Awaited<ReturnType<typeof participantRepository.list>>[number] | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [firstName, setFirstName] = useState(participant?.firstName ?? '')
  const [lastName, setLastName] = useState(participant?.lastName ?? '')
  const [notes, setNotes] = useState(participant?.notes ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const input = participantSchema.parse({ firstName, lastName, notes: notes.trim() || undefined })
      await participantRepository.save(input, participant?.id)
      await onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'Revisa los datos e inténtalo de nuevo') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="participant-modal-title"><div className="modal-heading"><div><div className="eyebrow">PADRÓN</div><h2 id="participant-modal-title">{participant ? 'Editar participante' : 'Nuevo participante'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19}/></button></div><form onSubmit={submit}><label className="field-label">Nombres<input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} required/></label><label className="field-label">Apellidos<input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} required/></label><label className="field-label">Notas <span className="optional">Opcional</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="Información administrativa opcional"/></label>{error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : participant ? 'Guardar cambios' : 'Agregar participante'}</button></div></form></section></div>
}

function MovementModal({ mode, account: initialAccount, accounts, movement, onClose, onSaved }: { mode: 'new'|'edit'|'opening'; account?: FinancialAccount; accounts: FinancialAccount[]; movement: FinancialMovement|null; onClose: () => void; onSaved: (message: string) => void }) {
  const isOpening = mode === 'opening'
  const [accountId, setAccountId] = useState(movement?.accountId ?? initialAccount?.id ?? accounts[0]?.id ?? '')
  const account = accounts.find((a) => a.id === accountId)
  const [type, setType] = useState<MovementType>(movement?.type ?? 'income')
  const [date, setDate] = useState(movement?.date ?? todayLocal())
  const [description, setDescription] = useState(movement?.description ?? '')
  const [amount, setAmount] = useState(movement ? (movement.amountMinor / 100).toFixed(2) : '')
  const [notes, setNotes] = useState(movement?.notes ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setBusy(true)
    try {
      const amountMinor = parseAmountToMinor(amount, account?.currency ?? 'USD', isOpening)
      if (isOpening) { await financeRepository.setOpeningBalance(accountId, amountMinor); await onSaved('Saldo inicial guardado'); return }
      const input = movementSchema.parse({ accountId, date, description, type, amountMinor, notes: notes.trim() || undefined })
      await financeRepository.saveMovement(input, movement?.id)
      await onSaved(mode === 'edit' ? 'Movimiento actualizado' : 'Movimiento registrado')
    } catch (err) { setError(err instanceof Error ? err.message : 'Revisa los datos e inténtalo de nuevo') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><div className="eyebrow">{isOpening ? 'CONFIGURACIÓN DE CUENTA' : 'LIBRO FINANCIERO'}</div><h2 id="modal-title">{isOpening ? 'Saldo inicial' : mode === 'edit' ? 'Editar movimiento' : 'Nuevo movimiento'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19}/></button></div>
    <form onSubmit={submit}><label className="field-label">Cuenta<select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={mode === 'edit' || isOpening}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
      {isOpening ? <><div className="callout">{account?.name} mantiene un saldo separado en {account?.currency}. El saldo inicial solo se debe configurar al comenzar a usar el sistema.</div><label className="field-label">Saldo inicial ({account?.currency})<input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required/></label></> : <>
        <div className="field-label">Tipo de movimiento<div className="segmented"><button type="button" className={type === 'income' ? 'selected income-selected' : ''} onClick={() => setType('income')}><ArrowDownLeft size={15}/> Ingreso</button><button type="button" className={type === 'expense' ? 'selected expense-selected' : ''} onClick={() => setType('expense')}><ArrowUpRight size={15}/> Egreso</button></div></div>
        <div className="field-row"><label className="field-label">Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required/></label><label className="field-label">Importe ({account?.currency})<input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required/></label></div>
        <label className="field-label">Concepto<input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Ej. Aporte recibido" required/></label><label className="field-label">Nota <span className="optional">Opcional</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Agrega un detalle si hace falta"/></label>
        <div className="callout">El importe se registra en <strong>{account?.currency}</strong> y solo modifica el saldo de <strong>{account?.name}</strong>.</div></>}
      {error && <div className="form-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{busy ? 'Guardando…' : isOpening ? 'Guardar saldo' : mode === 'edit' ? 'Guardar cambios' : 'Registrar movimiento'}</button></div>
    </form></section></div>
}
