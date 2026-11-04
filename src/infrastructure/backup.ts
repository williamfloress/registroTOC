import { z } from 'zod'
import type { Contribution, ContributionBatch, ContributionHistory, FinancialAccount, FinancialMovement, ObligationSchedule, Participant } from '../domain/finance'
import { db } from './database'

const stamp = z.string().datetime()
const minor = z.number().int().nonnegative().safe()
const account = z.object({ id:z.string().min(1), name:z.string().min(1), currency:z.enum(['USD','VES']), kind:z.enum(['cash','bank']), active:z.boolean(), openingBalanceMinor:minor, createdAt:stamp, updatedAt:stamp }).strict()
const movement = z.object({ id:z.string().min(1), accountId:z.string().min(1), date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), description:z.string().min(1), type:z.enum(['income','expense']), amountMinor:z.number().int().positive().safe(), notes:z.string().optional(), createdAt:stamp, updatedAt:stamp }).strict()
const participant = z.object({ id:z.string().min(1), firstName:z.string().min(1), lastName:z.string().min(1), active:z.boolean(), notes:z.string().optional(), createdAt:stamp, updatedAt:stamp }).strict()
const obligation = z.object({ id:z.string().min(1), effectiveMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), amountUsdMinor:z.number().int().positive().safe(), createdAt:stamp, updatedAt:stamp }).strict()
const batch = z.object({ id:z.string().min(1), participantId:z.string().min(1), paymentDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), currency:z.enum(['USD','VES']), totalAmountMinor:z.number().int().positive().safe(), exchangeRate:z.string().optional(), rateSource:z.string().optional(), notes:z.string().optional(), status:z.enum(['paid','void']), createdAt:stamp, updatedAt:stamp }).strict()
const contribution = z.object({ id:z.string().min(1), participantId:z.string().min(1), year:z.number().int().min(2000).max(9999), month:z.number().int().min(1).max(12), requiredUsdMinor:z.number().int().positive().safe(), paymentBatchId:z.string().min(1), paymentCurrency:z.enum(['USD','VES']), amountPaidMinor:z.number().int().positive().safe(), exchangeRate:z.string().optional(), paymentDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), notes:z.string().optional(), createdAt:stamp, updatedAt:stamp }).strict()
const history = contribution.extend({ voidedAt:stamp }).strict()
const backupSchema = z.object({ format:z.literal('reportesTOC-backup'), version:z.literal(1), exportedAt:stamp, data:z.object({ accounts:z.array(account), movements:z.array(movement), participants:z.array(participant), obligations:z.array(obligation), paymentBatches:z.array(batch), contributions:z.array(contribution), contributionHistory:z.array(history) }).strict() }).strict()
export type BackupData = z.infer<typeof backupSchema>
const tables = ['accounts','movements','participants','obligations','paymentBatches','contributions','contributionHistory'] as const

export function validateBackup(raw: unknown): BackupData {
  const parsed = backupSchema.parse(raw)
  const { data } = parsed
  const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) throw new Error(`El respaldo contiene ${label} duplicados`) }
  for (const key of tables) unique(data[key].map((item) => item.id), `identificadores de ${key}`)
  unique(data.accounts.map((item) => item.id), 'cuentas')
  unique(data.obligations.map((item) => item.effectiveMonth), 'vigencias')
  unique(data.contributions.map((item) => `${item.participantId}:${item.year}:${item.month}`), 'aportes activos para el mismo mes')
  const accounts = new Map(data.accounts.map((item) => [item.id,item]))
  const people = new Set(data.participants.map((item) => item.id))
  const batches = new Map(data.paymentBatches.map((item) => [item.id,item]))
  for (const row of data.movements) { const parent=accounts.get(row.accountId); if (!parent) throw new Error(`El movimiento ${row.id} apunta a una cuenta inexistente`); if ((parent.id==='usd-cash' && parent.currency!=='USD') || (parent.id!=='usd-cash' && parent.currency!=='VES')) throw new Error(`Moneda inválida para la cuenta ${parent.id}`) }
  const allContributions = [...data.contributions, ...data.contributionHistory]
  for (const row of allContributions) { const parent=batches.get(row.paymentBatchId); if (!people.has(row.participantId)||!parent||parent.participantId!==row.participantId||parent.currency!==row.paymentCurrency||parent.paymentDate!==row.paymentDate) throw new Error(`Relación inválida en el aporte ${row.id}`); if (parent.currency==='VES' && (!row.exchangeRate||!/^\d+(\.\d{1,8})?$/.test(row.exchangeRate))) throw new Error(`Tasa inválida en el aporte ${row.id}`) }
  for (const parent of data.paymentBatches) { if (!people.has(parent.participantId)) throw new Error(`El pago ${parent.id} apunta a un participante inexistente`); const entries=parent.status==='paid'?data.contributions.filter((row)=>row.paymentBatchId===parent.id):data.contributionHistory.filter((row)=>row.paymentBatchId===parent.id); if (!entries.length||entries.reduce((sum,row)=>sum+row.amountPaidMinor,0)!==parent.totalAmountMinor) throw new Error(`El total o detalle del pago ${parent.id} no coincide`) }
  return parsed
}

export async function createBackup(): Promise<BackupData> {
  const [accounts,movements,participants,obligations,paymentBatches,contributions,contributionHistory]=await Promise.all([db.accounts.toArray(),db.movements.toArray(),db.participants.toArray(),db.obligations.toArray(),db.paymentBatches.toArray(),db.contributions.toArray(),db.contributionHistory.toArray()])
  const data={accounts,movements,participants,obligations,paymentBatches,contributions,contributionHistory}
  return validateBackup({format:'reportesTOC-backup',version:1,exportedAt:new Date().toISOString(),data})
}

export function backupCounts(backup: BackupData) { return Object.fromEntries(tables.map((key)=>[key,backup.data[key].length])) as Record<typeof tables[number],number> }
export async function restoreBackup(raw: unknown) {
  const backup=validateBackup(raw)
  await db.transaction('rw',[db.accounts,db.movements,db.participants,db.obligations,db.paymentBatches,db.contributions,db.contributionHistory],async()=>{
    for(const key of tables) await db[key].clear()
    await db.accounts.bulkAdd(backup.data.accounts as FinancialAccount[])
    await db.movements.bulkAdd(backup.data.movements as FinancialMovement[])
    await db.participants.bulkAdd(backup.data.participants as Participant[])
    await db.obligations.bulkAdd(backup.data.obligations as ObligationSchedule[])
    await db.paymentBatches.bulkAdd(backup.data.paymentBatches as ContributionBatch[])
    await db.contributions.bulkAdd(backup.data.contributions as Contribution[])
    await db.contributionHistory.bulkAdd(backup.data.contributionHistory as ContributionHistory[])
  })
  return backupCounts(backup)
}

export function recordBackupDate(date: string) { if (typeof localStorage !== 'undefined') localStorage.setItem('reportesTOC.lastBackupAt',date) }
export function lastBackupDate() { return typeof localStorage === 'undefined' ? null : localStorage.getItem('reportesTOC.lastBackupAt') }
