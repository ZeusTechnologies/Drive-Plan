import { describe, expect, it } from 'vitest'
import { calculateAllocation, DEFAULT_RULES, inPeriod, totalTransactions } from './finance'
import type { Transaction } from '../types'

describe('financial engine', () => {
  it('allocates UGX 100,000 with the default split', () => {
    expect(calculateAllocation(100000, DEFAULT_RULES, 'uber')).toMatchObject({
      fuelAmount: 25000, commissionAmount: 26530, maintenanceAmount: 10000, savingsAmount: 38470,
    })
  })
  it('gives Karibu trips the commission remainder as savings', () => {
    const value = calculateAllocation(100000, DEFAULT_RULES, 'private')
    expect(value).toMatchObject({ commissionAmount: 0, savingsAmount: 65000, savingsPercentage: 65 })
  })
  it.each([
    ['uber', 26.53], ['bolt', 16], ['safeboda', 18], ['faras', 10], ['private', 0],
    ['lolo', 7.41], ['littlecab', 15], ['ridenow', 15], ['union', 15],
  ] as const)('uses the real %s commission rate', (platform, commissionPercentage) => {
    const value = calculateAllocation(100000, DEFAULT_RULES, platform)
    expect(value.commissionPercentage).toBe(commissionPercentage)
    expect(value.savingsPercentage).toBeCloseTo(65 - commissionPercentage)
    expect(value.fuelAmount + value.commissionAmount + value.maintenanceAmount + value.savingsAmount).toBe(100000)
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
    const base = { id: '1', platform: 'uber', fuelPercentage: 25, commissionPercentage: 20, maintenancePercentage: 10, savingsPercentage: 45, currency: 'UGX', createdAt: '', updatedAt: '' } as const
    const items = [
      { ...base, transactionDate: '2026-08-16T10:00:00', grossAmount: 100, fuelAmount: 30, commissionAmount: 20, maintenanceAmount: 10, savingsAmount: 40 },
      { ...base, id: '2', transactionDate: '2026-07-01T10:00:00', grossAmount: 50, fuelAmount: 15, commissionAmount: 10, maintenanceAmount: 5, savingsAmount: 20 },
    ] satisfies Transaction[]
    expect(totalTransactions(items).gross).toBe(150)
    expect(items.filter((item) => inPeriod(item, 'today', new Date('2026-08-16T18:00:00')))).toHaveLength(1)
    expect(items.filter((item) => inPeriod(item, 'month', new Date('2026-08-16T18:00:00')))).toHaveLength(1)
  })
})
