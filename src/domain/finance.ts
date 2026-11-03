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
