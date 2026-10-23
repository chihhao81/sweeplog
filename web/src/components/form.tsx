import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted">{label}</div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

/** Single choice; clicking the active chip clears it. */
export function ChipSelect({
  options,
  value,
  onChange,
  format,
}: {
  options: string[]
  value: string | null
  onChange: (v: string | null) => void
  format?: (option: string) => string
}) {
  // Keep a stored value visible even if it was removed from the option list.
  const all = value && !options.includes(value) ? [...options, value] : options
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((o) => (
        <Chip key={o} active={o === value} onClick={() => onChange(o === value ? null : o)}>
          {format ? format(o) : o}
        </Chip>
      ))}
    </div>
  )
}

export function ChipMulti({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const all = [...options, ...value.filter((v) => !options.includes(v))]
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((o) => {
        const on = value.includes(o)
        return (
          <Chip key={o} active={on} onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}>
            {o}
          </Chip>
        )
      })}
    </div>
  )
}

/** 1–5 rating. */
export function Scale({
  value,
  onChange,
  low,
  high,
}: {
  value: number | null
  onChange: (v: number | null) => void
  low?: string
  high?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      {low && <span className="mr-1 text-xs text-muted">{low}</span>}
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n === value ? null : n)}
          aria-pressed={n === value}
          className={cn(
            'size-8 rounded-md border text-sm tabular-nums',
            n === value ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:text-fg',
          )}
        >
          {n}
        </button>
      ))}
      {high && <span className="ml-1 text-xs text-muted">{high}</span>}
    </div>
  )
}

export function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex gap-1.5">
      <Chip active={value === true} onClick={() => onChange(value === true ? null : true)}>
        是
      </Chip>
      <Chip active={value === false} onClick={() => onChange(value === false ? null : false)}>
        否
      </Chip>
    </div>
  )
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      className={cn(
        'w-full resize-y rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent',
        className,
      )}
      {...props}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="h-9 w-36 rounded-md border border-border bg-bg px-3 text-sm outline-none placeholder:text-muted/60 focus:border-accent"
    />
  )
}
