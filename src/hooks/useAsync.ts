import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { dataError, type AppError } from '@/services/errors'

export interface AsyncState<T> {
  data: T | undefined
  error: AppError | null
  loading: boolean
  /** دالة ثابتة (لا تتغير بين الرسومات). */
  reload: () => Promise<void>
}

/**
 * يحمّل بيانات غير متزامنة ويعيد التحميل عند تغيّر deps.
 * يتجاهل نتائج الطلبات القديمة إذا بدأ طلب أحدث قبل اكتمالها.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<AppError | null>(null)
  const [loading, setLoading] = useState(true)
  const callId = useRef(0)
  const loaderRef = useRef(loader)
  useLayoutEffect(() => {
    loaderRef.current = loader
  })

  const reload = useCallback(async () => {
    const id = ++callId.current
    setLoading(true)
    try {
      const result = await loaderRef.current()
      if (id === callId.current) {
        setData(result)
        setError(null)
      }
    } catch (e) {
      if (id === callId.current) setError(dataError(e))
    } finally {
      if (id === callId.current) setLoading(false)
    }
  }, [])

  const depsKey = JSON.stringify(deps.map((d) => (typeof d === 'object' && d !== null ? identity(d) : d)))
  useEffect(() => {
    // جلب بيانات عند تغيّر المدخلات: setLoading(true) هنا مقصود.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload, depsKey])

  return { data, error, loading, reload }
}

/** معرّف ثابت لكل كائن (مثل المستودع) حتى يدخل في مفتاح deps. */
const ids = new WeakMap<object, number>()
let nextId = 1
function identity(o: object): string {
  let id = ids.get(o)
  if (!id) ids.set(o, (id = nextId++))
  return `#${id}`
}
