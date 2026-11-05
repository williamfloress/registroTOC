// Genera seed/demo-backup.json: un respaldo con datos de prueba (formato reportesTOC-backup v1).
// Uso: node scripts/generate-demo-backup.mjs   ->  luego Respaldo > Restaurar un respaldo.
import { mkdirSync, writeFileSync } from 'node:fs'

const YEAR = 2026
const TODAY = '2026-11-05'
let seed = 20261105
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1))
const pad = (n) => String(n).padStart(2, '0')
const iso = (date) => `${date}T12:00:00.000Z`
let counter = 0
const id = (prefix) => `${prefix}-demo-${String(++counter).padStart(4, '0')}`

// ---- Cuentas ----
const accounts = [
  { id: 'usd-cash', name: 'USD efectivo', currency: 'USD', kind: 'cash', active: true, openingBalanceMinor: 25000 },
  { id: 'ves-cash', name: 'VES efectivo', currency: 'VES', kind: 'cash', active: true, openingBalanceMinor: 500000 },
  { id: 'ves-bank', name: 'VES banco', currency: 'VES', kind: 'bank', active: true, openingBalanceMinor: 2000000 },
].map((a) => ({ ...a, createdAt: iso(`${YEAR}-01-01`), updatedAt: iso(`${YEAR}-01-01`) }))

// ---- Obligaciones (cambian de tarifa) ----
const obligations = [
  { id: 'obligation-2000-01', effectiveMonth: '2000-01', amountUsdMinor: 100 },
  { id: 'obligation-2026-01', effectiveMonth: '2026-01', amountUsdMinor: 200 },
  { id: 'obligation-2026-07', effectiveMonth: '2026-07', amountUsdMinor: 300 },
].map((o) => ({ ...o, createdAt: iso(`${YEAR}-01-01`), updatedAt: iso(`${YEAR}-01-01`) }))
const requiredFor = (month) => (month >= 7 ? 300 : 200)

// ---- Participantes ----
const names = [
  ['María', 'González'], ['José', 'Rodríguez'], ['Carmen', 'Pérez'], ['Luis', 'Fernández'], ['Rosa', 'Martínez'],
  ['Pedro', 'Ramírez'], ['Teresa', 'Silva'], ['Carlos', 'Mendoza'], ['Elena', 'Torres'], ['Miguel', 'Castillo'],
  ['Josefina', 'Rojas'], ['Ana', 'Herrera'], ['Francisco', 'Navarro'], ['Beatriz', 'Moreno'], ['Antonio', 'Quintero'],
]
const participants = names.map(([firstName, lastName], i) => ({
  id: id('person'), firstName, lastName, active: i < 13,
  ...(i === 2 ? { notes: 'Responsable del grupo de oración' } : {}),
  createdAt: iso(`${YEAR}-01-02`), updatedAt: iso(`${YEAR}-01-02`),
}))

// ---- Tasa de cambio aproximada por mes (VES por USD) ----
const rates = [412.35, 436.8, 461.2, 489.55, 520.1, 566.4, 623.75, 689.2, 760.9, 840.3, 893.22]
const rateOf = (month) => rates[month - 1].toFixed(2)

// ---- Aportes ----
const batches = [], contributions = [], history = []
const maxMonth = 10 // enero a octubre ya vencidos; noviembre queda pendiente para mostrar "Sin registro"
const lastDay = (m) => new Date(YEAR, m, 0).getDate()

function addBatch(person, months, currency, paymentDate, status = 'paid', notes) {
  const batchId = id('batch')
  const month0 = months[0]
  const rate = currency === 'VES' ? rateOf(Math.max(...months, Number(paymentDate.slice(5, 7)))) : undefined
  const entries = months.map((m) => {
    const requiredUsdMinor = requiredFor(m)
    const amountPaidMinor = currency === 'USD' ? requiredUsdMinor : Math.round(requiredUsdMinor * Number(rate))
    return {
      id: id('contribution'), participantId: person.id, year: YEAR, month: m, requiredUsdMinor,
      paymentBatchId: batchId, paymentCurrency: currency, amountPaidMinor,
      ...(rate ? { exchangeRate: rate } : {}), paymentDate, ...(notes ? { notes } : {}),
      createdAt: iso(paymentDate), updatedAt: iso(paymentDate),
    }
  })
  void month0
  batches.push({
    id: batchId, participantId: person.id, paymentDate, currency, status,
    totalAmountMinor: entries.reduce((s, e) => s + e.amountPaidMinor, 0),
    ...(rate ? { exchangeRate: rate, rateSource: pick(['BCV', 'Paralelo']) } : {}),
    ...(notes ? { notes } : {}), createdAt: iso(paymentDate), updatedAt: iso(paymentDate),
  })
  if (status === 'paid') contributions.push(...entries)
  else history.push(...entries.map((e) => ({ ...e, voidedAt: iso(TODAY) })))
}

participants.forEach((person, index) => {
  // Perfil de cumplimiento: algunos al día, otros con meses pendientes.
  const profile = index % 5 // 0,1: al día; 2: mitad; 3: pocos; 4: sin pagos recientes
  const currency = index % 3 === 0 ? 'USD' : 'VES'
  let month = 1
  const stopAt = profile <= 1 ? maxMonth : profile === 2 ? int(5, 7) : profile === 3 ? int(2, 4) : 0
  while (month <= stopAt) {
    const span = rnd() < 0.3 ? Math.min(int(2, 3), stopAt - month + 1) : 1
    const months = Array.from({ length: span }, (_, k) => month + k)
    const lastMonth = months[months.length - 1]
    const day = Math.min(int(2, 27), lastDay(lastMonth))
    addBatch(person, months, rnd() < 0.15 ? (currency === 'USD' ? 'VES' : 'USD') : currency, `${YEAR}-${pad(lastMonth)}-${pad(day)}`)
    month += span
  }
})
// Pagos de noviembre ya registrados por algunos
participants.slice(0, 4).forEach((p, i) => addBatch(p, [11], i % 2 ? 'VES' : 'USD', `${YEAR}-11-0${i + 1}`))
// Un pago anulado (queda en historial)
addBatch(participants[5], [10], 'USD', `${YEAR}-10-20`, 'void', 'Registrado por error')

// ---- Movimientos del libro financiero ----
const movements = []
function addMovement(accountId, date, description, type, amountMinor, notes) {
  movements.push({
    id: id('movement'), accountId, date, description, type, amountMinor, ...(notes ? { notes } : {}),
    createdAt: iso(date), updatedAt: iso(date),
  })
}
const incomeConcepts = ['Colecta dominical', 'Donación', 'Rifa solidaria', 'Venta de velas', 'Aporte de benefactor', 'Actividad de recaudación']
const expenseConcepts = ['Compra de velas e incienso', 'Flores para el altar', 'Papelería e impresiones', 'Transporte retiro', 'Mantenimiento del salón', 'Ayuda a familia necesitada', 'Material de catequesis', 'Refrigerio reunión mensual']
for (let m = 1; m <= 11; m++) {
  const last = m === 11 ? 4 : lastDay(m)
  const rate = Number(rateOf(m))
  // Ingresos
  addMovement('usd-cash', `${YEAR}-${pad(m)}-${pad(int(1, Math.min(10, last)))}`, pick(incomeConcepts), 'income', int(15, 60) * 100)
  addMovement('ves-bank', `${YEAR}-${pad(m)}-${pad(int(3, Math.min(14, last)))}`, pick(incomeConcepts), 'income', Math.round(int(20, 80) * rate))
  if (rnd() < 0.7) addMovement('ves-cash', `${YEAR}-${pad(m)}-${pad(int(5, Math.min(20, last)))}`, pick(incomeConcepts), 'income', Math.round(int(10, 40) * rate))
  // Egresos (siempre menores a los ingresos para no dejar saldos negativos)
  addMovement('usd-cash', `${YEAR}-${pad(m)}-${pad(int(11, Math.min(25, last)))}`, pick(expenseConcepts), 'expense', int(5, 18) * 100)
  addMovement('ves-bank', `${YEAR}-${pad(m)}-${pad(int(15, Math.min(27, last)))}`, pick(expenseConcepts), 'expense', Math.round(int(8, 25) * rate))
  if (rnd() < 0.6) addMovement('ves-cash', `${YEAR}-${pad(m)}-${pad(int(18, Math.min(28, last)))}`, pick(expenseConcepts), 'expense', Math.round(int(4, 14) * rate))
}
movements.sort((a, b) => a.date.localeCompare(b.date))

// Comprobación: ningún saldo negativo
for (const acc of accounts) {
  let bal = acc.openingBalanceMinor
  for (const mv of movements.filter((x) => x.accountId === acc.id)) {
    bal += mv.type === 'income' ? mv.amountMinor : -mv.amountMinor
    if (bal < 0) throw new Error(`Saldo negativo en ${acc.id} el ${mv.date}`)
  }
}

const backup = {
  format: 'reportesTOC-backup', version: 1, exportedAt: new Date().toISOString(),
  data: { accounts, movements, participants, obligations, paymentBatches: batches, contributions, contributionHistory: history },
}
mkdirSync('seed', { recursive: true })
writeFileSync('seed/demo-backup.json', JSON.stringify(backup, null, 2) + '\n')
console.log(`Respaldo de prueba generado: ${participants.length} participantes, ${movements.length} movimientos, ${batches.length} pagos, ${contributions.length} aportes (+${history.length} anulados)`)
