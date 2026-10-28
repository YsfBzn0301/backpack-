import type { ReactNode } from 'react'

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between px-1">
      <h2 className="text-[11px] font-semibold tracking-[0.14em] text-fog-500 uppercase">{children}</h2>
      {right}
    </div>
  )
}
