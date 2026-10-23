import { useState } from 'react'
import { ChipMulti, ChipSelect, FormRow, NumberInput, Scale, TextArea, YesNo } from '@/components/form'
import { Button, ErrorBox } from '@/components/ui'
import { money, rMultiple } from '@/lib/format'
import { joinMulti, splitMulti, type JournalOptions } from '@/lib/options'
import { useUpdatePosition } from '@/lib/queries'
import { positionR, type Position, type PositionManual } from '@/lib/types'

const BIAS = ['多', '空', '盤整']

type Draft = Required<{ [K in keyof PositionManual]: PositionManual[K] | null }>

function toDraft(p: Position): Draft {
  return {
    riskOverride: p.riskOverride ?? null,
    setup: p.setup ?? null,
    liquiditySwept: p.liquiditySwept ?? null,
    htfBias: p.htfBias ?? null,
    entryTimeframe: p.entryTimeframe ?? null,
    entryTrigger: p.entryTrigger ?? null,
    followedPlan: p.followedPlan ?? null,
    mistakes: p.mistakes ?? null,
    emotionBefore: p.emotionBefore ?? null,
    emotionAfter: p.emotionAfter ?? null,
    grade: p.grade ?? null,
    notes: p.notes ?? null,
    lesson: p.lesson ?? null,
  }
}

/** Journal form for one position. Saves only the manual columns. */
export function PositionJournal({ position, options }: { position: Position; options: JournalOptions }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(position))
  const update = useUpdatePosition()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    update.reset()
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const original = toDraft(position)
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== original[k])
  const previewR = positionR({ ...position, riskOverride: draft.riskOverride })

  return (
    <form
      className="space-y-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        update.mutate({ positionId: position.positionId, fields: draft })
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormRow label="Setup">
          <ChipSelect options={options.setups} value={draft.setup} onChange={(v) => set('setup', v)} />
        </FormRow>
        <FormRow label="評級">
          <ChipSelect options={options.grades} value={draft.grade} onChange={(v) => set('grade', v)} />
        </FormRow>
        <FormRow label="被掃的流動性">
          <ChipMulti
            options={options.liquidity}
            value={splitMulti(draft.liquiditySwept)}
            onChange={(v) => set('liquiditySwept', joinMulti(v))}
          />
        </FormRow>
        <FormRow label="大週期方向">
          <ChipSelect options={BIAS} value={draft.htfBias} onChange={(v) => set('htfBias', v)} />
        </FormRow>
        <FormRow label="進場觸發">
          <ChipSelect options={options.triggers} value={draft.entryTrigger} onChange={(v) => set('entryTrigger', v)} />
        </FormRow>
        <FormRow label="進場週期">
          <ChipSelect
            options={options.timeframes}
            value={draft.entryTimeframe}
            onChange={(v) => set('entryTimeframe', v)}
          />
        </FormRow>
        <FormRow label="照計畫執行">
          <YesNo value={draft.followedPlan} onChange={(v) => set('followedPlan', v)} />
        </FormRow>
        <FormRow label="風險金額（覆蓋自動計算）">
          <div className="flex items-center gap-3">
            <NumberInput
              value={draft.riskOverride}
              onChange={(v) => set('riskOverride', v)}
              placeholder={position.autoRisk !== null ? `自動 ${position.autoRisk}` : '例：20'}
            />
            <span className="text-xs text-muted">
              {money(position.netPnl)} ＝ <span className="text-fg">{rMultiple(previewR)}</span>
            </span>
          </div>
        </FormRow>
        <FormRow label="進場前情緒">
          <Scale value={draft.emotionBefore} onChange={(v) => set('emotionBefore', v)} low="焦躁" high="平靜" />
        </FormRow>
        <FormRow label="出場後情緒">
          <Scale value={draft.emotionAfter} onChange={(v) => set('emotionAfter', v)} low="焦躁" high="平靜" />
        </FormRow>
      </div>

      <FormRow label="錯誤標籤">
        <ChipMulti
          options={options.mistakes}
          value={splitMulti(draft.mistakes)}
          onChange={(v) => set('mistakes', joinMulti(v))}
        />
      </FormRow>

      <div className="grid gap-4 md:grid-cols-2">
        <FormRow label="筆記">
          <TextArea
            value={draft.notes ?? ''}
            onChange={(e) => set('notes', e.target.value || null)}
            placeholder="進場理由、盤面觀察…"
          />
        </FormRow>
        <FormRow label="學到什麼">
          <TextArea
            value={draft.lesson ?? ''}
            onChange={(e) => set('lesson', e.target.value || null)}
            placeholder="下次遇到一樣的情況要怎麼做"
          />
        </FormRow>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || update.isPending}>
          {update.isPending ? '儲存中…' : '儲存'}
        </Button>
        {dirty && !update.isPending && <span className="text-xs text-warn">尚未儲存</span>}
        {update.isSuccess && !dirty && <span className="text-xs text-profit">已儲存</span>}
      </div>
      {update.isError && <ErrorBox message={update.error.message} />}
    </form>
  )
}
