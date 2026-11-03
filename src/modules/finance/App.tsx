import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, CircleHelp, FileBarChart2, HandCoins, LayoutDashboard, ListFilter, Menu, Plus, Search, Settings2, ShieldCheck, Users, Wallet, X } from 'lucide-react'
import { balanceAt, formatMoney, movementSchema, obligationSchema, participantSchema, parseAmountToMinor, summarizePeriod, type FinancialAccount, type FinancialMovement, type MovementType } from '../../domain/finance'
import { ensureInitialAccounts, ensureInitialObligations, financeRepository, obligationRepository, participantRepository } from '../../infrastructure/database'
import './participants.css'

const links = [
  { label: 'Resumen', icon: LayoutDashboard }, { label: 'Libro financiero', icon: BookOpen },
  { label: 'Aportes mensuales', icon: HandCoins }, { label: 'Participantes', icon: Users },
  { label: 'Reportes', icon: FileBarChart2 }, { label: 'Respaldo', icon: ShieldCheck }, { label: 'Configuración', icon: Settings2 },
]
const monthStart = (month: string) => `${month}-01`
const monthEnd = (month: string) => `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}`
const todayLocal = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}` }

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
        </> : activePage === 'Participantes' ? <ParticipantsPage /> : <Placeholder page={activePage} onGo={() => setActivePage('Libro financiero')} />}
        <footer className="page-footer">reportesTOC <span>·</span> Versión inicial local <span>·</span> Sin conexión requerida</footer>
      </div>
    </main>
    {modal && <MovementModal mode={modal} account={accounts.find((a) => a.id === accountId) ?? accounts[0]} accounts={accounts} movement={selected} onClose={() => setModal(null)} onSaved={async (message) => { await refresh(); setModal(null); notify(message) }}/>}
    {notice && <div className="toast" role="status">{notice}</div>}
  </div>
}

function Placeholder({ page, onGo }: { page: string; onGo: () => void }) {
  return <div className="placeholder-page"><div className="eyebrow">REPORTESTOC</div><h1>{page}</h1><div className="placeholder-card"><span className="empty-icon"><BookOpen size={22}/></span><h2>Este módulo todavía no está implementado</h2><p>La primera entrega se concentra en la base local y el libro financiero. Los demás módulos se incorporarán en etapas posteriores.</p><button className="button primary" onClick={onGo}>Ir al libro financiero</button></div></div>
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
