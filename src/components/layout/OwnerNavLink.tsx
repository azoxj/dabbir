import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { appConfig } from '@/config/env'
import { getSupabase } from '@/services/supabaseClient'

/** Server-side RPC authorization determines visibility; this is only a UX convenience. */
export function OwnerNavLink() {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    if (appConfig.mode !== 'supabase') return
    let active = true
    getSupabase().rpc('owner_analytics').then(({ error }) => {
      if (active && !error) setAllowed(true)
    }).catch(() => {})
    return () => { active = false }
  }, [])
  if (!allowed) return null
  return <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
    <Link to="/owner" className="inline-flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-brand-100">
      📊 لوحة إدارة دبّر
    </Link>
  </div>
}
