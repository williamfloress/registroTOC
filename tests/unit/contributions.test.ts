import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db, ensureInitialObligations, participantRepository } from '../../src/infrastructure/database'
import { contributionRepository } from '../../src/infrastructure/contributions'

function localToday(){const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function thisPeriod(){const date=new Date();return {year:date.getFullYear(),month:date.getMonth()+1}}

describe('pagos de aportes',()=>{
  beforeEach(async()=>{await db.delete();await db.open();await ensureInitialObligations()})
  afterAll(()=>db.close())

  it('registra meses agrupados en VES con la tasa histórica y sin duplicados',async()=>{
    const created=await participantRepository.save({firstName:'María',lastName:'Carmelita'})
    await db.obligations.add({id:'obligation-2024-02',effectiveMonth:'2024-02',amountUsdMinor:200,createdAt:'2024-02-01T00:00:00.000Z',updatedAt:'2024-02-01T00:00:00.000Z'})
    const batch=await contributionRepository.registerPayment({participantId:created.id,periods:[{year:2024,month:3},{year:2024,month:1},{year:2024,month:2}],paymentDate:localToday(),currency:'VES',exchangeRate:'450,00',rateSource:'Referencia guardada'})
    const entries=await contributionRepository.periodsForBatch(batch.id)
    expect(batch).toMatchObject({currency:'VES',totalAmountMinor:225000,exchangeRate:'450.00',rateSource:'Referencia guardada',status:'paid'})
    expect(entries.map(({year,month,requiredUsdMinor,amountPaidMinor})=>({year,month,requiredUsdMinor,amountPaidMinor}))).toEqual([
      {year:2024,month:1,requiredUsdMinor:100,amountPaidMinor:45000},
      {year:2024,month:2,requiredUsdMinor:200,amountPaidMinor:90000},
      {year:2024,month:3,requiredUsdMinor:200,amountPaidMinor:90000},
    ])
    await expect(contributionRepository.registerPayment({participantId:created.id,periods:[{year:2024,month:2}],paymentDate:localToday(),currency:'USD'})).rejects.toThrow('Ya existe un aporte')
    expect(await db.movements.count()).toBe(0)
  })

  it('anula el lote completo, conserva su detalle y permite registrar los meses de nuevo',async()=>{
    const created=await participantRepository.save({firstName:'Ana',lastName:'Flor'})
    await db.participants.update(created.id,{createdAt:'2020-01-15T12:00:00.000Z'})
    const periods=[{year:2025,month:1},{year:2025,month:2}]
    const first=await contributionRepository.registerPayment({participantId:created.id,periods,paymentDate:localToday(),currency:'USD'})
    const voided=await contributionRepository.voidBatch(first.id)
    expect(voided.periods).toHaveLength(2)
    expect(await contributionRepository.periodsForBatch(first.id)).toHaveLength(0)
    expect(await contributionRepository.historyForBatch(first.id)).toHaveLength(2)
    expect((await contributionRepository.batch(first.id))?.status).toBe('void')
    const replacement=await contributionRepository.registerPayment({participantId:created.id,periods,paymentDate:localToday(),currency:'USD'})
    expect(await contributionRepository.periodsForBatch(replacement.id)).toHaveLength(2)
    expect(await db.contributionHistory.count()).toBe(2)
    expect(await db.movements.count()).toBe(0)
  })

  it('registra un pago individual en USD y rechaza períodos futuros o participantes inactivos',async()=>{
    const created=await participantRepository.save({firstName:'Teresa',lastName:'Luz'})
    const period=thisPeriod()
    const batch=await contributionRepository.registerPayment({participantId:created.id,periods:[period],paymentDate:localToday(),currency:'USD'})
    expect(batch.totalAmountMinor).toBe(100)
    await expect(contributionRepository.registerPayment({participantId:created.id,periods:[{year:period.year+1,month:1}],paymentDate:localToday(),currency:'USD'})).rejects.toThrow('todavía no está disponible')
    await participantRepository.setActive(created.id,false)
    await expect(contributionRepository.registerPayment({participantId:created.id,periods:[{year:period.year,month:period.month+1>12?1:period.month+1}],paymentDate:localToday(),currency:'USD'})).rejects.toThrow('participante inactivo')
  })
})
