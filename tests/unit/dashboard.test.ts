import { describe, expect, it } from 'vitest'
import { summarizeContributionMonth } from '../../src/domain/dashboard'
import type { Contribution, Participant } from '../../src/domain/finance'

const person=(id:string,active:boolean):Participant=>({id,firstName:'Ana',lastName:'Carmelita',active,createdAt:'2025-01-01T00:00:00.000Z',updatedAt:'2025-01-01T00:00:00.000Z'})
const contribution=(id:string,participantId:string,year:number,month:number,currency:'USD'|'VES',amountPaidMinor:number,exchangeRate?:string):Contribution=>({id,participantId,year,month,requiredUsdMinor:100,paymentBatchId:`batch-${id}`,paymentCurrency:currency,amountPaidMinor,exchangeRate,paymentDate:`${year}-${String(month).padStart(2,'0')}-10`,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'})

describe('resumen mensual de aportes',()=>{
  it('separa cumplidos activos, meses sin registro y montos recibidos por moneda',()=>{
    const result=summarizeContributionMonth([person('a',true),person('b',true),person('old',false)],[contribution('usd','a',2026,3,'USD',100),contribution('ves','old',2026,3,'VES',45000,'450')],2026,3)
    expect(result).toEqual({activeCount:2,paidCount:1,withoutRecordCount:1,usdReceivedMinor:100,vesReceivedMinor:45000,vesEquivalentUsdMinor:100})
  })

  it('solo resume el período elegido y no inventa pagos',()=>{
    const result=summarizeContributionMonth([person('a',true)],[contribution('old','a',2026,2,'USD',100)],2026,3)
    expect(result).toEqual({activeCount:1,paidCount:0,withoutRecordCount:1,usdReceivedMinor:0,vesReceivedMinor:0,vesEquivalentUsdMinor:0})
  })
})
