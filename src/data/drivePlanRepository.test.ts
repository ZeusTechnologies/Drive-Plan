import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from '../lib/finance'
import type { AllocationRules, Transaction } from '../types'
import type { AllocationRulesRow, TransactionRow } from '../types/database'
import { rulesFromRow, rulesToRow, transactionFromRow, transactionToRow } from './drivePlanRepository'

const transaction: Transaction = {
  id: '11111111-1111-4111-8111-111111111111',
  grossAmount: 1000,
  platform: 'uber',
  fuelPercentage: 25,
  fuelAmount: 250,
  commissionPercentage: 20,
  commissionAmount: 200,
  maintenancePercentage: 10,
  maintenanceAmount: 100,
  savingsPercentage: 45,
  savingsAmount: 450,
  currency: 'UGX',
  transactionDate: '2026-08-17T10:00:00.000Z',
  createdAt: '2026-08-17T10:00:00.000Z',
  updatedAt: '2026-08-17T10:00:00.000Z',
}

describe('DrivePlan database mapping', () => {
  it('maps the complete transaction snapshot without losing financial values', () => {
    const insert = transactionToRow(transaction, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const row: TransactionRow = insert
    expect(row.user_id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(transactionFromRow(row)).toEqual(transaction)
  })

  it('maps every platform commission and the global allocation atomically', () => {
    const rules: AllocationRules = {
      fuel: 20,
      commission: 25,
      maintenance: 15,
      savings: 40,
      platformCommissions: {
        uber: 24.5,
        bolt: 21,
        safeboda: 19,
        faras: 18,
        private: 0,
        lolo: 17,
        littlecab: 16,
        ridenow: 15,
        union: 14,
        other: 13,
      },
    }
    const insert = rulesToRow(rules, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const row: AllocationRulesRow = {
      id: '22222222-2222-4222-8222-222222222222',
      created_at: '2026-08-17T10:00:00.000Z',
      updated_at: '2026-08-17T10:00:00.000Z',
      ...insert,
    }
    expect(rulesFromRow(row)).toEqual(rules)
  })

  it('uses the existing DrivePlan defaults when no rules row exists', () => {
    expect(rulesFromRow(null)).toBe(DEFAULT_RULES)
  })
})
