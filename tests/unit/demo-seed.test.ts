import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateBackup } from '../../src/infrastructure/backup'

describe('respaldo de datos de prueba', () => {
  it('seed/demo-backup.json cumple el esquema y las relaciones del respaldo', () => {
    const raw = JSON.parse(readFileSync('seed/demo-backup.json', 'utf-8'))
    const backup = validateBackup(raw)
    expect(backup.data.participants.length).toBeGreaterThan(10)
    expect(backup.data.movements.length).toBeGreaterThan(50)
  })
})
