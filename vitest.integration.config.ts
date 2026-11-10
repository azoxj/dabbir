import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// اختبارات تكامل على Supabase محلي حقيقي (npm run supabase:start أولًا).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
