export const platforms = ['uber', 'bolt', 'safeboda', 'faras', 'private', 'lolo', 'littlecab', 'ridenow', 'union', 'other'] as const
export type Platform = (typeof platforms)[number]

export interface AllocationRules {
  fuel: number
  commission: number
  maintenance: number
  savings: number
  platformCommissions: Partial<Record<Platform, number>>
}

export interface Transaction {
  id: string
  grossAmount: number
  platform: Platform
  fuelPercentage: number
  fuelAmount: number
  commissionPercentage: number
  commissionAmount: number
  maintenancePercentage: number
  maintenanceAmount: number
  savingsPercentage: number
  savingsAmount: number
  currency: 'UGX'
  transactionDate: string
  createdAt: string
  updatedAt: string
}

export interface Totals {
  gross: number
  fuel: number
  commission: number
  maintenance: number
  savings: number
  trips: number
}
