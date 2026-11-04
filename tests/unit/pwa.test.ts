import { afterEach,describe,expect,it } from 'vitest'
import { requestStoragePersistence } from '../../src/pwa'

const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator')
function mockStorage(storage:unknown){Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage}})}
afterEach(()=>{if(previous)Object.defineProperty(globalThis,'navigator',previous);else Reflect.deleteProperty(globalThis,'navigator')})

describe('solicitud de almacenamiento persistente',()=>{
 it('reconoce cuando el navegador ya protege el origen',async()=>{
  mockStorage({persisted:async()=>true,persist:async()=>false})
  await expect(requestStoragePersistence()).resolves.toBe('persistent')
 })
 it('informa cuando el navegador concede persistencia',async()=>{
  mockStorage({persisted:async()=>false,persist:async()=>true})
  await expect(requestStoragePersistence()).resolves.toBe('persistent')
 })
 it('explica que el almacenamiento es de mejor esfuerzo cuando no se concede',async()=>{
  mockStorage({persisted:async()=>false,persist:async()=>false})
  await expect(requestStoragePersistence()).resolves.toBe('best-effort')
 })
 it('detecta navegadores sin la API de almacenamiento',async()=>{
  mockStorage(undefined)
  await expect(requestStoragePersistence()).resolves.toBe('unsupported')
 })
})
