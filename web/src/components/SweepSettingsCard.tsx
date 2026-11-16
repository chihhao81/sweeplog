import { useState } from 'react'
import { FormRow, NumberInput } from '@/components/form'
import { Button, Card, ErrorBox } from '@/components/ui'
import { useSaveSetting, useSettings, useSweepSettings } from '@/lib/queries'
import { SWEEP_DEFAULTS, type SweepSettings } from '@/lib/sweep'

/** Breakeven points and re-entry window, used by the sweep fields and the 補進場 tag. */
export function SweepSettingsCard() {
  const settings = useSettings()
  const current = useSweepSettings()
  if (settings.isPending) return null
  // Remount when the stored values change so the inputs start from them.
  return <SweepSettingsForm key={`${current.beMovePoints}|${current.reentryMinutes}`} current={current} />
}

function SweepSettingsForm({ current }: { current: SweepSettings }) {
  const [draft, setDraft] = useState<{ [K in keyof SweepSettings]: number | null }>(current)
  const save = useSaveSetting()
  const dirty = draft.beMovePoints !== current.beMovePoints || draft.reentryMinutes !== current.reentryMinutes

  async function onSave() {
    for (const key of ['beMovePoints', 'reentryMinutes'] as const) {
      if (draft[key] !== current[key]) {
        const v = draft[key]
        await save.mutateAsync({ key, value: v && v > 0 ? String(v) : null })
      }
    }
  }

  return (
    <Card>
      <h2 className="mb-1 font-medium">交易規則</h2>
      <p className="mb-4 text-sm text-muted">用在部位的「出場後」欄位和「補進場」標籤，不影響經驗值。</p>
      <div className="space-y-4">
        <FormRow label="移保本點數">
          <div className="flex items-center gap-2">
            <NumberInput
              value={draft.beMovePoints}
              onChange={(v) => setDraft((d) => ({ ...d, beMovePoints: v }))}
              placeholder={String(SWEEP_DEFAULTS.beMovePoints)}
            />
            <span className="text-xs text-muted">點（浮盈到這裡就移停損到保本）</span>
          </div>
        </FormRow>
        <FormRow label="補進場時間">
          <div className="flex items-center gap-2">
            <NumberInput
              value={draft.reentryMinutes}
              onChange={(v) => setDraft((d) => ({ ...d, reentryMinutes: v }))}
              placeholder={String(SWEEP_DEFAULTS.reentryMinutes)}
            />
            <span className="text-xs text-muted">分鐘內（同商品同方向、虧損出場後再進場）</span>
          </div>
        </FormRow>
        <Button type="button" variant="secondary" disabled={!dirty || save.isPending} onClick={() => void onSave()}>
          {save.isPending ? '儲存中…' : '儲存'}
        </Button>
        {save.isError && <ErrorBox message={save.error.message} />}
      </div>
    </Card>
  )
}
