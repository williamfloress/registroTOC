import 'fake-indexeddb/auto'
import { afterAll,beforeEach,describe,expect,it } from 'vitest'
import { db,ensureInitialAccounts,ensureInitialObligations,financeRepository,participantRepository } from '../../src/infrastructure/database'
import { contributionRepository } from '../../src/infrastructure/contributions'
import { createBackup,restoreBackup,validateBackup } from '../../src/infrastructure/backup'

const today=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
describe('respaldo y restauración',()=>{
 beforeEach(async()=>{await db.delete();await db.open();await ensureInitialAccounts();await ensureInitialObligations()})
 afterAll(()=>db.close())
 it('restaura el respaldo completo con sus relaciones',async()=>{
  const person=await participantRepository.save({firstName:'Ana',lastName:'Luz'})
  await financeRepository.saveMovement({accountId:'usd-cash',date:today(),description:'Donación',type:'income',amountMinor:2500})
  await contributionRepository.registerPayment({participantId:person.id,periods:[{year:2024,month:1}],paymentDate:today(),currency:'USD'})
  const backup=await createBackup();const counts={accounts:backup.data.accounts.length,movements:backup.data.movements.length,participants:backup.data.participants.length,obligations:backup.data.obligations.length,paymentBatches:backup.data.paymentBatches.length,contributions:backup.data.contributions.length,contributionHistory:backup.data.contributionHistory.length}
  await participantRepository.save({firstName:'Otra',lastName:'Persona'})
  expect(await restoreBackup(backup)).toEqual(counts)
  expect(await db.participants.count()).toBe(1);expect(await db.movements.count()).toBe(1);expect(await db.contributions.count()).toBe(1)
  expect(validateBackup(backup).data.paymentBatches[0].participantId).toBe(person.id)
 })
 it('rechaza archivo corrupto o con relaciones rotas antes de escribir',async()=>{
  const backup=await createBackup()
  await participantRepository.save({firstName:'Existente',lastName:'Local'})
  await expect(restoreBackup({...backup,version:99})).rejects.toThrow()
  const broken=structuredClone(backup);broken.data.movements.push({id:'bad',accountId:'missing',date:today(),description:'X',type:'income',amountMinor:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()})
  await expect(restoreBackup(broken)).rejects.toThrow('cuenta inexistente')
  expect(await db.participants.count()).toBe(1)
 })
})
