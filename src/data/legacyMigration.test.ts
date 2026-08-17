import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_RULES, calculateAllocation } from '../lib/finance'
import type { Transaction } from '../types'

const repository = vi.hoisted(() => ({
  importLegacyTransactions: vi.fn(),
  loadDrivePlanData: vi.fn(),
  saveAllocationRules: vi.fn(),
  updateUserSettings: vi.fn(),
}))

vi.mock('./drivePlanRepository', () => repository)

import {
  LEGACY_PLATFORM_KEY,
  LEGACY_RULES_KEY,
  LEGACY_TRANSACTIONS_KEY,
  migrateLegacyData,
} from './legacyMigration'

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-17T10:00:00.000Z'
const transaction: Transaction = {
  id: '11111111-1111-4111-8111-111111111111',
  platform: 'uber',
  currency: 'UGX',
  transactionDate: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...calculateAllocation(1000, DEFAULT_RULES, 'uber'),
}

function accountData(transactions: Transaction[], stored = false) {
  return {
    profile: null,
    transactions,
    rules: DEFAULT_RULES,
    hasStoredRules: stored,
    selectedPlatform: 'uber' as const,
    hasStoredSettings: stored,
  }
}

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  })
  vi.clearAllMocks()
})

describe('legacy DrivePlan data migration', () => {
  it('imports, verifies, and marks legacy data once without deleting it', async () => {
    localStorage.setItem(LEGACY_TRANSACTIONS_KEY, JSON.stringify([transaction]))
    localStorage.setItem(LEGACY_RULES_KEY, JSON.stringify(DEFAULT_RULES))
    localStorage.setItem(LEGACY_PLATFORM_KEY, JSON.stringify('uber'))
    repository.importLegacyTransactions.mockResolvedValue(true)
    repository.saveAllocationRules.mockResolvedValue(DEFAULT_RULES)
    repository.updateUserSettings.mockResolvedValue({})
    repository.loadDrivePlanData.mockResolvedValue(accountData([transaction], true))

    const result = await migrateLegacyData(userId, accountData([]))
    expect(result.data.transactions).toEqual([transaction])
    expect(repository.importLegacyTransactions).toHaveBeenCalledOnce()
    expect(repository.saveAllocationRules).toHaveBeenCalledOnce()
    expect(repository.updateUserSettings).toHaveBeenCalledOnce()
    expect(localStorage.getItem(LEGACY_TRANSACTIONS_KEY)).not.toBeNull()

    await migrateLegacyData(userId, accountData([transaction], true))
    expect(repository.importLegacyTransactions).toHaveBeenCalledOnce()
  })

  it('preserves legacy data and refuses an ambiguous server merge', async () => {
    localStorage.setItem(LEGACY_TRANSACTIONS_KEY, JSON.stringify([transaction]))
    localStorage.setItem(LEGACY_RULES_KEY, JSON.stringify(DEFAULT_RULES))
    localStorage.setItem(LEGACY_PLATFORM_KEY, JSON.stringify('uber'))
    const different = { ...transaction, grossAmount: 2000 }

    const result = await migrateLegacyData(userId, accountData([different], true))
    expect(result.notice).toContain('different server data')
    expect(repository.importLegacyTransactions).not.toHaveBeenCalled()
    expect(localStorage.getItem(LEGACY_TRANSACTIONS_KEY)).not.toBeNull()
  })
})
