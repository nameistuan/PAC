'use client'

import { useRouter } from 'next/navigation'
import styles from './AllDayRow.module.css'

interface AllDayEvent {
  id: string
  title: string
  project?: { color: string } | null
}

export default function AllDayRow({
  days,
  eventsByDate,
  baseUrl,
  dateParam,
}: {
  days: string[]            // e.g. ['2026-03-31', '2026-04-01', ...]
  eventsByDate: Record<string, AllDayEvent[]>
  baseUrl: string           // '/week' or '/day'
  dateParam?: string
}) {
  const router = useRouter()

  const openEvent = (id: string) => {
    const params = new URLSearchParams()
    if (dateParam) params.set('date', dateParam)
    params.set('editEvent', id)
    router.push(`${baseUrl}?${params.toString()}`, { scroll: false })
  }

  const hasAny = days.some(d => (eventsByDate[d]?.length ?? 0) > 0)
  if (!hasAny) return null

  return (
    <>
      {/* Empty cell under time column header */}
      <div className={styles.timeCell} />
      {days.map(dateStr => {
        const events = eventsByDate[dateStr] ?? []
        return (
          <div key={dateStr} className={styles.cell}>
            {events.map(ev => (
              <button
                key={ev.id}
                className={styles.chip}
                style={{
                  backgroundColor: ev.project ? `${ev.project.color}22` : 'var(--surface-hover)',
                  borderLeft: `3px solid ${ev.project?.color ?? 'var(--border-color)'}`,
                  color: ev.project?.color ?? 'var(--text-primary)',
                }}
                onClick={() => openEvent(ev.id)}
              >
                {ev.title}
              </button>
            ))}
          </div>
        )
      })}
    </>
  )
}
