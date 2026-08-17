import { supabase } from '../lib/supabase'
import { DEFAULT_RULES } from '../lib/finance'
import { platforms, type AllocationRules, type Platform, type Transaction } from '../types'
import type { AllocationRulesRow, ProfileRow, TransactionRow, UserSettingsRow } from '../types/database'

const platformSet = new Set<string>(platforms)

async function authenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Your session could not be verified. Please sign in again.')
  return data.user.id
}

function asPlatform(value: string): Platform {
  if (!platformSet.has(value)) throw new Error('The database returned an unsupported platform.')
  return value as Platform
}

export function transactionFromRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    grossAmount: row.gross_amount,
    platform: asPlatform(row.platform),
    fuelPercentage: row.fuel_percentage,
    fuelAmount: row.fuel_amount,
    commissionPercentage: row.commission_percentage,
    commissionAmount: row.commission_amount,
    maintenancePercentage: row.maintenance_percentage,
    maintenanceAmount: row.maintenance_amount,
    savingsPercentage: row.savings_percentage,
    savingsAmount: row.savings_amount,
    currency: 'UGX',
    transactionDate: row.transaction_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function transactionToRow(transaction: Transaction, userId: string) {
  return {
    id: transaction.id,
    user_id: userId,
    gross_amount: transaction.grossAmount,
    platform: transaction.platform,
    fuel_percentage: transaction.fuelPercentage,
    fuel_amount: transaction.fuelAmount,
    commission_percentage: transaction.commissionPercentage,
    commission_amount: transaction.commissionAmount,
    maintenance_percentage: transaction.maintenancePercentage,
    maintenance_amount: transaction.maintenanceAmount,
    savings_percentage: transaction.savingsPercentage,
    savings_amount: transaction.savingsAmount,
    currency: transaction.currency,
    transaction_date: transaction.transactionDate,
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
  }
}

export function rulesFromRow(row: AllocationRulesRow | null): AllocationRules {
  if (!row) return DEFAULT_RULES
  const platformCommissions: AllocationRules['platformCommissions'] = {}
  const values: Record<Platform, number | null> = {
    uber: row.uber_commission_percentage,
    bolt: row.bolt_commission_percentage,
    safeboda: row.safeboda_commission_percentage,
    faras: row.faras_commission_percentage,
    private: row.private_commission_percentage,
    lolo: row.lolo_commission_percentage,
    littlecab: row.littlecab_commission_percentage,
    ridenow: row.ridenow_commission_percentage,
    union: row.union_commission_percentage,
    other: row.other_commission_percentage,
  }
  for (const platform of platforms) {
    const value = values[platform]
    if (value !== null) platformCommissions[platform] = value
  }
  return {
    fuel: row.fuel_percentage,
    commission: row.commission_percentage,
    maintenance: row.maintenance_percentage,
    savings: row.savings_percentage,
    platformCommissions,
  }
}

export function rulesToRow(rules: AllocationRules, userId: string) {
  return {
    user_id: userId,
    fuel_percentage: rules.fuel,
    commission_percentage: rules.commission,
    maintenance_percentage: rules.maintenance,
    savings_percentage: rules.savings,
    uber_commission_percentage: rules.platformCommissions.uber ?? null,
    bolt_commission_percentage: rules.platformCommissions.bolt ?? null,
    safeboda_commission_percentage: rules.platformCommissions.safeboda ?? null,
    faras_commission_percentage: rules.platformCommissions.faras ?? null,
    private_commission_percentage: rules.platformCommissions.private ?? null,
    lolo_commission_percentage: rules.platformCommissions.lolo ?? null,
    littlecab_commission_percentage: rules.platformCommissions.littlecab ?? null,
    ridenow_commission_percentage: rules.platformCommissions.ridenow ?? null,
    union_commission_percentage: rules.platformCommissions.union ?? null,
    other_commission_percentage: rules.platformCommissions.other ?? null,
  }
}

async function loadForUser(userId: string) {
  const [profileResult, transactionsResult, rulesResult, settingsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('transactions').select('*').eq('user_id', userId).order('transaction_date', { ascending: false }),
    supabase.from('allocation_rules').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
  ])
  const error = profileResult.error ?? transactionsResult.error ?? rulesResult.error ?? settingsResult.error
  if (error) throw new Error('DrivePlan could not load your account data. Check your connection and try again.')
  return {
    profile: profileResult.data,
    transactions: (transactionsResult.data ?? []).map(transactionFromRow),
    rules: rulesFromRow(rulesResult.data),
    hasStoredRules: rulesResult.data !== null,
    selectedPlatform: settingsResult.data ? asPlatform(settingsResult.data.selected_platform) : 'uber' as Platform,
    hasStoredSettings: settingsResult.data !== null,
  }
}

export async function loadDrivePlanData() {
  return loadForUser(await authenticatedUserId())
}

export async function getProfile(): Promise<ProfileRow | null> {
  return (await loadForUser(await authenticatedUserId())).profile
}

export async function updateProfile(changes: Pick<ProfileRow, 'full_name' | 'currency'>): Promise<ProfileRow> {
  const userId = await authenticatedUserId()
  const { data, error } = await supabase.from('profiles').update(changes).eq('id', userId).select().single()
  if (error) throw new Error('Your profile could not be updated.')
  return data
}

export function profileAvatarUrl(profile: ProfileRow | null): string | null {
  if (!profile?.avatar_path) return null
  const { data } = supabase.storage.from('driveplan-avatars').getPublicUrl(profile.avatar_path)
  return `${data.publicUrl}?v=${encodeURIComponent(profile.updated_at)}`
}

export async function uploadProfileAvatar(file: File): Promise<ProfileRow> {
  const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!acceptedTypes.has(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > 2 * 1024 * 1024) throw new Error('Profile pictures must be 2 MB or smaller.')

  const userId = await authenticatedUserId()
  const avatarPath = `${userId}/avatar`
  const { error: uploadError } = await supabase.storage.from('driveplan-avatars').upload(avatarPath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true,
  })
  if (uploadError) throw new Error('Your profile picture could not be uploaded.')

  const { data, error } = await supabase.from('profiles').update({ avatar_path: avatarPath }).eq('id', userId).select().single()
  if (error) throw new Error('Your uploaded picture could not be linked to your profile.')
  return data
}

export async function getTransactions(): Promise<Transaction[]> {
  return (await loadForUser(await authenticatedUserId())).transactions
}

export async function createTransaction(transaction: Transaction): Promise<Transaction> {
  const userId = await authenticatedUserId()
  const { data, error } = await supabase.from('transactions').insert(transactionToRow(transaction, userId)).select().single()
  if (error) throw new Error('The transaction was not saved. Please try again.')
  return transactionFromRow(data)
}

export async function updateTransaction(transaction: Transaction): Promise<Transaction> {
  const userId = await authenticatedUserId()
  const row = transactionToRow(transaction, userId)
  const changes = {
    gross_amount: row.gross_amount,
    platform: row.platform,
    fuel_percentage: row.fuel_percentage,
    fuel_amount: row.fuel_amount,
    commission_percentage: row.commission_percentage,
    commission_amount: row.commission_amount,
    maintenance_percentage: row.maintenance_percentage,
    maintenance_amount: row.maintenance_amount,
    savings_percentage: row.savings_percentage,
    savings_amount: row.savings_amount,
    currency: row.currency,
    transaction_date: row.transaction_date,
    updated_at: row.updated_at,
  }
  const { data, error } = await supabase.from('transactions').update(changes).eq('id', transaction.id).eq('user_id', userId).select().single()
  if (error) throw new Error('The transaction was not updated. Please try again.')
  return transactionFromRow(data)
}

export async function deleteTransaction(id: string): Promise<void> {
  const userId = await authenticatedUserId()
  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId)
  if (error) throw new Error('The transaction was not deleted. Please try again.')
}

export async function getAllocationRules(): Promise<AllocationRules> {
  return (await loadForUser(await authenticatedUserId())).rules
}

export async function saveAllocationRules(rules: AllocationRules): Promise<AllocationRules> {
  const userId = await authenticatedUserId()
  const { data, error } = await supabase.from('allocation_rules').upsert(rulesToRow(rules, userId), { onConflict: 'user_id' }).select().single()
  if (error) throw new Error('Your allocation rules were not saved. Please try again.')
  return rulesFromRow(data)
}

export async function deleteAllocationRules(): Promise<void> {
  const userId = await authenticatedUserId()
  const { error } = await supabase.from('allocation_rules').delete().eq('user_id', userId)
  if (error) throw new Error('Your allocation rules were not removed.')
}

export async function getUserSettings(): Promise<UserSettingsRow | null> {
  const userId = await authenticatedUserId()
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Your settings could not be loaded.')
  return data
}

export async function updateUserSettings(selectedPlatform: Platform): Promise<UserSettingsRow> {
  const userId = await authenticatedUserId()
  const { data, error } = await supabase.from('user_settings').upsert({ user_id: userId, selected_platform: selectedPlatform }, { onConflict: 'user_id' }).select().single()
  if (error) throw new Error('Your platform preference was not saved.')
  return data
}

export async function importLegacyTransactions(transactions: Transaction[]): Promise<boolean> {
  if (transactions.length === 0) return true
  const userId = await authenticatedUserId()
  const chunkSize = 250
  for (let offset = 0; offset < transactions.length; offset += chunkSize) {
    const rows = transactions.slice(offset, offset + chunkSize).map((transaction) => transactionToRow(transaction, userId))
    const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error('Legacy transactions could not be migrated safely.')
  }
  const verifiedIds = new Set<string>()
  for (let offset = 0; offset < transactions.length; offset += chunkSize) {
    const ids = transactions.slice(offset, offset + chunkSize).map((transaction) => transaction.id)
    const { data, error } = await supabase.from('transactions').select('id').eq('user_id', userId).in('id', ids)
    if (error) throw new Error('Legacy transaction migration could not be verified.')
    for (const row of data) verifiedIds.add(row.id)
  }
  return verifiedIds.size === new Set(transactions.map((transaction) => transaction.id)).size
}
