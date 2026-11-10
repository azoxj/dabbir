/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { copyFile, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])))
  return files.flat()
}

/**
 * بعد البناء:
 * - يحقن قائمة الملفات (مسارات نسبية للـ base) ورقم إصدار في dist/sw.js.
 * - ينسخ index.html إلى 404.html: GitHub Pages يخدمه لأي مسار غير موجود، فيعمل تحديث الصفحة على /dabbir/budget.
 * - ينشئ .nojekyll حتى لا يتجاهل GitHub Pages أي ملفات.
 */
function dabbirPwa(): Plugin {
  let outDir = 'dist'
  return {
    name: 'dabbir-pwa',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    async closeBundle() {
      const files = (await walk(outDir))
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => !['sw.js', 'index.html', '404.html', '.nojekyll', 'CNAME'].includes(f) && !f.endsWith('.map'))
      // ‎.woff نسخ احتياطية لمتصفحات قديمة جدًا؛ كل المتصفحات المستهدفة تدعم woff2.
      const precache = ['', ...files.filter((f) => !f.endsWith('.woff'))].sort()
      const hash = createHash('sha256')
      for (const f of precache) hash.update(f)
      hash.update(await readFile(join(outDir, 'index.html')))
      const version = hash.digest('hex').slice(0, 12)
      const swPath = join(outDir, 'sw.js')
      const sw = await readFile(swPath, 'utf8')
      await writeFile(swPath, `self.__DABBIR_PRECACHE__ = ${JSON.stringify(precache)};\n` + sw.replace('__DABBIR_SW_VERSION__', version))
      await copyFile(join(outDir, 'index.html'), join(outDir, '404.html'))
      await writeFile(join(outDir, '.nojekyll'), '')
    },
  }
}

/** CSP في نسخة الإنتاج فقط (خادم التطوير يحتاج سكربتات inline). يسمح بالاتصال بمشروع Supabase المحدد فقط. */
function dabbirCsp(supabaseUrl: string | undefined): Plugin {
  let connect = "'self'"
  try {
    if (supabaseUrl) {
      const u = new URL(supabaseUrl)
      connect += ` ${u.origin} wss://${u.host}`
    }
  } catch { /* رابط غير صالح: التطبيق سيعمل بالوضع التجريبي */ }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.googleusercontent.com",
    "font-src 'self'",
    `connect-src ${connect}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  return {
    name: 'dabbir-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`),
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    // مسارات نسبية: نفس الملفات تعمل من https://azoxj.github.io/dabbir/ ومن https://dabbir.online/
    // (المسار الفعلي يُحدد وقت التشغيل في src/config/base.ts).
    base: './',
    plugins: [react(), tailwindcss(), dabbirCsp(env.VITE_SUPABASE_URL), dabbirPwa()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: { sourcemap: false, target: 'es2022' },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  }
})
