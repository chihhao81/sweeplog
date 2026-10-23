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

export function TradesPage() {
  return (
    <>
      <PageHeader title="交易" description="所有交易紀錄與手動欄位" />
      <EmptyState title="還沒有交易資料" hint="Phase 2 開放" />
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

export function ImportPage() {
  return (
    <>
      <PageHeader title="匯入" description="上傳 Topstep 匯出的 Trades / Orders CSV" />
      <EmptyState title="匯入功能建置中" hint="Phase 2 開放" />
    </>
  )
}
