/**
 * Supabase Client Configuration
 * PostgreSQL database for trade history, positions, performance
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing API credentials - NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '')

// Test connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase
      .from('trades')
      .select('count(*)', { count: 'exact' })
      .limit(1)

    if (error) {
      console.error('❌ Supabase connection failed:', error.message)
      return false
    }
    
    console.log('✅ Connected to Supabase')
    return true
  } catch (err) {
    console.error('❌ Supabase error:', err.message)
    return false
  }
}

export default supabase
