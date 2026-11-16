import { useState } from 'react'
import { ChipSelect, FormRow, Scale, TextArea, YesNo } from '@/components/form'
import { Button, Card, ErrorBox } from '@/components/ui'
import { useJournal, useSaveJournal } from '@/lib/queries'
import type { JournalEntry } from '@/lib/types'

const BIAS = ['多', '空', '盤整']

type Draft = Omit<JournalEntry, 'id' | 'updatedAt'>

function emptyEntry(date: string, accountName: string): Draft {
  return {
    date,
    accountName,
    bias: null,
    newsEvents: null,
    sleep: null,
    energy: null,
    followedDailyRules: null,
    wentWell: null,
    wentWrong: null,
    tomorrow: null,
  }
}

export function DailyJournalCard({ date, accountName }: { date: string; accountName: string }) {
  const journal = useJournal()
  // Owned here, not by the form: a successful save changes `updatedAt`, which remounts
  // the form, and the "saved" message has to survive that.
  const save = useSaveJournal()
  if (journal.isPending) return null
  if (journal.isError) return <ErrorBox message={journal.error.message} />

  const entry = journal.data.find((e) => e.date === date && e.accountName === accountName)
  // Remount when the stored entry changes so the form starts from saved values.
  const savedHere = save.isSuccess && save.data.date === date && save.data.accountName === accountName
  return (
    <JournalForm
      key={`${date}|${entry?.updatedAt ?? 'new'}`}
      initial={entry ?? emptyEntry(date, accountName)}
      save={save}
      savedAt={savedHere ? (save.data.updatedAt ?? '') : null}
    />
  )
}

function JournalForm({
  initial,
  save,
  savedAt,
}: {
  initial: Draft
  save: ReturnType<typeof useSaveJournal>
  savedAt: string | null
}) {
  const [draft, setDraft] = useState<Draft>(initial)
  const [dirty, setDirty] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDirty(true)
    setDraft((d) => ({ ...d, [k]: v }))
  }
  const text = (k: 'newsEvents' | 'wentWell' | 'wentWrong' | 'tomorrow') => ({
    value: draft[k] ?? '',
    onChange: (e: { target: { value: string } }) => set(k, e.target.value || null),
  })

  return (
    <Card>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate(draft, { onSuccess: () => setDirty(false) })
        }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">當日日誌</h2>
          {draft.accountName && <span className="truncate text-xs text-muted">{draft.accountName}</span>}
        </div>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-accent">盤前</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <FormRow label="當日方向">
              <ChipSelect options={BIAS} value={draft.bias} onChange={(v) => set('bias', v)} />
            </FormRow>
            <FormRow label="新聞事件">
              <TextArea rows={1} placeholder="CPI 20:30、FOMC…" {...text('newsEvents')} />
            </FormRow>
            <FormRow label="睡眠品質">
              <Scale value={draft.sleep} onChange={(v) => set('sleep', v)} low="差" high="好" />
            </FormRow>
            <FormRow label="精神狀態">
              <Scale value={draft.energy} onChange={(v) => set('energy', v)} low="差" high="好" />
            </FormRow>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium text-accent">盤後</h3>
          <FormRow label="遵守每日規則（筆數、虧損上限）">
            <YesNo value={draft.followedDailyRules} onChange={(v) => set('followedDailyRules', v)} />
          </FormRow>
          <div className="grid gap-4 md:grid-cols-3">
            <FormRow label="做對的">
              <TextArea {...text('wentWell')} />
            </FormRow>
            <FormRow label="做錯的">
              <TextArea {...text('wentWrong')} />
            </FormRow>
            <FormRow label="明天要改的">
              <TextArea {...text('tomorrow')} />
            </FormRow>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending && (
              <span className="size-3.5 animate-spin rounded-full border-2 border-accent-fg/40 border-t-accent-fg" />
            )}
            {save.isPending ? '儲存中…' : '儲存日誌'}
          </Button>
          {dirty && !save.isPending && <span className="text-xs text-warn">尚未儲存</span>}
          {!dirty && !save.isPending && savedAt !== null && (
            <span className="text-xs text-profit">✓ 已儲存 {formatSavedAt(savedAt)}</span>
          )}
        </div>
        {save.isError && <ErrorBox message={save.error.message} />}
      </form>
    </Card>
  )
}

function formatSavedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}
