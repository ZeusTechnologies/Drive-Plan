export type ProfileRow = {
  id: string
  full_name: string | null
  email: string | null
  avatar_path: string | null
  currency: string
  created_at: string
  updated_at: string
}

export type TransactionRow = {
  id: string
  user_id: string
  gross_amount: number
  platform: string
  fuel_percentage: number
  fuel_amount: number
  commission_percentage: number
  commission_amount: number
  maintenance_percentage: number
  maintenance_amount: number
  savings_percentage: number
  savings_amount: number
  currency: string
  transaction_date: string
  created_at: string
  updated_at: string
}

export type AllocationRulesRow = {
  id: string
  user_id: string
  fuel_percentage: number
  commission_percentage: number
  maintenance_percentage: number
  savings_percentage: number
  uber_commission_percentage: number | null
  bolt_commission_percentage: number | null
  safeboda_commission_percentage: number | null
  faras_commission_percentage: number | null
  private_commission_percentage: number | null
  lolo_commission_percentage: number | null
  littlecab_commission_percentage: number | null
  ridenow_commission_percentage: number | null
  union_commission_percentage: number | null
  other_commission_percentage: number | null
  created_at: string
  updated_at: string
}

export type UserSettingsRow = {
  user_id: string
  selected_platform: string
  created_at: string
  updated_at: string
}

type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>
type Update<T> = Partial<T>

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Insert<ProfileRow, 'avatar_path' | 'currency' | 'created_at' | 'updated_at'>
        Update: Update<ProfileRow>
        Relationships: []
      }
      transactions: {
        Row: TransactionRow
        Insert: Insert<TransactionRow, 'id' | 'currency' | 'created_at' | 'updated_at'>
        Update: Update<TransactionRow>
        Relationships: []
      }
      allocation_rules: {
        Row: AllocationRulesRow
        Insert: Insert<AllocationRulesRow, 'id' | 'fuel_percentage' | 'commission_percentage' | 'maintenance_percentage' | 'savings_percentage' | 'uber_commission_percentage' | 'bolt_commission_percentage' | 'safeboda_commission_percentage' | 'faras_commission_percentage' | 'private_commission_percentage' | 'lolo_commission_percentage' | 'littlecab_commission_percentage' | 'ridenow_commission_percentage' | 'union_commission_percentage' | 'other_commission_percentage' | 'created_at' | 'updated_at'>
        Update: Update<AllocationRulesRow>
        Relationships: []
      }
      user_settings: {
        Row: UserSettingsRow
        Insert: Insert<UserSettingsRow, 'selected_platform' | 'created_at' | 'updated_at'>
        Update: Update<UserSettingsRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
