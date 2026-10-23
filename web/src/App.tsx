import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createHashRouter, RouterProvider } from 'react-router'
import { Layout } from '@/components/Layout'
import { DayPage } from '@/pages/DayPage'
import { ImportPage } from '@/pages/ImportPage'
import { DashboardPage, JournalPage } from '@/pages/Placeholders'
import { SettingsPage } from '@/pages/SettingsPage'
import { TradesPage } from '@/pages/TradesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    // GAS round-trips are slow (~1-2s); lean on the cache.
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

// Hash routing so deep links survive a refresh on GitHub Pages.
const router = createHashRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'trades', element: <TradesPage /> },
      { path: 'day/:date', element: <DayPage /> },
      { path: 'journal', element: <JournalPage /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
