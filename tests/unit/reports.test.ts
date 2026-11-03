import { describe, expect, it } from 'vitest'
import { buildContributionReport, buildFinanceReport } from '../../src/domain/reports'
import type { Contribution, ContributionHistory, FinancialAccount, FinancialMovement, Participant } from '../../src/domain/finance'

const timestamp = '2026-01-01T00:00:00.000Z'
const account = (id: string, currency: 'USD' | 'VES', openingBalanceMinor = 0): FinancialAccount => ({ id, name: id, currency, kind: 'cash', active: true, openingBalanceMinor, createdAt: timestamp, updatedAt: timestamp })
const movement = (id: string, accountId: string, date: string, type: 'income' | 'expense', amountMinor: number): FinancialMovement => ({ id, accountId, date, type, amountMinor, description: id, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z` })
const participant = (id: string, active = true): Participant => ({ id, firstName: id, lastName: 'Carmelita', active, createdAt: timestamp, updatedAt: timestamp })
const contribution = (id: string, participantId: string, month: number, currency: 'USD' | 'VES', amountPaidMinor: number, exchangeRate?: string): Contribution => ({ id, participantId, year: 2026, month, requiredUsdMinor: 100, paymentBatchId: `batch-${id}`, paymentCurrency: currency, amountPaidMinor, exchangeRate, paymentDate: `2026-${String(month).padStart(2, '0')}-10`, createdAt: timestamp, updatedAt: timestamp })

describe('informes financieros', () => {
  it('filtra por cuenta y período y calcula saldo de apertura, recorrido y cierre', () => {
    const usd = account('usd', 'USD', 1000)
    const ves = account('ves', 'VES', 2000)
    const data = buildFinanceReport([usd, ves], [
      movement('previo', 'usd', '2026-01-31', 'income', 500),
      movement('ingreso', 'usd', '2026-02-02', 'income', 300),
      movement('egreso', 'usd', '2026-02-03', 'expense', 100),
      movement('otra-cuenta', 'ves', '2026-02-02', 'income', 900),
      movement('fuera', 'usd', '2026-03-01', 'income', 700),
    ], { accountId: 'usd', from: '2026-02-01', to: '2026-02-28', periodLabel: '2026-02' })
    expect(data.accounts).toHaveLength(1)
    expect(data.accounts[0]).toMatchObject({ opening: 1500, income: 300, expense: 100, closing: 1700 })
    expect(data.accounts[0].movements.map((item) => item.balanceMinor)).toEqual([1800, 1700])
  })

  it('mantiene saldos por cuenta y moneda cuando se incluyen todas', () => {
    const data = buildFinanceReport([account('usd', 'USD'), account('ves', 'VES')], [movement('usd-in', 'usd', '2026-02-02', 'income', 100), movement('ves-in', 'ves', '2026-02-02', 'income', 200)], { accountId: 'all', from: '2026-02-01', to: '2026-02-28', periodLabel: 'febrero' })
    expect(data.accounts.map((item) => [item.account.currency, item.closing])).toEqual([['USD', 100], ['VES', 200]])
  })
})

describe('informe anual de aportes', () => {
  it('resume pagos por moneda, muestra anulaciones en detalle y las excluye de totales', () => {
    const paidUsd = contribution('paid-usd', 'ana', 1, 'USD', 100)
    const paidVes = contribution('paid-ves', 'ana', 2, 'VES', 45000, '450')
    const voided: ContributionHistory = { ...contribution('void', 'ana', 3, 'USD', 100), voidedAt: timestamp }
    const report = buildContributionReport([participant('ana'), participant('inactiva', false)], [paidUsd, paidVes], [voided], 2026)
    expect(report.months).toHaveLength(12)
    expect(report.months[0]).toMatchObject({ paidCount: 1, usdMinor: 100 })
    expect(report.months[1]).toMatchObject({ paidCount: 1, vesMinor: 45000, vesEquivalentUsdMinor: 100 })
    expect(report.currencySummary).toEqual({ usdMinor: 100, vesMinor: 45000, vesEquivalentUsdMinor: 100 })
    expect(report.details.map((line) => line.status)).toEqual(['Pagado', 'Pagado', 'Anulado'])
    expect(report.participants).toHaveLength(2)
  })

  it('filtra un participante sin perder su registro histórico', () => {
    const archived: ContributionHistory = { ...contribution('void', 'inactiva', 4, 'VES', 900), voidedAt: timestamp }
    const report = buildContributionReport([participant('ana'), participant('inactiva', false)], [], [archived], 2026, 'inactiva')
    expect(report.participants.map((item) => item.id)).toEqual(['inactiva'])
    expect(report.details).toHaveLength(1)
    expect(report.months[3].paidCount).toBe(0)
    expect(report.currencySummary.vesMinor).toBe(0)
  })
})
