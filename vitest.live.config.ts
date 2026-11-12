import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// اختبارات حية على مشروع Supabase الحقيقي بحسابين مؤقتين (انظر .github/workflows/live-accounts.yml).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/live/**/*.test.ts'], testTimeout: 60_000, hookTimeout: 900_000, fileParallelism: false },
})
