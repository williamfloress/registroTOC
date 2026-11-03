import { convertVesMinorToUsdMinor, type Contribution, type Participant } from './finance'

export function summarizeContributionMonth(activeParticipants: Participant[], contributions: Contribution[], year: number, month: number) {
  const selected = contributions.filter((item) => item.year === year && item.month === month)
  const activeIds = new Set(activeParticipants.filter((person) => person.active).map((person) => person.id))
  const paidActiveIds = new Set(selected.filter((item) => activeIds.has(item.participantId)).map((item) => item.participantId))
  const usdReceivedMinor = selected.filter((item) => item.paymentCurrency === 'USD').reduce((sum, item) => sum + item.amountPaidMinor, 0)
  const vesPayments = selected.filter((item) => item.paymentCurrency === 'VES' && item.exchangeRate)
  const vesReceivedMinor = vesPayments.reduce((sum, item) => sum + item.amountPaidMinor, 0)
  const vesEquivalentUsdMinor = vesPayments.reduce((sum, item) => sum + convertVesMinorToUsdMinor(item.amountPaidMinor, item.exchangeRate!), 0)
  const activeCount = activeIds.size

  return {
    activeCount,
    paidCount: paidActiveIds.size,
    withoutRecordCount: Math.max(0, activeCount - paidActiveIds.size),
    usdReceivedMinor,
    vesReceivedMinor,
    vesEquivalentUsdMinor,
  }
}
