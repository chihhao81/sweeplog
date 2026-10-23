import { useMutation } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Button, Card, ErrorBox } from '@/components/ui'
import { callApi } from '@/lib/api'

/** Downloads every sheet as one JSON file. Screenshots stay in Drive; only their records are included. */
export function BackupCard() {
  const backup = useMutation({
    mutationFn: () => callApi<unknown>('exportAll'),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sweeplog-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  return (
    <Card>
      <h2 className="mb-1 font-medium">備份</h2>
      <p className="mb-4 text-sm text-muted">
        把試算表所有資料下載成一個 JSON 檔。截圖檔案本身留在 Drive，備份裡只有截圖紀錄。
      </p>
      <Button variant="secondary" disabled={backup.isPending} onClick={() => backup.mutate()}>
        <Download className="size-4" /> {backup.isPending ? '匯出中…' : '下載備份'}
      </Button>
      {backup.isError && <ErrorBox message={backup.error.message} />}
    </Card>
  )
}
