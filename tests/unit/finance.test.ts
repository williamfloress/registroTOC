import { describe, expect, it } from 'vitest'
import { balanceAt, convertUsdMinorToVesMinor, convertVesMinorToUsdMinor, parseAmountToMinor, summarizePeriod, type FinancialAccount, type FinancialMovement } from '../../src/domain/finance'

const usd: FinancialAccount = { id: 'usd-cash', name: 'USD efectivo', currency: 'USD', kind: 'cash', active: true, openingBalanceMinor: 10000, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
const movement = (id: string, date: string, type: 'income'|'expense', amountMinor: number, accountId = usd.id): FinancialMovement => ({ id, accountId, date, type, amountMinor, description: id, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z` })

describe('cálculos del libro', () => {
  it('calcula saldo con ingreso y egreso, manteniendo unidades menores enteras', () => {
    const rows = [movement('in', '2026-01-02', 'income', 2000), movement('out', '2026-01-03', 'expense', 1500)]
    expect(balanceAt(usd, rows)).toBe(10500)
  })

  it('mantiene las cuentas y monedas separadas', () => {
    const rows = [movement('in', '2026-01-02', 'income', 5000, 'ves-bank')]
    expect(balanceAt(usd, rows)).toBe(10000)
  })

  it('calcula saldo de apertura, totales y cierre del período', () => {
    const rows = [movement('before', '2025-12-31', 'income', 3000), movement('in', '2026-01-02', 'income', 2000), movement('out', '2026-01-03', 'expense', 1500), movement('after', '2026-02-01', 'expense', 900)]
    const summary = summarizePeriod(usd, rows, '2026-01-01', '2026-01-31')
    expect(summary.opening).toBe(13000)
    expect(summary.income).toBe(2000)
    expect(summary.expense).toBe(1500)
    expect(summary.closing).toBe(13500)
    expect(summary.movements.map((row) => row.id)).toEqual(['in', 'out'])
  })

  it('ordena de forma estable operaciones de una misma fecha', () => {
    const rows = [movement('b', '2026-01-02', 'income', 200), movement('a', '2026-01-02', 'expense', 100)]
    const result = summarizePeriod(usd, rows, '2026-01-01', '2026-01-31')
    expect(result.movements.map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('convierte importes a centavos y rechaza formatos/ceros inválidos', () => {
    expect(parseAmountToMinor('12,34', 'USD')).toBe(1234)
    expect(() => parseAmountToMinor('1.234', 'VES')).toThrow()
    expect(() => parseAmountToMinor('0', 'USD')).toThrow()
  })

  it('convierte USD a VES con redondeo half-up por obligación', () => {
    expect(convertUsdMinorToVesMinor(100, '450')).toBe(45000)
    expect(convertUsdMinorToVesMinor(125, '450,1')).toBe(56263)
    expect(convertVesMinorToUsdMinor(45000, '450')).toBe(100)
  })
})
