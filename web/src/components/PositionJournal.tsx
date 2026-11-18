import { useState } from 'react'
import { ChipMulti, ChipSelect, FormRow, NumberInput, Scale, TextArea, YesNo } from '@/components/form'
import { Button, ErrorBox } from '@/components/ui'
import { money, rMultiple } from '@/lib/format'
import { GRADE_LAYERS, GRADE_RULES, joinMulti, splitMulti, type JournalOptions } from '@/lib/options'
import { useSweepSettings, useUpdatePosition } from '@/lib/queries'
import { AFTER_SWEEP_OPTIONS, BE_TRIGGER_OPTIONS, hasAfterExit, sweepOptionLabel } from '@/lib/sweep'
import { positionR, type Position, type PositionManual } from '@/lib/types'
import { missingJournalFields } from '@/lib/xp'

const BIAS = ['多', '空', '盤整']

type Draft = Required<{ [K in keyof PositionManual]: PositionManual[K] | null }>

function toDraft(p: Position): Draft {
  return {
    riskOverride: p.riskOverride ?? null,
    setup: p.setup ?? null,
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
    sweepDepth: p.sweepDepth ?? null,
    afterSweep: p.afterSweep ?? null,
    beTrigger: p.beTrigger ?? null,
  }
}

/** Journal form for one position. Saves only the manual columns. */
export function PositionJournal({ position, options }: { position: Position; options: JournalOptions }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(position))
  const update = useUpdatePosition()
  const sweep = useSweepSettings()
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    update.reset()
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const original = toDraft(position)
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some((k) => draft[k] !== original[k])
  const previewR = positionR({ ...position, riskOverride: draft.riskOverride })
  // Grade and plan answer are what make a position count as reviewed (xp.ts isJournaled),
  // so a save without them would leave it pending.
  const missing = missingJournalFields({ ...position, ...draft })

  return (
    <form
      className="space-y-4 pt-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (missing.length > 0) return
        update.mutate({ positionId: position.positionId, fields: draft })
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FormRow label="Setup">
          <ChipSelect options={options.setups} value={draft.setup} onChange={(v) => set('setup', v)} />
        </FormRow>
        <FormRow label="評級" required hint={<GradeRules />}>
          <ChipSelect options={options.grades} value={draft.grade} onChange={(v) => set('grade', v)} />
        </FormRow>
        <FormRow label="大週期方向" hint="大格局的趨勢，和評級規則裡的「大格局」看同一個週期。">
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
        <FormRow label="照計畫執行" required>
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

      {/* Always available; opens by itself once something is filled in. */}
      <details className="group rounded-md border border-border/60 p-3" open={hasAfterExit(original)}>
        <summary className="cursor-pointer text-xs font-medium text-accent">出場後（選填）</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <FormRow label="掃過停損幾點" hint="價格超過停損（或移動後的停損）幾點才回頭。不是被掃出場的就留空。">
            <div className="flex items-center gap-2">
              <NumberInput value={draft.sweepDepth} onChange={(v) => set('sweepDepth', v)} placeholder="例：3" />
              <span className="text-xs text-muted">點</span>
            </div>
          </FormRow>
          <FormRow label="停損移動依據" hint="停損移到保本或獲利那一側的原因。沒移過停損就留空。">
            <ChipSelect
              options={BE_TRIGGER_OPTIONS}
              value={draft.beTrigger}
              onChange={(v) => set('beTrigger', v)}
              format={(o) => sweepOptionLabel(o, sweep)}
            />
          </FormRow>
          <FormRow label="之後走勢">
            <ChipSelect
              options={AFTER_SWEEP_OPTIONS}
              value={draft.afterSweep}
              onChange={(v) => set('afterSweep', v)}
              format={(o) => sweepOptionLabel(o, sweep)}
            />
          </FormRow>
        </div>
      </details>

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
        <Button type="submit" disabled={!dirty || missing.length > 0 || update.isPending}>
          {update.isPending ? '儲存中…' : '儲存'}
        </Button>
        {dirty && !update.isPending && (
          <span className="text-xs text-warn">
            {missing.length > 0 ? `請先填寫${missing.join('、')}才能儲存` : '尚未儲存'}
          </span>
        )}
        {update.isSuccess && !dirty && <span className="text-xs text-profit">已儲存</span>}
      </div>
      {update.isError && <ErrorBox message={update.error.message} />}
    </form>
  )
}

function GradeRules() {
  return (
    <span className="block space-y-2">
      <span className="block space-y-1">
        {GRADE_RULES.map((r) => (
          <span key={r.grade} className="flex gap-2">
            <span className="w-6 shrink-0 font-medium text-accent">{r.grade}</span>
            <span>{r.rule}</span>
          </span>
        ))}
      </span>
      <span className="block text-muted">{GRADE_LAYERS}</span>
    </span>
  )
}
