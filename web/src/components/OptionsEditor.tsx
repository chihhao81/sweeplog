import { useState } from 'react'
import { TextArea } from '@/components/form'
import { Button, Card, ErrorBox } from '@/components/ui'
import { OPTION_LABELS, type JournalOptions } from '@/lib/options'
import { useOptions, useSaveOptions } from '@/lib/queries'

const KEYS = Object.keys(OPTION_LABELS) as (keyof JournalOptions)[]

/** Edits the journal choice lists, one option per line. */
export function OptionsEditor() {
  const options = useOptions()
  if (options.isError) return <ErrorBox message={options.error.message} />
  return options.data ? <OptionsForm initial={options.data} /> : null
}

function OptionsForm({ initial }: { initial: JournalOptions }) {
  const save = useSaveOptions()
  const [draft, setDraft] = useState(() => toDraft(initial))

  return (
    <Card className="lg:col-span-2">
      <h2 className="mb-1 font-medium">選項清單</h2>
      <p className="mb-4 text-sm text-muted">填寫交易時可選的項目，一行一個。移除選項不會影響已經填過的紀錄。</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KEYS.map((k) => (
          <label key={k} className="block">
            <span className="mb-1.5 block text-sm font-medium">{OPTION_LABELS[k]}</span>
            <TextArea
              rows={6}
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button disabled={save.isPending} onClick={() => save.mutate(fromDraft(draft))}>
          {save.isPending ? '儲存中…' : '儲存選項'}
        </Button>
        {save.isSuccess && <span className="text-xs text-profit">已儲存</span>}
      </div>
      {save.isError && <ErrorBox message={save.error.message} />}
    </Card>
  )
}

function toDraft(o: JournalOptions) {
  return Object.fromEntries(KEYS.map((k) => [k, o[k].join('\n')])) as Record<keyof JournalOptions, string>
}

function fromDraft(d: Record<keyof JournalOptions, string>): JournalOptions {
  return Object.fromEntries(
    KEYS.map((k) => [k, [...new Set(d[k].split('\n').map((s) => s.trim()).filter(Boolean))]]),
  ) as unknown as JournalOptions
}
