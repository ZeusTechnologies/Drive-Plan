import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import {
  createTransaction,
  deleteTransaction,
  loadDrivePlanData,
  saveAllocationRules,
  updateTransaction,
  updateUserSettings,
  uploadProfileAvatar,
} from '../data/drivePlanRepository'
import { migrateLegacyData } from '../data/legacyMigration'
import { calculateAllocation, DEFAULT_RULES } from '../lib/finance'
import type { AllocationRules, Platform, Transaction } from '../types'
import type { ProfileRow } from '../types/database'

interface AccountState {
  userId: string
  profile: ProfileRow | null
  transactions: Transaction[]
  rules: AllocationRules
  lastPlatform: Platform
}

export function useDrivePlan() {
  const { user } = useAuth()
  const [account, setAccount] = useState<AccountState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [migrationNotice, setMigrationNotice] = useState<string | null>(null)
  const loadGeneration = useRef(0)
  const activeUserId = user?.id ?? null
  const currentAccount = account?.userId === activeUserId ? account : null

  useEffect(() => {
    const generation = ++loadGeneration.current
    setLoadError('')
    setMigrationNotice(null)
    if (!activeUserId) {
      setAccount(null)
      return
    }
    void (async () => {
      try {
        const initialData = await loadDrivePlanData()
        const migrated = await migrateLegacyData(activeUserId, initialData)
        if (generation !== loadGeneration.current) return
        setAccount({
          userId: activeUserId,
          profile: migrated.data.profile,
          transactions: migrated.data.transactions,
          rules: migrated.data.rules,
          lastPlatform: migrated.data.selectedPlatform,
        })
        setMigrationNotice(migrated.notice)
      } catch {
        if (generation !== loadGeneration.current) return
        setAccount(null)
        setLoadError('DrivePlan could not load your account data. Check your connection and try again.')
      }
    })()
    return () => { loadGeneration.current += 1 }
  }, [activeUserId])

  const requireAccount = useCallback(() => {
    if (!currentAccount) throw new Error('Your DrivePlan account is still loading.')
    return currentAccount
  }, [currentAccount])

  const api = useMemo(() => ({
    async add(grossAmount: number, platform: Platform, transactionDate = new Date().toISOString()) {
      const loaded = requireAccount()
      const now = new Date().toISOString()
      const allocation = calculateAllocation(grossAmount, loaded.rules, platform)
      const saved = await createTransaction({
        id: crypto.randomUUID(), platform, currency: 'UGX', transactionDate,
        createdAt: now, updatedAt: now, ...allocation,
      })
      setAccount((state) => state?.userId === loaded.userId
        ? { ...state, transactions: [saved, ...state.transactions], lastPlatform: platform }
        : state)
      void updateUserSettings(platform).catch(() => {
        setMigrationNotice('The transaction was saved, but DrivePlan could not save the platform preference.')
      })
    },
    async update(id: string, grossAmount: number, platform: Platform, transactionDate: string) {
      const loaded = requireAccount()
      const item = loaded.transactions.find((transaction) => transaction.id === id)
      if (!item) throw new Error('This transaction is no longer available.')
      const storedRules: AllocationRules = {
        fuel: item.fuelPercentage,
        commission: item.commissionPercentage,
        maintenance: item.maintenancePercentage,
        savings: item.savingsPercentage,
        platformCommissions: { [platform]: item.commissionPercentage },
      }
      const saved = await updateTransaction({
        ...item,
        ...calculateAllocation(grossAmount, storedRules, platform),
        platform,
        transactionDate,
        updatedAt: new Date().toISOString(),
      })
      setAccount((state) => state?.userId === loaded.userId
        ? { ...state, transactions: state.transactions.map((transaction) => transaction.id === id ? saved : transaction), lastPlatform: platform }
        : state)
      void updateUserSettings(platform).catch(() => {
        setMigrationNotice('The transaction was updated, but DrivePlan could not save the platform preference.')
      })
    },
    async remove(id: string) {
      const loaded = requireAccount()
      await deleteTransaction(id)
      setAccount((state) => state?.userId === loaded.userId
        ? { ...state, transactions: state.transactions.filter((transaction) => transaction.id !== id) }
        : state)
    },
    async setRules(rules: AllocationRules) {
      const loaded = requireAccount()
      const saved = await saveAllocationRules(rules)
      setAccount((state) => state?.userId === loaded.userId ? { ...state, rules: saved } : state)
    },
    async updateAvatar(file: File) {
      const loaded = requireAccount()
      const profile = await uploadProfileAvatar(file)
      setAccount((state) => state?.userId === loaded.userId ? { ...state, profile } : state)
    },
  }), [requireAccount])

  return {
    transactions: currentAccount?.transactions ?? [],
    profile: currentAccount?.profile ?? null,
    rules: currentAccount?.rules ?? DEFAULT_RULES,
    lastPlatform: currentAccount?.lastPlatform ?? 'uber',
    dataLoading: Boolean(activeUserId) && !currentAccount && !loadError,
    dataError: loadError,
    migrationNotice,
    ...api,
  }
}
