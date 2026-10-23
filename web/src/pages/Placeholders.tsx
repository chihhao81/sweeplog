import { EmptyState, PageHeader } from '@/components/ui'

// Stubs for pages built in later phases.

export function DashboardPage() {
  return (
    <>
      <PageHeader title="總覽" description="損益日曆、權益曲線與各項統計" />
      <EmptyState title="還沒有交易資料" hint="先到「匯入」上傳 Topstep 報表" />
    </>
  )
}

export function JournalPage() {
  return (
    <>
      <PageHeader title="日誌" description="盤前計畫與盤後檢討" />
      <EmptyState title="還沒有日誌" hint="Phase 3 開放" />
    </>
  )
}
