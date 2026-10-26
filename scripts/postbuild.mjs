// GitHub Pages has no SPA rewrites: copy the shell to every public route so
// they answer 200, keep 404.html as the fallback for dynamic URLs, and write
// robots.txt + sitemap.xml (with one entry per published property when the
// Supabase values are available at build time).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const DIST = 'dist'
const BASE_PATH = (process.env.VITE_BASE ?? '/sweet-house-immo/').replace(/\/$/, '')
const ORIGIN = process.env.SITE_ORIGIN ?? 'https://yassir1778.github.io'
const BASE = `${ORIGIN}${BASE_PATH}`
const ROUTES = ['biens', 'vendre', 'agence', 'contact', 'favoris', 'admin']

// Demo build (no database): sample listings must never be indexed by Google.
const DEMO = !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY
if (DEMO) {
  const html = readFileSync(`${DIST}/index.html`, 'utf8').replace('<head>', '<head>\n    <meta name="robots" content="noindex, nofollow" />')
  writeFileSync(`${DIST}/index.html`, html)
}

copyFileSync(`${DIST}/index.html`, `${DIST}/404.html`)
for (const r of ROUTES) {
  mkdirSync(`${DIST}/${r}`, { recursive: true })
  copyFileSync(`${DIST}/index.html`, `${DIST}/${r}/index.html`)
}

const today = new Date().toISOString().slice(0, 10)
const url = (path, lastmod = today) => `  <url><loc>${BASE}/${path}</loc><lastmod>${lastmod}</lastmod></url>`

async function propertyPages() {
  const api = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!api || !key) return []
  try {
    const r = await fetch(`${api}/rest/v1/re_public_properties?select=ref,updated_at`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!r.ok) return []
    return (await r.json()).map((x) => ({ path: `biens/${x.ref}`, lastmod: String(x.updated_at ?? today).slice(0, 10) }))
  } catch {
    return []
  }
}

// Demo build: real files for the sample properties too, so shared links answer 200 (WhatsApp previews).
function demoPages() {
  try {
    const seed = readFileSync('src/shared/lib/seed.ts', 'utf8')
    return [...new Set([...seed.matchAll(/ref: '([A-Z]+-\d+)'/g)].map((m) => m[1]))].map((ref) => ({ path: `biens/${ref}`, lastmod: today }))
  } catch {
    return []
  }
}

const dynamic = DEMO ? demoPages() : await propertyPages()
for (const d of dynamic) {
  mkdirSync(`${DIST}/${d.path}`, { recursive: true })
  copyFileSync(`${DIST}/index.html`, `${DIST}/${d.path}/index.html`)
}
writeFileSync(
  `${DIST}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    [...['', ...ROUTES.filter((r) => !['admin', 'favoris'].includes(r))].map((r) => url(r ? r + '/' : '')), ...dynamic.map((d) => url(d.path, d.lastmod))].join('\n') +
    `\n</urlset>\n`,
)
writeFileSync(
  `${DIST}/robots.txt`,
  DEMO ? `User-agent: *\nDisallow: /\n` : `User-agent: *\nAllow: ${BASE_PATH}/\nDisallow: ${BASE_PATH}/admin/\nSitemap: ${BASE}/sitemap.xml\n`,
)
console.log(`postbuild${DEMO ? ' (demo, noindex)' : ''}: routes, 404, sitemap (+${dynamic.length} property pages), robots`)
