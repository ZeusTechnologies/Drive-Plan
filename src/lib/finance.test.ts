import { describe, expect, it } from 'vitest'
import { calculateAllocation, DEFAULT_RULES, inPeriod, totalTransactions } from './finance'
import type { Transaction } from '../types'

describe('financial engine', () => {
  it('allocates UGX 100,000 with the default split', () => {
    expect(calculateAllocation(100000, DEFAULT_RULES, 'uber')).toMatchObject({
      fuelAmount: 30000, commissionAmount: 20000, maintenanceAmount: 10000, savingsAmount: 40000,
    })
  })
  it('gives private trips the commission remainder as savings', () => {
    const value = calculateAllocation(100000, DEFAULT_RULES, 'private')
    expect(value).toMatchObject({ commissionAmount: 0, savingsAmount: 60000, savingsPercentage: 60 })
  })
  it.each([1, 7, 99999, 999999999])('preserves the gross invariant for %i', (amount) => {
    const value = calculateAllocation(amount, DEFAULT_RULES, 'bolt')
    expect(value.fuelAmount + value.commissionAmount + value.maintenanceAmount + value.savingsAmount).toBe(amount)
  })
  it('rejects zero and invalid amounts', () => {
    expect(() => calculateAllocation(0, DEFAULT_RULES, 'uber')).toThrow()
    expect(() => calculateAllocation(20.5, DEFAULT_RULES, 'uber')).toThrow()
  })
  it('aggregates and filters transactions', () => {
    const base = { id: '1', platform: 'uber', fuelPercentage: 30, commissionPercentage: 20, maintenancePercentage: 10, savingsPercentage: 40, currency: 'UGX', createdAt: '', updatedAt: '' } as const
    const items = [
      { ...base, transactionDate: '2026-08-16T10:00:00', grossAmount: 100, fuelAmount: 30, commissionAmount: 20, maintenanceAmount: 10, savingsAmount: 40 },
      { ...base, id: '2', transactionDate: '2026-07-01T10:00:00', grossAmount: 50, fuelAmount: 15, commissionAmount: 10, maintenanceAmount: 5, savingsAmount: 20 },
    ] satisfies Transaction[]
    expect(totalTransactions(items).gross).toBe(150)
    expect(items.filter((item) => inPeriod(item, 'today', new Date('2026-08-16T18:00:00')))).toHaveLength(1)
    expect(items.filter((item) => inPeriod(item, 'month', new Date('2026-08-16T18:00:00')))).toHaveLength(1)
  })
})
