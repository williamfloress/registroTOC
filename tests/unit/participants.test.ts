import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { obligationSchema, participantSchema } from '../../src/domain/finance'
import { db, ensureInitialObligations, obligationRepository, participantRepository } from '../../src/infrastructure/database'

function nextMonth() {
  const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
}

describe('participantes y obligaciones', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureInitialObligations()
  })
  afterAll(() => db.close())

  it('valida y normaliza nombres del padrón', () => {
    expect(participantSchema.parse({ firstName: '  Ana María ', lastName: ' Pérez ' })).toMatchObject({ firstName: 'Ana María', lastName: 'Pérez' })
    expect(() => participantSchema.parse({ firstName: ' ', lastName: 'Pérez' })).toThrow()
  })

  it('crea y edita participantes y conserva su historial al desactivarlos', async () => {
    const input = participantSchema.parse({ firstName: 'Ana', lastName: 'Pérez', notes: 'Consejo' })
    const created = await participantRepository.save(input)
    const edited = await participantRepository.save({ ...input, notes: 'Nota actualizada' }, created.id)
    await participantRepository.setActive(created.id, false)
    const stored = await participantRepository.list()
    expect(stored).toHaveLength(1)
    expect(edited.id).toBe(created.id)
    expect(stored[0]).toMatchObject({ firstName: 'Ana', lastName: 'Pérez', notes: 'Nota actualizada', active: false })
  })

  it('inicializa la obligación de 1 USD y conserva cambios por mes futuro', async () => {
    const initial = await obligationRepository.list()
    expect(initial).toHaveLength(1)
    expect(initial[0]).toMatchObject({ effectiveMonth: '2000-01', amountUsdMinor: 100 })

    const effectiveMonth = nextMonth()
    const valid = obligationSchema.parse({ effectiveMonth, amountUsdMinor: 250 })
    const saved = await obligationRepository.saveFuture(valid)
    await obligationRepository.saveFuture({ ...valid, amountUsdMinor: 300 })
    const schedules = await obligationRepository.list()
    expect(schedules).toHaveLength(2)
    expect(schedules.find((row) => row.effectiveMonth === effectiveMonth)?.amountUsdMinor).toBe(300)
    await expect(obligationRepository.removeFuture(initial[0].id)).rejects.toThrow('vigente o histórica')
    expect(saved.amountUsdMinor).toBe(250)
  })

  it('rechaza montos cero y vigencias pasadas', async () => {
    expect(() => obligationSchema.parse({ effectiveMonth: '2025-01', amountUsdMinor: 0 })).toThrow()
    await expect(obligationRepository.saveFuture({ effectiveMonth: '2001-01', amountUsdMinor: 100 })).rejects.toThrow('próximo mes')
  })

  it('migra a la nueva versión sin perder cuentas ni movimientos previos', async () => {
    await db.delete()
    const legacy = new Dexie('reportesTOC')
    legacy.version(1).stores({ accounts: 'id, currency, active', movements: 'id, accountId, date, type, [accountId+date]' })
    await legacy.open()
    await legacy.table('accounts').add({ id: 'usd-cash', name: 'USD efectivo', currency: 'USD', kind: 'cash', active: true, openingBalanceMinor: 12000, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' })
    await legacy.table('movements').add({ id: 'legacy-income', accountId: 'usd-cash', date: '2026-02-01', description: 'Registro anterior', type: 'income', amountMinor: 500, createdAt: '2026-02-01T12:00:00.000Z', updatedAt: '2026-02-01T12:00:00.000Z' })
    legacy.close()

    await db.open()
    expect(await db.accounts.get('usd-cash')).toMatchObject({ openingBalanceMinor: 12000 })
    expect(await db.movements.get('legacy-income')).toMatchObject({ description: 'Registro anterior', amountMinor: 500 })
    expect(await obligationRepository.list()).toHaveLength(1)
  })
})
