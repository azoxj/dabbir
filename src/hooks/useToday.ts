import { useEffect, useState } from 'react'
import { todayISO } from '@/lib/dates'
import type { ISODate } from '@/types/domain'

/** تاريخ اليوم المحلي، ويتحدث عند الرجوع للتطبيق بعد منتصف الليل (مهم لتطبيق PWA يبقى مفتوحًا). */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayISO())
  useEffect(() => {
    const refresh = () => setToday(todayISO())
    const timer = setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return today
}
