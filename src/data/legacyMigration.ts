import { importLegacyTransactions, loadDrivePlanData, saveAllocationRules, updateUserSettings } from './drivePlanRepository'
import { platforms, type AllocationRules, type Platform, type Transaction } from '../types'

export const LEGACY_TRANSACTIONS_KEY = 'driveplan.transactions.v1'
export const LEGACY_RULES_KEY = 'driveplan.rules.v2'
export const LEGACY_PLATFORM_KEY = 'driveplan.last-platform'
export const DATA_MIGRATION_VERSION = 1

const MIGRATION_OWNER_KEY = `driveplan.data-migration-owner.v${DATA_MIGRATION_VERSION}`
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const platformSet = new Set<string>(platforms)

interface MigrationMarker {
  status: 'complete'
  completedAt: string
  transactionIds: string[]
}

function markerKey(userId: string) {
  return `driveplan.data-migration.v${DATA_MIGRATION_VERSION}.${userId}`
}

function parse(key: string): unknown {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try { return JSON.parse(raw) as unknown } catch { return undefined }
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validPlatform(value: unknown): value is Platform {
  return typeof value === 'string' && platformSet.has(value)
}

function validTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  const amounts = [item.fuelAmount, item.commissionAmount, item.maintenanceAmount, item.savingsAmount]
  const percentages = [item.fuelPercentage, item.commissionPercentage, item.maintenancePercentage, item.savingsPercentage]
  return typeof item.id === 'string' && uuidPattern.test(item.id)
    && finite(item.grossAmount) && Number.isInteger(item.grossAmount) && item.grossAmount > 0
    && validPlatform(item.platform)
    && amounts.every((amount) => finite(amount) && Number.isInteger(amount) && amount >= 0)
    && amounts.reduce<number>((sum, amount) => sum + (amount as number), 0) === item.grossAmount
    && percentages.every((percentage) => finite(percentage) && percentage >= 0 && percentage <= 100)
    && Math.abs(percentages.reduce<number>((sum, percentage) => sum + (percentage as number), 0) - 100) < 0.001
    && item.currency === 'UGX'
    && typeof item.transactionDate === 'string' && Number.isFinite(Date.parse(item.transactionDate))
    && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))
    && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt))
}

function validRules(value: unknown): value is AllocationRules {
  if (!value || typeof value !== 'object') return false
  const rules = value as Record<string, unknown>
  const percentages = [rules.fuel, rules.commission, rules.maintenance, rules.savings]
  if (!percentages.every((percentage) => finite(percentage) && percentage >= 0 && percentage <= 100)) return false
  if (Math.abs(percentages.reduce<number>((sum, percentage) => sum + (percentage as number), 0) - 100) >= 0.001) return false
  if (!rules.platformCommissions || typeof rules.platformCommissions !== 'object') return false
  return Object.entries(rules.platformCommissions as Record<string, unknown>).every(([platform, rate]) => (
    platformSet.has(platform) && finite(rate) && rate >= 0 && rate <= 60
  ))
}

function readMarker(userId: string): MigrationMarker | null {
  const value = parse(markerKey(userId))
  if (!value || typeof value !== 'object') return null
  const marker = value as Record<string, unknown>
  if (marker.status !== 'complete' || !Array.isArray(marker.transactionIds)) return null
  return marker as unknown as MigrationMarker
}

function sameTransaction(left: Transaction, right: Transaction): boolean {
  return left.id === right.id
    && left.grossAmount === right.grossAmount
    && left.platform === right.platform
    && left.fuelPercentage === right.fuelPercentage
    && left.fuelAmount === right.fuelAmount
    && left.commissionPercentage === right.commissionPercentage
    && left.commissionAmount === right.commissionAmount
    && left.maintenancePercentage === right.maintenancePercentage
    && left.maintenanceAmount === right.maintenanceAmount
    && left.savingsPercentage === right.savingsPercentage
    && left.savingsAmount === right.savingsAmount
    && left.currency === right.currency
    && Date.parse(left.transactionDate) === Date.parse(right.transactionDate)
    && Date.parse(left.createdAt) === Date.parse(right.createdAt)
}

function sameRules(left: AllocationRules, right: AllocationRules): boolean {
  return left.fuel === right.fuel
    && left.commission === right.commission
    && left.maintenance === right.maintenance
    && left.savings === right.savings
    && platforms.every((platform) => left.platformCommissions[platform] === right.platformCommissions[platform])
}

export interface LegacyMigrationResult {
  data: Awaited<ReturnType<typeof loadDrivePlanData>>
  notice: string | null
}

export async function migrateLegacyData(
  userId: string,
  initialData: Awaited<ReturnType<typeof loadDrivePlanData>>,
): Promise<LegacyMigrationResult> {
  if (readMarker(userId)) return { data: initialData, notice: null }

  const rawTransactions = parse(LEGACY_TRANSACTIONS_KEY)
  const rawRules = parse(LEGACY_RULES_KEY)
  const rawPlatform = parse(LEGACY_PLATFORM_KEY)
  const hasLegacyData = rawTransactions !== null || rawRules !== null || rawPlatform !== null
  if (!hasLegacyData) {
    localStorage.setItem(markerKey(userId), JSON.stringify({ status: 'complete', completedAt: new Date().toISOString(), transactionIds: [] } satisfies MigrationMarker))
    return { data: initialData, notice: null }
  }

  const owner = localStorage.getItem(MIGRATION_OWNER_KEY)
  if (owner && owner !== userId) {
    return { data: initialData, notice: 'Legacy data remains safely stored on this device because it is already associated with another DrivePlan account.' }
  }
  if (!Array.isArray(rawTransactions) || !rawTransactions.every(validTransaction) || !validRules(rawRules) || !validPlatform(rawPlatform)) {
    return { data: initialData, notice: 'Legacy data remains safely stored on this device because DrivePlan could not validate it for automatic migration.' }
  }

  const legacyTransactions = rawTransactions as Transaction[]
  if ((initialData.hasStoredRules && !sameRules(initialData.rules, rawRules))
    || (initialData.hasStoredSettings && initialData.selectedPlatform !== rawPlatform)) {
    return { data: initialData, notice: 'Legacy data remains safely stored on this device because this account already contains different server settings. No automatic merge was attempted.' }
  }
  if (initialData.transactions.length > 0) {
    const serverById = new Map(initialData.transactions.map((transaction) => [transaction.id, transaction]))
    if (!legacyTransactions.every((transaction) => {
      const serverTransaction = serverById.get(transaction.id)
      return serverTransaction ? sameTransaction(transaction, serverTransaction) : false
    })) {
      return { data: initialData, notice: 'Legacy data remains safely stored on this device because this account already contains different server data. No automatic merge was attempted.' }
    }
  } else if (!await importLegacyTransactions(legacyTransactions)) {
    return { data: initialData, notice: 'Legacy data remains safely stored on this device because the database migration could not be verified.' }
  }

  if (!initialData.hasStoredRules) await saveAllocationRules(rawRules)
  if (!initialData.hasStoredSettings) await updateUserSettings(rawPlatform)

  const verifiedData = await loadDrivePlanData()
  const verifiedById = new Map(verifiedData.transactions.map((transaction) => [transaction.id, transaction]))
  const verified = legacyTransactions.every((transaction) => {
    const saved = verifiedById.get(transaction.id)
    return saved ? sameTransaction(transaction, saved) : false
  }) && sameRules(verifiedData.rules, rawRules) && verifiedData.selectedPlatform === rawPlatform
  if (!verified) {
    return { data: verifiedData, notice: 'Legacy data remains safely stored on this device because database verification did not complete.' }
  }

  localStorage.setItem(MIGRATION_OWNER_KEY, userId)
  localStorage.setItem(markerKey(userId), JSON.stringify({
    status: 'complete',
    completedAt: new Date().toISOString(),
    transactionIds: legacyTransactions.map((transaction) => transaction.id),
  } satisfies MigrationMarker))
  return { data: verifiedData, notice: legacyTransactions.length > 0 ? 'Existing device transactions were copied securely to your DrivePlan account.' : null }
}
