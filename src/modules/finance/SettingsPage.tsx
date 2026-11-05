import { useState } from 'react'
import { Compass, Landmark, Type } from 'lucide-react'
import InfoTip from './InfoTip'
import { DEFAULT_ORG, updateSettings, useSettings, type TextScale } from '../../settings'
import { formatMoney, balanceAt } from '../../domain/finance'
import type { FinancialAccount, FinancialMovement } from '../../domain/finance'
import { lastBackupDate } from '../../infrastructure/backup'
import { startTour } from '../../tour'

const scales: { value: TextScale; label: string; sample: number }[] = [
  { value: 'normal', label: 'Normal', sample: 17 },
  { value: 'large', label: 'Grande', sample: 20 },
  { value: 'xlarge', label: 'Muy grande', sample: 23 },
]

export default function SettingsPage({ accounts, movements, onOpening, onGoSummary }: { accounts: FinancialAccount[]; movements: FinancialMovement[]; onOpening: (accountId: string) => void; onGoSummary: () => void }) {
  const s = useSettings()
  const [org, setOrg] = useState(s.orgName)
  const [responsible, setResponsible] = useState(s.responsible)
  const [saved, setSaved] = useState(false)
  const backup = lastBackupDate()

  function saveOrg(e: React.FormEvent) {
    e.preventDefault()
    const name = org.trim() || DEFAULT_ORG
    updateSettings({ orgName: name, responsible: responsible.trim() })
    setOrg(name); setSaved(true); window.setTimeout(() => setSaved(false), 2500)
  }

  return <div className="settings-page">
    <div className="page-heading"><div><div className="eyebrow">PREFERENCIAS</div><h1>Configuración <InfoTip text="Ajusta la apariencia, los datos de la organización y los saldos iniciales. Todo se guarda en este dispositivo."/></h1></div></div>

    <section className="ledger-panel settings-card">
      <div className="ledger-header"><h2><Type size={20}/> Tamaño del texto <InfoTip text="Aumenta el tamaño de toda la aplicación para leer con más comodidad."/></h2></div>
      <div className="settings-body"><div className="scale-options" role="radiogroup" aria-label="Tamaño del texto">
        {scales.map((o) => <button key={o.value} type="button" role="radio" aria-checked={s.textScale === o.value} className={`scale-option ${s.textScale === o.value ? 'selected' : ''}`} onClick={() => updateSettings({ textScale: o.value })}><span style={{ fontSize: o.sample }}>Aa</span>{o.label}</button>)}
      </div></div>
    </section>

    <section className="ledger-panel settings-card">
      <div className="ledger-header"><h2>Preferencias <InfoTip text="Opciones de uso diario de la aplicación."/></h2></div>
      <div className="settings-body settings-rows">
        <label className="settings-row"><span>Mostrar la referencia del dólar en el Resumen</span><input type="checkbox" className="switch" checked={s.ratesVisible} onChange={(e) => updateSettings({ ratesVisible: e.target.checked })}/></label>
        <label className="settings-row"><span>Dólar para calcular equivalentes en los reportes <InfoTip text="Los reportes muestran cuántos dólares equivalen los bolívares recibidos, usando la tasa actual de esta referencia."/></span><select className="settings-select" value={s.rateSource} onChange={(e) => updateSettings({ rateSource: e.target.value === 'paralelo' ? 'paralelo' : 'oficial' })}><option value="oficial">Oficial (BCV)</option><option value="paralelo">Paralelo</option></select></label>
        <div className="settings-row"><span>Guía de uso</span><button className="button secondary" onClick={() => { onGoSummary(); window.setTimeout(startTour, 250) }}><Compass size={18}/> Ver la guía</button></div>
        <div className="settings-row"><span>Último respaldo</span><strong>{backup ? new Date(backup).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Aún no has hecho un respaldo'}</strong></div>
      </div>
    </section>

    <section className="ledger-panel settings-card">
      <div className="ledger-header"><h2><Landmark size={20}/> Datos de la organización <InfoTip text="Aparecen en el menú y en los reportes en PDF y Excel."/></h2></div>
      <form className="settings-body" onSubmit={saveOrg}>
        <label className="field-label">Nombre de la organización<input value={org} maxLength={80} onChange={(e) => setOrg(e.target.value)}/></label>
        <label className="field-label">Responsable <span className="optional">(opcional)</span><input value={responsible} maxLength={80} onChange={(e) => setResponsible(e.target.value)}/></label>
        <div className="settings-actions"><button className="button primary">Guardar datos</button>{saved && <span className="settings-saved" role="status">Datos guardados</span>}</div>
      </form>
    </section>

    <section className="ledger-panel settings-card">
      <div className="ledger-header"><h2>Saldos iniciales <InfoTip text="Se configura una sola vez al comenzar. Queda bloqueado cuando la cuenta tiene su primer movimiento."/></h2></div>
      <div className="settings-body settings-rows">
        {accounts.map((a) => { const locked = movements.some((m) => m.accountId === a.id); return <div className="settings-row" key={a.id}>
          <span><strong>{a.name}</strong><small>Saldo actual: {formatMoney(balanceAt(a, movements), a.currency)}</small></span>
          <span className="settings-opening">{formatMoney(a.openingBalanceMinor, a.currency)}<button className="button secondary" disabled={locked} title={locked ? 'Bloqueado luego del primer movimiento' : undefined} onClick={() => onOpening(a.id)}>{locked ? 'Bloqueado' : 'Configurar'}</button></span>
        </div> })}
      </div>
    </section>
  </div>
}
