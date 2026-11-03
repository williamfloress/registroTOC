import Dexie, { type EntityTable } from 'dexie'
import type { FinancialAccount, FinancialMovement } from '../domain/finance'

class ReportesDatabase extends Dexie {
  accounts!: EntityTable<FinancialAccount, 'id'>
  movements!: EntityTable<FinancialMovement, 'id'>

  constructor() {
    super('reportesTOC')
    this.version(1).stores({ accounts: 'id, currency, active', movements: 'id, accountId, date, type, [accountId+date]' })
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
