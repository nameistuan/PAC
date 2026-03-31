'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import styles from './SearchPopover.module.css'

interface SearchEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  isFluid: boolean
  project?: { color: string; name: string } | null
}

export default function SearchPopover({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const search = useCallback((q: string) => {
    if (!q.trim()) { setResults([]); return }
    setIsLoading(true)
    fetch(`/api/events?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(val), 200)
  }

  const openEvent = (ev: SearchEvent) => {
    const dateStr = format(new Date(ev.startTime), 'yyyy-MM-dd')
    router.push(`/?date=${dateStr}&editEvent=${ev.id}`, { scroll: false })
    onClose()
  }

  const formatTime = (ev: SearchEvent) => {
    const start = new Date(ev.startTime)
    if (ev.isFluid) return format(start, 'MMM d, yyyy')
    return `${format(start, 'MMM d, yyyy')} · ${format(start, 'h:mm a')}`
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.popover} onClick={e => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search events…"
            value={query}
            onChange={handleChange}
            onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          />
          {query && (
            <button className={styles.clearBtn} onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus() }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {query.trim() && (
          <div className={styles.results}>
            {isLoading && <div className={styles.hint}>Searching…</div>}
            {!isLoading && results.length === 0 && (
              <div className={styles.hint}>No events found for "{query}"</div>
            )}
            {results.map(ev => (
              <button key={ev.id} className={styles.result} onClick={() => openEvent(ev)}>
                <span
                  className={styles.dot}
                  style={{ backgroundColor: ev.project?.color ?? 'var(--text-secondary)' }}
                />
                <span className={styles.resultTitle}>{ev.title}</span>
                <span className={styles.resultTime}>{formatTime(ev)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
