import Dexie, { type EntityTable } from 'dexie'
import type { FinancialAccount, FinancialMovement, ObligationSchedule, Participant, ParticipantInput } from '../domain/finance'

class ReportesDatabase extends Dexie {
  accounts!: EntityTable<FinancialAccount, 'id'>
  movements!: EntityTable<FinancialMovement, 'id'>
  participants!: EntityTable<Participant, 'id'>
  obligations!: EntityTable<ObligationSchedule, 'id'>

  constructor() {
    super('reportesTOC')
    this.version(1).stores({ accounts: 'id, currency, active', movements: 'id, accountId, date, type, [accountId+date]' })
    this.version(2).stores({
      accounts: 'id, currency, active',
      movements: 'id, accountId, date, type, [accountId+date]',
      participants: 'id, active, [lastName+firstName]',
      obligations: 'id, effectiveMonth',
    }).upgrade(async (transaction) => {
      const timestamp = now()
      await transaction.table('obligations').add({
        id: 'obligation-2000-01', effectiveMonth: '2000-01', amountUsdMinor: 100,
        createdAt: timestamp, updatedAt: timestamp,
      })
    })
  }
}

export const db = new ReportesDatabase()
const now = () => new Date().toISOString()
const initialAccounts: FinancialAccount[] = [
  { id: 'usd-cash', name: 'USD efectivo', currency: 'USD', kind: 'cash', active: true, openingBalanceMinor: 0, createdAt: now(), updatedAt: now() },
  { id: 'ves-cash', name: 'VES efectivo', currency: 'VES', kind: 'cash', active: true, openingBalanceMinor: 0, createdAt: now(), updatedAt: now() },
  { id: 'ves-bank', name: 'VES banco', currency: 'VES', kind: 'bank', active: true, openingBalanceMinor: 0, createdAt: now(), updatedAt: now() },
]

export async function ensureInitialAccounts() {
  await db.transaction('rw', db.accounts, async () => {
    for (const account of initialAccounts) {
      if (!(await db.accounts.get(account.id))) await db.accounts.add(account)
    }
  })
}

export async function ensureInitialObligations() {
  const timestamp = now()
  await db.transaction('rw', db.obligations, async () => {
    if (!(await db.obligations.get('obligation-2000-01'))) {
      await db.obligations.add({ id: 'obligation-2000-01', effectiveMonth: '2000-01', amountUsdMinor: 100, createdAt: timestamp, updatedAt: timestamp })
    }
  })
}

export const financeRepository = {
  accounts: () => db.accounts.orderBy('id').toArray(),
  movements: () => db.movements.toArray(),
  async saveMovement(input: Omit<FinancialMovement, 'id' | 'createdAt' | 'updatedAt'>, id?: string) {
    const timestamp = now()
    const old = id ? await db.movements.get(id) : undefined
    const movement: FinancialMovement = { ...input, id: id ?? crypto.randomUUID(), createdAt: old?.createdAt ?? timestamp, updatedAt: timestamp }
    await db.movements.put(movement)
    return movement
  },
  removeMovement: (id: string) => db.movements.delete(id),
  async setOpeningBalance(id: string, amountMinor: number) {
    await db.transaction('rw', db.accounts, db.movements, async () => {
      const account = await db.accounts.get(id)
      if (!account) throw new Error('No se encontró la cuenta')
      if (await db.movements.where('accountId').equals(id).count()) throw new Error('El saldo inicial está bloqueado porque la cuenta ya tiene movimientos')
      await db.accounts.put({ ...account, openingBalanceMinor: amountMinor, updatedAt: now() })
    })
  },
}

function currentMonth() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function nextMonth(month: string) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(year, value, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const participantRepository = {
  list: () => db.participants.orderBy('lastName').toArray(),
  async save(input: ParticipantInput, id?: string) {
    const timestamp = now()
    const existing = id ? await db.participants.get(id) : undefined
    const participant: Participant = {
      ...input, id: existing?.id ?? crypto.randomUUID(), active: existing?.active ?? true,
      createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
    }
    await db.participants.put(participant)
    return participant
  },
  async setActive(id: string, active: boolean) {
    const participant = await db.participants.get(id)
    if (!participant) throw new Error('No se encontró el participante')
    await db.participants.put({ ...participant, active, updatedAt: now() })
  },
}

export const obligationRepository = {
  list: () => db.obligations.orderBy('effectiveMonth').toArray(),
  async saveFuture(input: Pick<ObligationSchedule, 'effectiveMonth' | 'amountUsdMinor'>, replaceId?: string) {
    const { effectiveMonth, amountUsdMinor } = input
    if (effectiveMonth < nextMonth(currentMonth())) throw new Error('La obligación solo se puede programar desde el próximo mes')
    if (!Number.isSafeInteger(amountUsdMinor) || amountUsdMinor <= 0) throw new Error('La obligación debe ser mayor que cero')
    return db.transaction('rw', db.obligations, async () => {
      const existing = replaceId ? await db.obligations.get(replaceId) : await db.obligations.where('effectiveMonth').equals(effectiveMonth).first()
      if (replaceId && !existing) throw new Error('No se encontró la vigencia que quieres cambiar')
      if (existing && existing.effectiveMonth < nextMonth(currentMonth())) throw new Error('No se puede modificar una obligación vigente o histórica')
      const conflict = await db.obligations.where('effectiveMonth').equals(effectiveMonth).first()
      if (conflict && conflict.id !== existing?.id) throw new Error('Ya existe una obligación programada para ese mes')
      const timestamp = now()
      const schedule: ObligationSchedule = {
        id: existing?.id ?? `obligation-${effectiveMonth}`, effectiveMonth, amountUsdMinor,
        createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp,
      }
      if (existing && existing.effectiveMonth !== effectiveMonth) await db.obligations.delete(existing.id)
      await db.obligations.put(schedule)
      return schedule
    })
  },
  async removeFuture(id: string) {
    const schedule = await db.obligations.get(id)
    if (!schedule) return
    if (schedule.effectiveMonth < nextMonth(currentMonth())) throw new Error('No se puede modificar una obligación vigente o histórica')
    await db.obligations.delete(id)
  },
}
