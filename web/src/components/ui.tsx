import { XCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface p-4 md:p-5', className)}>
      {children}
    </section>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-16 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </Card>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-md border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
      <XCircle className="mt-0.5 size-4 shrink-0" />
      <span className="break-all">{message}</span>
    </div>
  )
}

export function Spinner({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-accent text-accent-fg hover:bg-accent/90',
        variant === 'secondary' && 'border border-border bg-surface-2 hover:bg-border',
        variant === 'ghost' && 'text-muted hover:bg-surface-2 hover:text-fg',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        className={cn(
          'h-10 w-full rounded-md border border-border bg-bg px-3 text-sm outline-none placeholder:text-muted/60 focus:border-accent',
          className,
        )}
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}
