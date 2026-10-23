import {
  BookOpen,
  CandlestickChart,
  Images,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

const NAV: NavItem[] = [
  { to: '/', label: '總覽', icon: LayoutDashboard },
  { to: '/trades', label: '交易', icon: ListOrdered },
  { to: '/journal', label: '日誌', icon: BookOpen },
  { to: '/review', label: '覆盤', icon: Images },
  { to: '/import', label: '匯入', icon: Upload },
  { to: '/settings', label: '設定', icon: Settings },
]

export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-surface">
        <div className="flex h-14 items-center gap-2 px-5">
          <CandlestickChart className="size-5 text-accent" />
          <span className="font-semibold tracking-tight">SweepLog</span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg',
                  isActive && 'bg-surface-2 text-fg',
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
        <CandlestickChart className="size-5 text-accent" />
        <span className="font-semibold tracking-tight">SweepLog</span>
      </header>

      <main className="min-w-0 flex-1 px-4 pt-4 pb-24 md:px-8 md:pt-8 md:pb-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2 text-[11px] text-muted',
                isActive && 'text-accent',
              )
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
