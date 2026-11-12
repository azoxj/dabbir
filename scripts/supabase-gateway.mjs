// بوابة محلية تحاكي بوابة Supabase (Kong): /auth/v1 → GoTrue و /rest/v1 → PostgREST،
// مع التحقق من ترويسة apikey و CORS. للتطوير والاختبار المحلي فقط.
import { createServer, request } from 'node:http'

const OPEN_AUTH_PATHS = ['/auth/v1/verify', '/auth/v1/callback', '/auth/v1/authorize', '/auth/v1/health']
const ALLOW_HEADERS = 'authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, range, x-supabase-api-version, x-retry-count'

export function startGateway({ port = 54321, authPort = 54329, restPort = 54323, apiKeys }) {
  const server = createServer((req, res) => {
    const origin = req.headers.origin
    const cors = origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': ALLOW_HEADERS,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'content-range, x-supabase-api-version',
      Vary: 'Origin',
    } : {}
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }

    const url = new URL(req.url, 'http://gateway')
    let target
    if (url.pathname.startsWith('/auth/v1/')) target = { port: authPort, path: url.pathname.slice('/auth/v1'.length) + url.search }
    else if (url.pathname.startsWith('/rest/v1/')) target = { port: restPort, path: url.pathname.slice('/rest/v1'.length) + url.search }
    else { res.writeHead(404, { ...cors, 'content-type': 'application/json' }); return res.end('{"message":"no route"}') }

    const key = req.headers.apikey ?? url.searchParams.get('apikey')
    if (!OPEN_AUTH_PATHS.includes(url.pathname) && !apiKeys.includes(key)) {
      res.writeHead(401, { ...cors, 'content-type': 'application/json' })
      return res.end('{"message":"Invalid API key"}')
    }
    const headers = { ...req.headers, host: `localhost:${target.port}` }
    // مثل Kong: إذا لم يرسل العميل Authorization نستخدم apikey كـ Bearer (دور anon).
    if (!headers.authorization && key) headers.authorization = `Bearer ${key}`
    const upstream = request({ host: '127.0.0.1', port: target.port, path: target.path, method: req.method, headers }, (up) => {
      // البوابة وحدها تحدد CORS (مثل Kong في Supabase): نحذف ترويسات CORS القادمة من الخدمات لتجنّب التكرار.
      const headers = Object.fromEntries(Object.entries(up.headers).filter(([k]) => !k.toLowerCase().startsWith('access-control-')))
      res.writeHead(up.statusCode ?? 502, { ...headers, ...cors })
      up.pipe(res)
    })
    upstream.on('error', (e) => { res.writeHead(502, cors); res.end(String(e.message)) })
    req.pipe(upstream)
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keys = (process.env.GATEWAY_API_KEYS ?? '').split(',').filter(Boolean)
  if (!keys.length) { console.error('GATEWAY_API_KEYS required'); process.exit(2) }
  await startGateway({ apiKeys: keys })
  console.log('gateway listening on http://localhost:54321')
}
