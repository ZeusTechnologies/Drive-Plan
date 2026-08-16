import type { AllocationRules, Platform, Totals, Transaction } from '../types'

export const DEFAULT_RULES: AllocationRules = {
  fuel: 25,
  commission: 20,
  maintenance: 10,
  savings: 45,
  platformCommissions: {
    uber: 26.53,
    bolt: 16,
    safeboda: 18,
    faras: 10,
    private: 0,
    lolo: 7.41,
    littlecab: 15,
    ridenow: 15,
    union: 15,
  },
}

const portion = (amount: number, percentage: number) => Math.round((amount * percentage) / 100)

export function calculateAllocation(grossAmount: number, rules: AllocationRules, platform: Platform) {
  if (!Number.isInteger(grossAmount) || grossAmount <= 0) throw new Error('Enter a whole amount greater than zero.')
  const commissionPercentage = rules.platformCommissions[platform] ?? rules.commission
  const savingsPercentage = 100 - rules.fuel - rules.maintenance - commissionPercentage
  if (savingsPercentage < 0) throw new Error('Allocation rates exceed 100%.')
  const fuelAmount = portion(grossAmount, rules.fuel)
  const commissionAmount = portion(grossAmount, commissionPercentage)
  const maintenanceAmount = portion(grossAmount, rules.maintenance)
  const savingsAmount = grossAmount - fuelAmount - commissionAmount - maintenanceAmount
  return {
    grossAmount,
    fuelPercentage: rules.fuel,
    fuelAmount,
    commissionPercentage,
    commissionAmount,
    maintenancePercentage: rules.maintenance,
    maintenanceAmount,
    savingsPercentage,
    savingsAmount,
  }
}

export function totalTransactions(items: Transaction[]): Totals {
  return items.reduce<Totals>((sum, item) => ({
    gross: sum.gross + item.grossAmount,
    fuel: sum.fuel + item.fuelAmount,
    commission: sum.commission + item.commissionAmount,
    maintenance: sum.maintenance + item.maintenanceAmount,
    savings: sum.savings + item.savingsAmount,
    trips: sum.trips + 1,
  }), { gross: 0, fuel: 0, commission: 0, maintenance: 0, savings: 0, trips: 0 })
}

export const formatUGX = (amount: number) => `UGX ${Math.round(amount).toLocaleString('en-UG')}`
export const formatCompact = (amount: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(amount)

export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const startOfWeek = (date = new Date()) => {
  const value = new Date(date)
  const day = value.getDay() || 7
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - day + 1)
  return value
}

export type Period = 'today' | 'week' | 'month' | 'all'
export function inPeriod(transaction: Transaction, period: Period, now = new Date()) {
  const date = new Date(transaction.transactionDate)
  if (period === 'all') return true
  if (period === 'today') return localDateKey(date) === localDateKey(now)
  if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  return date >= startOfWeek(now) && date <= now
}
