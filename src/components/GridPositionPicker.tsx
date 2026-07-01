import type { GridPosition } from '@/types'

const POSITIONS: { id: GridPosition; label: string }[] = [
  { id: 'top-left', label: '↖' },
  { id: 'top-center', label: '↑' },
  { id: 'top-right', label: '↗' },
  { id: 'center-left', label: '←' },
  { id: 'center', label: '·' },
  { id: 'center-right', label: '→' },
  { id: 'bottom-left', label: '↙' },
  { id: 'bottom-center', label: '↓' },
  { id: 'bottom-right', label: '↘' },
]

interface GridPositionPickerProps {
  value: GridPosition
  onChange: (pos: GridPosition) => void
}

export function GridPositionPicker({ value, onChange }: GridPositionPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {POSITIONS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`flex h-9 items-center justify-center rounded-lg border text-sm transition-all ${
            value === p.id
              ? 'border-teal-brand bg-teal-brand text-white shadow-sm'
              : 'border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:border-teal-brand/50'
          }`}
          title={p.id}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
