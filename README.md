# سويت هاوس للعقار — Sweet House Immobilier

Real-estate agency website (Tétouan) + owner dashboard + secretary workspace.

- **Site** (AR / FR / ES): search, map, property pages, visit requests, sell-your-property, favourites, mortgage calculator, SEO.
- **Dashboard** (`/admin`): KPIs, commissions, lead pipeline, team performance, activity log, website settings.
- **Secretary desk**: calls log, agenda, leads board, clients with automatic property matching, tasks, WhatsApp templates, printable visit vouchers and QR window cards.

Stack: React 19 · Vite 8 · Tailwind 4 · TanStack Query · Leaflet · Recharts · Supabase (optional — runs in demo mode with sample data when not configured).

```bash
npm install
npm run dev      # http://localhost:5174/sweet-house-immo/
npm run build    # dist/ (+ 404.html, sitemap.xml, robots.txt)
```

- Database: run `supabase/schema.sql` in the Supabase SQL editor (set the owner e-mail first).
- Full guide (Arabic): [docs/GUIDE.md](docs/GUIDE.md)
