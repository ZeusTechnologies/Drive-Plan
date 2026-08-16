import { useEffect, useMemo, useState } from 'react'
import { calculateAllocation, DEFAULT_RULES } from '../lib/finance'
import type { AllocationRules, Platform, Transaction } from '../types'

const TRANSACTIONS_KEY = 'driveplan.transactions.v1'
const RULES_KEY = 'driveplan.rules.v2'
const PLATFORM_KEY = 'driveplan.last-platform'

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch { return fallback }
}

export function useDrivePlan() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => read(TRANSACTIONS_KEY, []))
  const [rules, setRules] = useState<AllocationRules>(() => read(RULES_KEY, DEFAULT_RULES))
  const [lastPlatform, setLastPlatform] = useState<Platform>(() => read(PLATFORM_KEY, 'uber'))

  useEffect(() => localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions)), [transactions])
  useEffect(() => localStorage.setItem(RULES_KEY, JSON.stringify(rules)), [rules])
  useEffect(() => localStorage.setItem(PLATFORM_KEY, JSON.stringify(lastPlatform)), [lastPlatform])

  // localStorage is the offline source of truth. Storage events keep every
  // open tab/window in sync without requiring a network connection.
  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || !event.newValue) return
      try {
        if (event.key === TRANSACTIONS_KEY) setTransactions(JSON.parse(event.newValue) as Transaction[])
        if (event.key === RULES_KEY) setRules(JSON.parse(event.newValue) as AllocationRules)
        if (event.key === PLATFORM_KEY) setLastPlatform(JSON.parse(event.newValue) as Platform)
      } catch {
        // Ignore malformed external writes and retain the last valid state.
      }
    }
    window.addEventListener('storage', syncFromStorage)
    return () => window.removeEventListener('storage', syncFromStorage)
  }, [])

  const api = useMemo(() => ({
    add(grossAmount: number, platform: Platform, transactionDate = new Date().toISOString()) {
      const now = new Date().toISOString()
      const allocation = calculateAllocation(grossAmount, rules, platform)
      setTransactions((items) => [{
        id: crypto.randomUUID(), platform, currency: 'UGX', transactionDate,
        createdAt: now, updatedAt: now, ...allocation,
      }, ...items])
      setLastPlatform(platform)
    },
    update(id: string, grossAmount: number, platform: Platform, transactionDate: string) {
      setTransactions((items) => items.map((item) => {
        if (item.id !== id) return item
        const storedRules: AllocationRules = {
          fuel: item.fuelPercentage,
          commission: item.commissionPercentage,
          maintenance: item.maintenancePercentage,
          savings: item.savingsPercentage,
          platformCommissions: { [platform]: item.commissionPercentage },
        }
        return { ...item, ...calculateAllocation(grossAmount, storedRules, platform), platform, transactionDate, updatedAt: new Date().toISOString() }
      }))
      setLastPlatform(platform)
    },
    remove(id: string) { setTransactions((items) => items.filter((item) => item.id !== id)) },
  }), [rules])

  return { transactions, rules, setRules, lastPlatform, setLastPlatform, ...api }
}
