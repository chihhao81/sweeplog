import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button, Card, Field, PageHeader } from '@/components/ui'
import { api } from '@/lib/api'
import { clearConnection, loadConnection, saveConnection } from '@/lib/settings'

export function SettingsPage() {
  const saved = loadConnection()
  const [apiUrl, setApiUrl] = useState(saved?.apiUrl ?? '')
  const [token, setToken] = useState(saved?.token ?? '')
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const ping = useMutation({ mutationFn: () => api.ping({ apiUrl: apiUrl.trim(), token: token.trim() }) })
  const setup = useMutation({ mutationFn: () => api.setup() })

  function onSave(e: FormEvent) {
    e.preventDefault()
    saveConnection({ apiUrl: apiUrl.trim(), token: token.trim() })
    setSavedAt(new Date().toLocaleTimeString())
  }

  function onClear() {
    clearConnection()
    setApiUrl('')
    setToken('')
    ping.reset()
    setup.reset()
  }

  const canSubmit = apiUrl.trim() !== '' && token.trim() !== ''

  return (
    <>
      <PageHeader title="設定" description="連線資訊只存在這台裝置的瀏覽器裡" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-medium">GAS 連線</h2>
          <form onSubmit={onSave} className="space-y-4">
            <Field
              label="Web App 網址"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              inputMode="url"
              autoComplete="off"
            />
            <Field
              label="API Token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              hint="與 GAS Script Properties 裡的 API_TOKEN 相同"
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!canSubmit}>
                儲存
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!canSubmit || ping.isPending}
                onClick={() => ping.mutate()}
              >
                {ping.isPending ? '測試中…' : '測試連線'}
              </Button>
              <Button type="button" variant="ghost" onClick={onClear}>
                清除
              </Button>
            </div>
            {savedAt && <p className="text-xs text-muted">已儲存（{savedAt}）</p>}
          </form>

          {ping.isSuccess && (
            <div className="mt-4 rounded-md border border-profit/30 bg-profit/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-profit">
                <CheckCircle2 className="size-4" /> 連線成功
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
                <dt>試算表</dt>
                <dd className="text-fg">{ping.data.spreadsheetName}</dd>
                <dt>版本</dt>
                <dd className="text-fg">{ping.data.version}</dd>
                <dt>工作表</dt>
                <dd className="text-fg">{ping.data.sheets.join('、') || '（無）'}</dd>
              </dl>
            </div>
          )}
          {ping.isError && <ErrorBox message={ping.error.message} />}
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">初始化試算表</h2>
          <p className="mb-4 text-sm text-muted">
            建立 SweepLog 需要的工作表與標題列。已存在的工作表不會被覆蓋，可以重複執行。
          </p>
          <Button
            variant="secondary"
            disabled={!saved || setup.isPending}
            onClick={() => setup.mutate()}
          >
            {setup.isPending ? '建立中…' : '建立 / 檢查工作表'}
          </Button>
          {!saved && <p className="mt-2 text-xs text-muted">請先儲存連線設定</p>}

          {setup.isSuccess && (
            <div className="mt-4 text-sm">
              <p className="text-profit">完成</p>
              <p className="mt-1 text-muted">
                新建立：{setup.data.created.join('、') || '無'}
                <br />
                已存在：{setup.data.existing.join('、') || '無'}
              </p>
            </div>
          )}
          {setup.isError && <ErrorBox message={setup.error.message} />}
        </Card>
      </div>
    </>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
      <XCircle className="mt-0.5 size-4 shrink-0" />
      <span className="break-all">{message}</span>
    </div>
  )
}
