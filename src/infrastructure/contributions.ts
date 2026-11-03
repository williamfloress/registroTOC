import { contributionPaymentSchema, convertUsdMinorToVesMinor, normalizeExchangeRate, type Contribution, type ContributionPeriod, type ContributionBatch } from '../domain/finance'
import { db } from './database'

const now = () => new Date().toISOString()
const localDate = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
const periodKey = ({year,month}: ContributionPeriod) => `${year}-${String(month).padStart(2,'0')}`
function isValidDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value
}

export const contributionRepository = {
  async forYear(year: number) {
    return (await db.contributions.where('year').equals(year).toArray()).sort((a,b)=>a.month-b.month||a.participantId.localeCompare(b.participantId))
  },
  forParticipant: (participantId: string) => db.contributions.where('participantId').equals(participantId).toArray(),
  recentBatches: () => db.paymentBatches.orderBy('paymentDate').reverse().toArray(),
  batch: (id: string) => db.paymentBatches.get(id),
  async periodsForBatch(id: string) {
    return (await db.contributions.where('paymentBatchId').equals(id).toArray()).sort((a,b)=>a.year-b.year||a.month-b.month)
  },
  async historyForBatch(id: string) {
    return (await db.contributionHistory.where('paymentBatchId').equals(id).toArray()).sort((a,b)=>a.year-b.year||a.month-b.month)
  },
  async registerPayment(rawInput: unknown): Promise<ContributionBatch> {
    const input = contributionPaymentSchema.parse(rawInput)
    if (!isValidDate(input.paymentDate)) throw new Error('La fecha del pago no es válida')
    if (input.paymentDate > localDate()) throw new Error('La fecha del pago no puede estar en el futuro')
    const exchangeRate = input.currency === 'VES' ? normalizeExchangeRate(input.exchangeRate ?? '') : undefined
    const periods = [...input.periods].sort((a,b) => a.year-b.year || a.month-b.month)
    const today = localDate().slice(0,7)

    return db.transaction('rw', db.participants, db.obligations, db.paymentBatches, db.contributions, async () => {
      const participant = await db.participants.get(input.participantId)
      if (!participant) throw new Error('No se encontró el participante')
      if (!participant.active) throw new Error('No se pueden registrar pagos para un participante inactivo')
      for (const period of periods) {
        const key = periodKey(period)
        if (key > today) throw new Error(`El período ${key} todavía no está disponible para pago`)
        const existing = await db.contributions.where('[participantId+year+month]').equals([input.participantId, period.year, period.month]).first()
        if (existing) throw new Error(`Ya existe un aporte para ${key}`)
      }

      const schedules = await db.obligations.orderBy('effectiveMonth').toArray()
      const timestamp = now()
      const batchId = crypto.randomUUID()
      const entries: Contribution[] = periods.map((period) => {
        const key = periodKey(period)
        const obligation = schedules.filter((item) => item.effectiveMonth <= key).at(-1)
        if (!obligation) throw new Error(`No hay una obligación configurada para ${key}`)
        const amountPaidMinor = input.currency === 'USD'
          ? obligation.amountUsdMinor
          : convertUsdMinorToVesMinor(obligation.amountUsdMinor, exchangeRate!)
        return {
          id: crypto.randomUUID(), participantId: input.participantId, year: period.year, month: period.month,
          requiredUsdMinor: obligation.amountUsdMinor, paymentBatchId: batchId,
          paymentCurrency: input.currency, amountPaidMinor, exchangeRate, paymentDate: input.paymentDate,
          notes: input.notes || undefined, createdAt: timestamp, updatedAt: timestamp,
        }
      })
      const batch: ContributionBatch = {
        id: batchId, participantId: input.participantId, paymentDate: input.paymentDate, currency: input.currency,
        totalAmountMinor: entries.reduce((total, entry) => total + entry.amountPaidMinor, 0),
        exchangeRate, rateSource: input.currency === 'VES' ? input.rateSource || undefined : undefined,
        notes: input.notes || undefined, status: 'paid', createdAt: timestamp, updatedAt: timestamp,
      }
      if (!Number.isSafeInteger(batch.totalAmountMinor)) throw new Error('El total del pago excede el límite permitido')
      await db.paymentBatches.add(batch)
      await db.contributions.bulkAdd(entries)
      return batch
    })
  },

  async voidBatch(batchId: string) {
    return db.transaction('rw', db.paymentBatches, db.contributions, db.contributionHistory, async () => {
      const batch = await db.paymentBatches.get(batchId)
      if (!batch) throw new Error('No se encontró el pago')
      if (batch.status === 'void') throw new Error('Este pago ya fue anulado')
      const entries = await db.contributions.where('paymentBatchId').equals(batchId).toArray()
      if (!entries.length) throw new Error('El pago no tiene meses asociados')
      const voidedAt = now()
      await db.contributionHistory.bulkAdd(entries.map((entry) => ({ ...entry, voidedAt })))
      await db.contributions.bulkDelete(entries.map((entry) => entry.id))
      await db.paymentBatches.put({ ...batch, status: 'void', updatedAt: voidedAt })
      return { batch, periods: entries.map(({year,month}) => ({year,month})) }
    })
  },
}
