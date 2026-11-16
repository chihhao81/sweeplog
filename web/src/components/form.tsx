import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function FormRow({
  label,
  required = false,
  hint,
  children,
}: {
  label: string
  required?: boolean
  /** Shown in a popover on hover (or tap / keyboard focus) of a "?" next to the label. */
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center text-xs font-medium text-muted">
        {label}
        {required && (
          <span className="ml-0.5 text-warn" aria-label="必填">
            *
          </span>
        )}
        {hint && <Hint label={`${label}說明`}>{hint}</Hint>}
      </div>
      {children}
    </div>
  )
}

function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative ml-1.5 inline-flex">
      <button
        type="button"
        aria-label={label}
        className="flex size-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted hover:border-accent hover:text-accent focus-visible:border-accent focus-visible:text-accent focus-visible:outline-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="invisible absolute top-full left-0 z-20 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-2 p-3 text-xs font-normal text-fg opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
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
