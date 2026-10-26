import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/shared/lib/auth'
import { I18nProvider, useI18n } from '@/shared/lib/i18n'
import { ConfirmProvider, FullSpinner } from '@/shared/ui/base'
import { SiteLayout } from './apps/site/Layout'
import { Home } from './apps/site/pages/Home'

// The home page ships in the first bundle; every other page loads on demand.
const Listings = lazy(() => import('./apps/site/pages/Listings').then((m) => ({ default: m.Listings })))
const PropertyPage = lazy(() => import('./apps/site/pages/Property').then((m) => ({ default: m.PropertyPage })))
const Sell = lazy(() => import('./apps/site/pages/Sell').then((m) => ({ default: m.Sell })))
const Agency = lazy(() => import('./apps/site/pages/Agency').then((m) => ({ default: m.Agency })))
const Contact = lazy(() => import('./apps/site/pages/Contact').then((m) => ({ default: m.Contact })))
const Favorites = lazy(() => import('./apps/site/pages/Favorites').then((m) => ({ default: m.Favorites })))
const NotFound = lazy(() => import('./apps/site/pages/NotFound').then((m) => ({ default: m.NotFound })))
const AdminApp = lazy(() => import('./apps/admin/AdminApp'))

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
const basename = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

function AppToaster() {
  const { dir } = useI18n()
  return <Toaster position="top-center" richColors closeButton dir={dir} toastOptions={{ style: { fontFamily: 'inherit' } }} />
}

export function App() {
  return (
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ConfirmProvider>
          <BrowserRouter basename={basename}>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<Home />} />
                <Route path="biens" element={<Listings />} />
                <Route path="biens/:ref" element={<PropertyPage />} />
                <Route path="vendre" element={<Sell />} />
                <Route path="agence" element={<Agency />} />
                <Route path="contact" element={<Contact />} />
                <Route path="favoris" element={<Favorites />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route
                path="admin/*"
                element={
                  <Suspense fallback={<FullSpinner />}>
                    <AuthProvider>
                      <AdminApp />
                    </AuthProvider>
                  </Suspense>
                }
              />
            </Routes>
          </BrowserRouter>
          <AppToaster />
        </ConfirmProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
