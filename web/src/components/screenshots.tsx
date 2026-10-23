import { ExternalLink, ImagePlus, Images, Unlink, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Button, Card, ErrorBox } from '@/components/ui'
import { cn } from '@/lib/cn'
import { timeOf } from '@/lib/format'
import { driveFileUrl, driveImageUrl } from '@/lib/image'
import { useDeleteScreenshot, useUpdateScreenshot, useUploadScreenshot } from '@/lib/queries'
import type { Position, Screenshot } from '@/lib/types'

export interface UploadRequest {
  files: File[]
  positionIds: string[]
}

function positionLabel(p: Position): string {
  return `${timeOf(p.openedAt)} ${p.side === 'Long' ? '多' : '空'} ${p.contractName}`
}

/** Positions whose time window contains the file's timestamp (±30 min). */
function suggestPositions(files: File[], positions: Position[]): string[] {
  const slack = 30 * 60_000
  const ids = new Set<string>()
  for (const f of files) {
    for (const p of positions) {
      if (f.lastModified >= Date.parse(p.openedAt) - slack && f.lastModified <= Date.parse(p.closedAt) + slack) {
        ids.add(p.positionId)
      }
    }
  }
  return [...ids]
}

function imagesOf(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter((f) => f.type.startsWith('image/'))
}

/**
 * The day's screenshot pool. A screenshot can be linked to any number of the
 * day's positions, so one image can cover several trades.
 */
export function ScreenshotPanel({
  date,
  positions,
  shots,
  request,
  onRequest,
  focusId,
  viewing,
  onView,
}: {
  date: string
  positions: Position[]
  shots: Screenshot[]
  request: UploadRequest | null
  onRequest: (r: UploadRequest | null) => void
  focusId: string | null
  viewing: string | null
  onView: (id: string | null) => void
}) {
  const [dragging, setDragging] = useState(false)
  const card = useRef<HTMLDivElement>(null)

  // Bring the confirm step into view when an upload starts from elsewhere on the page.
  useEffect(() => {
    if (request) card.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [request])

  // Ctrl+V anywhere on the page adds clipboard images, linked to the open position.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = imagesOf(e.clipboardData?.files)
      if (files.length === 0) return
      e.preventDefault()
      onRequest({ files, positionIds: focusId ? [focusId] : [] })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [focusId, onRequest])

  function addFiles(files: File[]) {
    if (files.length === 0) return
    onRequest({ files, positionIds: focusId ? [focusId] : suggestPositions(files, positions) })
  }

  const viewed = shots.find((s) => s.id === viewing)

  return (
    <Card>
      <div ref={card} className="mb-3 flex scroll-mt-20 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium">
          <Images className="size-4 text-muted" /> 截圖
          <span className="text-xs font-normal text-muted">{shots.length} 張</span>
        </h2>
        <FilePicker onFiles={addFiles} label="上傳" />
      </div>

      {request ? (
        <UploadDialog date={date} positions={positions} request={request} onDone={() => onRequest(null)} />
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault()
            setDragging(false)
            addFiles(imagesOf(e.dataTransfer.files))
          }}
          className={cn('rounded-md', dragging && 'ring-2 ring-accent')}
        >
          {shots.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              拖曳圖片到這裡、按「上傳」，或直接 Ctrl+V 貼上
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onView(s.id)}
                  className="group overflow-hidden rounded-md border border-border bg-bg text-left hover:border-accent/60"
                >
                  <img
                    src={driveImageUrl(s.driveFileId, 480)}
                    alt={s.caption ?? s.fileName}
                    loading="lazy"
                    className="aspect-video w-full object-cover"
                  />
                  <div className="truncate px-2 py-1.5 text-xs text-muted">
                    {s.positionIds.length === 0 ? (
                      <span className="text-warn">未關聯部位</span>
                    ) : (
                      linkedLabels(s, positions)
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {viewed && (
        <Lightbox date={date} shot={viewed} positions={positions} onClose={() => onView(null)} />
      )}
    </Card>
  )
}

function linkedLabels(s: Screenshot, positions: Position[]): string {
  return positions
    .filter((p) => s.positionIds.includes(p.positionId))
    .map((p) => `${timeOf(p.openedAt)} ${p.side === 'Long' ? '多' : '空'}`)
    .join('、')
}

export function FilePicker({ onFiles, label }: { onFiles: (files: File[]) => void; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
        <ImagePlus className="size-4" /> {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles(imagesOf(e.target.files))
          e.target.value = ''
        }}
      />
    </>
  )
}

/** Confirms which positions new screenshots belong to, then uploads them one by one. */
function UploadDialog({
  date,
  positions,
  request,
  onDone,
}: {
  date: string
  positions: Position[]
  request: UploadRequest
  onDone: () => void
}) {
  const [selected, setSelected] = useState<string[]>(request.positionIds)
  const [done, setDone] = useState(0)
  const upload = useUploadScreenshot(date)
  const previews = useMemo(() => request.files.map((f) => URL.createObjectURL(f)), [request.files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  const busy = upload.isPending || (done > 0 && done < request.files.length)

  async function start() {
    for (const [i, file] of request.files.entries()) {
      if (i < done) continue // resume after a failure
      await upload.mutateAsync({ file, positionIds: selected })
      setDone(i + 1)
    }
    onDone()
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <div className="space-y-4 rounded-md border border-accent/40 bg-accent/5 p-3">
      <div className="flex gap-2 overflow-x-auto">
        {previews.map((u, i) => (
          <img
            key={u}
            src={u}
            alt=""
            className={cn('h-20 shrink-0 rounded border border-border', i < done && 'opacity-40')}
          />
        ))}
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted">
          這{request.files.length > 1 ? ` ${request.files.length} 張` : '張'}截圖屬於哪些部位？（可複選，也可以之後再改）
        </div>
        {positions.length === 0 ? (
          <p className="text-sm text-muted">這天沒有交易，截圖會存成當日截圖</p>
        ) : (
          <PositionChips positions={positions} selected={selected} onToggle={toggle} disabled={busy} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" disabled={busy} onClick={start}>
          {busy ? `上傳中 ${done + 1}/${request.files.length}…` : `上傳 ${request.files.length} 張`}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
          取消
        </Button>
      </div>
      {upload.isError && <ErrorBox message={`第 ${done + 1} 張上傳失敗：${upload.error.message}`} />}
    </div>
  )
}

function PositionChips({
  positions,
  selected,
  onToggle,
  disabled,
}: {
  positions: Position[]
  selected: string[]
  onToggle: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {positions.map((p) => {
        const on = selected.includes(p.positionId)
        return (
          <button
            key={p.positionId}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => onToggle(p.positionId)}
            className={cn(
              'tabular rounded-full border px-3 py-1 text-sm disabled:opacity-50',
              on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-fg',
            )}
          >
            {positionLabel(p)}
          </button>
        )
      })}
    </div>
  )
}

function Lightbox({
  date,
  shot,
  positions,
  onClose,
}: {
  date: string
  shot: Screenshot
  positions: Position[]
  onClose: () => void
}) {
  const update = useUpdateScreenshot(date)
  const remove = useDeleteScreenshot(date)
  const [caption, setCaption] = useState(shot.caption ?? '')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (id: string) => {
    const next = shot.positionIds.includes(id)
      ? shot.positionIds.filter((x) => x !== id)
      : [...shot.positionIds, id]
    update.mutate({ id: shot.id, positionIds: next })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black/90 md:flex-row"
      onClick={onClose}
    >
      <div className="flex min-h-0 flex-1 items-center justify-center p-2 md:p-6">
        <img
          src={driveImageUrl(shot.driveFileId, 2400)}
          alt={shot.caption ?? shot.fileName}
          className="max-h-full max-w-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <aside
        className="max-h-[45dvh] shrink-0 space-y-4 overflow-y-auto border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:max-h-none md:w-80 md:border-t-0 md:border-l"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="truncate text-sm text-muted">{shot.fileName}</span>
          <button type="button" onClick={onClose} aria-label="關閉" className="text-muted hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-medium text-muted">關聯部位</div>
          {positions.length === 0 ? (
            <p className="text-sm text-muted">這天沒有交易</p>
          ) : (
            <PositionChips positions={positions} selected={shot.positionIds} onToggle={toggle} />
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">說明</span>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== (shot.caption ?? '') && update.mutate({ id: shot.id, caption: caption || null })}
            placeholder="例：15m 結構、進場位置"
            className="h-9 w-full rounded-md border border-border bg-bg px-3 text-sm outline-none focus:border-accent"
          />
        </label>

        {update.isError && <ErrorBox message={update.error.message} />}

        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href={driveFileUrl(shot.driveFileId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 text-sm hover:bg-border"
          >
            <ExternalLink className="size-4" /> 在 Drive 開啟
          </a>
          <Button
            type="button"
            variant="ghost"
            className="text-loss hover:text-loss"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm('從紀錄移除這張截圖？Drive 上的檔案會保留，不會被刪除。')) {
                remove.mutate(shot.id, { onSuccess: onClose })
              }
            }}
          >
            <Unlink className="size-4" /> {remove.isPending ? '移除中…' : '從紀錄移除'}
          </Button>
        </div>
        {remove.isError && <ErrorBox message={remove.error.message} />}
      </aside>
    </div>
  )
}

/** Thumbnails of one position's screenshots, plus a shortcut to add more. */
export function PositionShots({
  shots,
  onAdd,
  onOpen,
}: {
  shots: Screenshot[]
  onAdd: (files: File[]) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pt-3">
      {shots.map((s) => (
        <button key={s.id} type="button" onClick={() => onOpen(s.id)} className="shrink-0">
          <img
            src={driveImageUrl(s.driveFileId, 320)}
            alt={s.caption ?? s.fileName}
            loading="lazy"
            className="h-16 rounded border border-border object-cover hover:border-accent/60"
          />
        </button>
      ))}
      <FilePicker onFiles={onAdd} label={shots.length ? '加截圖' : '附加截圖'} />
    </div>
  )
}
