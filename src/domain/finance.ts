import { z } from 'zod'

export type Currency = 'USD' | 'VES'
export type MovementType = 'income' | 'expense'
export type FinancialAccount = {
  id: string; name: string; currency: Currency; kind: 'cash' | 'bank'; active: boolean
  openingBalanceMinor: number; createdAt: string; updatedAt: string
}
export type FinancialMovement = {
  id: string; accountId: string; date: string; description: string; type: MovementType
  amountMinor: number; notes?: string; createdAt: string; updatedAt: string
}
export type Participant = {
  id: string; firstName: string; lastName: string; active: boolean; notes?: string; createdAt: string; updatedAt: string
}
export type ParticipantInput = Pick<Participant, 'firstName' | 'lastName' | 'notes'>
export type ObligationSchedule = { id: string; effectiveMonth: string; amountUsdMinor: number; createdAt: string; updatedAt: string }
export type ContributionPeriod = { year: number; month: number }
export type PaymentCurrency = Currency
export type ContributionBatch = {
  id: string; participantId: string; paymentDate: string; currency: PaymentCurrency; totalAmountMinor: number
  exchangeRate?: string; rateSource?: string; notes?: string; status: 'paid'|'void'; createdAt: string; updatedAt: string
}
export type Contribution = {
  id: string; participantId: string; year: number; month: number; requiredUsdMinor: number
  paymentBatchId: string; paymentCurrency: PaymentCurrency; amountPaidMinor: number; exchangeRate?: string
  paymentDate: string; notes?: string; createdAt: string; updatedAt: string
}
export type ContributionHistory = Contribution & { voidedAt: string }
export type MovementInput = Omit<FinancialMovement, 'id' | 'createdAt' | 'updatedAt'>
export const movementSchema = z.object({
  accountId: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1, 'Escribe el concepto').max(120),
  type: z.enum(['income', 'expense']), amountMinor: z.number().int().positive(), notes: z.string().max(500).optional(),
})
export const participantSchema = z.object({
  firstName: z.string().trim().min(1, 'Escribe los nombres').max(80),
  lastName: z.string().trim().min(1, 'Escribe los apellidos').max(80),
  notes: z.string().trim().max(500).optional(),
})
export const obligationSchema = z.object({
  effectiveMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Selecciona un mes válido'),
  amountUsdMinor: z.number().int().positive('La obligación debe ser mayor que cero'),
})
export const contributionPaymentSchema = z.object({
  participantId: z.string().min(1), periods: z.array(z.object({ year: z.number().int().min(2000).max(9999), month: z.number().int().min(1).max(12) })).min(1),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), currency: z.enum(['USD','VES']),
  exchangeRate: z.string().optional(), rateSource: z.string().trim().max(120).optional(), notes: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  const keys = value.periods.map(({year,month}) => `${year}-${String(month).padStart(2,'0')}`)
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', path: ['periods'], message: 'No repitas meses en el mismo pago' })
  if (value.currency === 'VES') {
    try { normalizeExchangeRate(value.exchangeRate ?? '') } catch { context.addIssue({ code: 'custom', path: ['exchangeRate'], message: 'Ingresa una tasa VES/USD válida y mayor que cero' }) }
  }
})

export function parseAmountToMinor(value: string, currency: Currency, allowZero = false): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Ingresa un importe válido con hasta 2 decimales')
  const [whole, fraction = ''] = normalized.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(minor) || minor < 0 || (minor === 0 && !allowZero)) throw new Error(allowZero ? 'El saldo no puede ser negativo' : 'El importe debe ser mayor que cero')
  void currency // USD y VES admiten dos decimales en esta entrega.
  return minor
}

export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100)
}

export function normalizeExchangeRate(value: string): string {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,8})?$/.test(normalized)) throw new Error('La tasa debe tener hasta 8 decimales')
  const number = Number(normalized)
  if (!Number.isFinite(number) || number <= 0) throw new Error('La tasa debe ser mayor que cero')
  return normalized
}

/** Convierte una obligación USD a VES minor usando redondeo half-up por mes. */
export function convertUsdMinorToVesMinor(usdMinor: number, exchangeRate: string): number {
  if (!Number.isSafeInteger(usdMinor) || usdMinor <= 0) throw new Error('La obligación debe ser mayor que cero')
  const normalized = normalizeExchangeRate(exchangeRate)
  const [whole, fraction = ''] = normalized.split('.')
  const scale = 10n ** BigInt(fraction.length)
  const rateUnits = BigInt(whole) * scale + BigInt(fraction || '0')
  const numerator = BigInt(usdMinor) * rateUnits
  let result = numerator / scale
  if ((numerator % scale) * 2n >= scale) result += 1n
  const amount = Number(result)
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('El equivalente en VES excede el límite permitido')
  return amount
}

export function convertVesMinorToUsdMinor(vesMinor: number, exchangeRate: string): number {
  if (!Number.isSafeInteger(vesMinor) || vesMinor < 0) throw new Error('El monto en VES no es válido')
  const normalized = normalizeExchangeRate(exchangeRate)
  const [whole, fraction = ''] = normalized.split('.')
  const scale = 10n ** BigInt(fraction.length)
  const rateUnits = BigInt(whole) * scale + BigInt(fraction || '0')
  const numerator = BigInt(vesMinor) * scale
  let result = numerator / rateUnits
  if ((numerator % rateUnits) * 2n >= rateUnits) result += 1n
  const amount = Number(result)
  if (!Number.isSafeInteger(amount)) throw new Error('El equivalente USD excede el límite permitido')
  return amount
}

export function balanceAt(account: FinancialAccount, movements: FinancialMovement[], throughDate = '9999-12-31') {
  return movements.filter((m) => m.accountId === account.id && m.date <= throughDate)
    .reduce((balance, m) => balance + (m.type === 'income' ? m.amountMinor : -m.amountMinor), account.openingBalanceMinor)
}

export function summarizePeriod(account: FinancialAccount, allMovements: FinancialMovement[], from: string, to: string) {
  const movements = allMovements.filter((m) => m.accountId === account.id && m.date >= from && m.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const prior = allMovements.filter((m) => m.accountId === account.id && m.date < from)
  const opening = balanceAt(account, prior)
  const income = movements.filter((m) => m.type === 'income').reduce((sum, m) => sum + m.amountMinor, 0)
  const expense = movements.filter((m) => m.type === 'expense').reduce((sum, m) => sum + m.amountMinor, 0)
  return { movements, opening, income, expense, closing: opening + income - expense }
}
