import { convertVesMinorToUsdMinor, summarizePeriod, type Contribution, type ContributionBatch, type ContributionHistory, type FinancialAccount, type FinancialMovement, type Participant } from './finance'

export type FinanceReportFilter = { accountId: string|'all'; from: string; to: string; periodLabel: string }
export type FinanceReportAccount = {
  account: FinancialAccount; opening: number; income: number; expense: number; closing: number
  movements: Array<FinancialMovement & { balanceMinor: number }>
}
export type ContributionReportMonth = { month: number; paidCount: number; usdMinor: number; vesMinor: number; vesEquivalentUsdMinor: number }
export type ContributionReportLine = { contribution: Contribution|ContributionHistory; batch?: ContributionBatch; status: 'Pagado'|'Anulado' }

export function buildFinanceReport(accounts: FinancialAccount[], movements: FinancialMovement[], filter: FinanceReportFilter) {
  const selected = accounts.filter((account) => filter.accountId === 'all' || account.id === filter.accountId)
  const accountReports: FinanceReportAccount[] = selected.map((account) => {
    const summary = summarizePeriod(account, movements, filter.from, filter.to)
    let balanceMinor = summary.opening
    const lines = summary.movements.map((movement) => {
      balanceMinor += movement.type === 'income' ? movement.amountMinor : -movement.amountMinor
      return { ...movement, balanceMinor }
    })
    return { account, opening: summary.opening, income: summary.income, expense: summary.expense, closing: summary.closing, movements: lines }
  })
  return { periodLabel: filter.periodLabel, accounts: accountReports }
}

export function buildContributionReport(participants: Participant[], current: Contribution[], history: ContributionHistory[], year: number, participantId = 'all', batches: ContributionBatch[] = []) {
  const selectedPeople = participants.filter((person) => participantId === 'all' || person.id === participantId)
  const people = new Map(selectedPeople.map((person) => [person.id, person]))
  const batchById = new Map(batches.map((batch) => [batch.id, batch]))
  const paid = current.filter((item) => item.year === year && people.has(item.participantId))
  const voided = history.filter((item) => item.year === year && people.has(item.participantId))
  const months: ContributionReportMonth[] = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const rows = paid.filter((item) => item.month === month)
    const ves = rows.filter((item) => item.paymentCurrency === 'VES' && item.exchangeRate)
    return {
      month,
      paidCount: rows.length,
      usdMinor: rows.filter((item) => item.paymentCurrency === 'USD').reduce((sum, item) => sum + item.amountPaidMinor, 0),
      vesMinor: ves.reduce((sum, item) => sum + item.amountPaidMinor, 0),
      vesEquivalentUsdMinor: ves.reduce((sum, item) => sum + convertVesMinorToUsdMinor(item.amountPaidMinor, item.exchangeRate!), 0),
    }
  })
  const details: ContributionReportLine[] = [
    ...paid.map((contribution) => ({ contribution, batch: batchById.get(contribution.paymentBatchId), status: 'Pagado' as const })),
    ...voided.map((contribution) => ({ contribution, batch: batchById.get(contribution.paymentBatchId), status: 'Anulado' as const })),
  ].sort((a, b) => a.contribution.paymentDate.localeCompare(b.contribution.paymentDate)
    || a.contribution.year - b.contribution.year || a.contribution.month - b.contribution.month)
  const currencySummary = {
    usdMinor: paid.filter((item) => item.paymentCurrency === 'USD').reduce((sum, item) => sum + item.amountPaidMinor, 0),
    vesMinor: paid.filter((item) => item.paymentCurrency === 'VES').reduce((sum, item) => sum + item.amountPaidMinor, 0),
    vesEquivalentUsdMinor: paid.filter((item) => item.paymentCurrency === 'VES' && item.exchangeRate)
      .reduce((sum, item) => sum + convertVesMinorToUsdMinor(item.amountPaidMinor, item.exchangeRate!), 0),
  }
  return { year, participants: selectedPeople, months, details, currencySummary }
}

export type FinanceReportData = ReturnType<typeof buildFinanceReport>
export type ContributionReportData = ReturnType<typeof buildContributionReport>
