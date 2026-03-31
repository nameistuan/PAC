'use client'

import { useState, useMemo } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths,
  startOfWeek as sowFn, addDays, isSameDay
} from 'date-fns'
import styles from './MiniCalendar.module.css'

export default function MiniCalendar({
  currentDate,
  pathname,
  onNavigate,
}: {
  currentDate: Date
  pathname: string
  onNavigate: (date: Date) => void
}) {
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(currentDate))

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(displayMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(displayMonth), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [displayMonth])

  // Compute the range of days currently in view (to highlight them)
  const viewRange = useMemo(() => {
    if (pathname === '/week') {
      const s = sowFn(currentDate, { weekStartsOn: 0 })
      return { start: s, end: addDays(s, 6) }
    }
    if (pathname === '/day') {
      return { start: currentDate, end: addDays(currentDate, 3) }
    }
    // Month view — highlight entire month
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) }
  }, [currentDate, pathname])

  const isInViewRange = (day: Date) =>
    day >= viewRange.start && day <= viewRange.end

  const weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.navBtn}
          onClick={() => setDisplayMonth(m => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span className={styles.monthLabel}>{format(displayMonth, 'MMM yyyy')}</span>
        <button
          className={styles.navBtn}
          onClick={() => setDisplayMonth(m => addMonths(m, 1))}
          aria-label="Next month"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>

      <div className={styles.grid}>
        {weekDayLabels.map((l, i) => (
          <div key={i} className={styles.weekDayLabel}>{l}</div>
        ))}
        {days.map(day => {
          const inMonth = isSameMonth(day, displayMonth)
          const today = isToday(day)
          const inRange = isInViewRange(day)
          const isSelected = isSameDay(day, currentDate)

          return (
            <button
              key={day.toISOString()}
              className={`
                ${styles.day}
                ${!inMonth ? styles.otherMonth : ''}
                ${inRange && !today ? styles.inRange : ''}
                ${today ? styles.today : ''}
                ${isSelected && !today ? styles.selected : ''}
              `}
              onClick={() => {
                onNavigate(day)
                // Keep mini calendar's displayed month in sync
                if (!isSameMonth(day, displayMonth)) {
                  setDisplayMonth(startOfMonth(day))
                }
              }}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}
