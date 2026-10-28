import { useMemo } from 'react'
import type { WeatherKind } from '@/agents/protocol'
import { weatherAccent } from './WeatherIcon'

/** Subtle animated background for the weather card. Pure CSS, GPU friendly. */
export function WeatherAmbience({ kind, isDay }: { kind?: WeatherKind; isDay: boolean }) {
  const accent = weatherAccent(kind, isDay)
  const drops = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: -((i * 0.29) % 1.4),
        dur: 0.65 + ((i * 13) % 7) / 18,
        len: 10 + ((i * 7) % 12),
        o: 0.15 + ((i * 11) % 5) / 16,
      })),
    [],
  )
  const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: (i * 47) % 100, y: (i * 29) % 70, d: (i % 5) * 0.6, s: i % 3 ? 1 : 2 })), [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-24 -right-16 h-64 w-64 rounded-full blur-3xl"
        style={{ background: accent, opacity: kind === 'clear' && isDay ? 0.4 : 0.18, animation: kind === 'clear' && isDay ? 'sun-pulse 6s ease-in-out infinite' : undefined }}
      />

      {kind === 'clear' && !isDay &&
        stars.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animation: `twinkle ${2.4 + s.d}s ease-in-out ${s.d}s infinite` }}
          />
        ))}

      {(kind === 'clouds' || kind === 'mist') &&
        [0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute h-24 w-56 rounded-full blur-2xl"
            style={{
              top: `${10 + i * 26}%`,
              background: kind === 'mist' ? 'rgba(180,195,210,0.16)' : 'rgba(200,210,225,0.10)',
              animation: `drift ${38 + i * 14}s linear ${-i * 11}s infinite`,
            }}
          />
        ))}

      {(kind === 'rain' || kind === 'drizzle' || kind === 'thunder') &&
        drops.slice(0, kind === 'drizzle' ? 16 : 34).map((d, i) => (
          <span
            key={i}
            className="absolute top-0 w-px rounded-full"
            style={{
              left: `${d.left}%`,
              height: d.len,
              opacity: d.o,
              background: 'linear-gradient(to bottom, transparent, #9ccfff)',
              animation: `rain-fall ${d.dur}s linear ${d.delay}s infinite`,
            }}
          />
        ))}

      {kind === 'snow' &&
        drops.slice(0, 26).map((d, i) => (
          <span
            key={i}
            className="absolute top-0 rounded-full bg-white"
            style={{ left: `${d.left}%`, width: 3, height: 3, opacity: d.o + 0.2, animation: `snow-fall ${d.dur * 6}s linear ${d.delay * 4}s infinite` }}
          />
        ))}

      {kind === 'thunder' && <div className="absolute inset-0 bg-violet-200" style={{ animation: 'flash 7s linear infinite' }} />}
    </div>
  )
}
