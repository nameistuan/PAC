import styles from '../week/page.module.css'
import prisma from '@/lib/prisma'
import {
  eachDayOfInterval,
  isToday,
  format,
  parseISO
} from 'date-fns'
import Link from 'next/link'
import InteractiveDayCol from '@/components/InteractiveDayCol'
import InteractiveEvent from '@/components/InteractiveEvent'
import { calculateEventLayout } from '@/lib/groupEvents'

export const dynamic = 'force-dynamic' 

export default async function DayView({
  searchParams
}: {
  searchParams: Promise<{ month?: string, date?: string }>
}) {
  const resolvedParams = await searchParams
  
  let currentDate = new Date()
  if (resolvedParams.date) {
    currentDate = parseISO(`${resolvedParams.date}T12:00:00Z`)
  } else if (resolvedParams.month) {
    currentDate = parseISO(`${resolvedParams.month}-01T12:00:00Z`)
  }
  
  const getEventUrl = (eventId: string) => {
    const params = new URLSearchParams()
    if (resolvedParams.date) params.set('date', resolvedParams.date)
    if (resolvedParams.month) params.set('month', resolvedParams.month)
    params.set('editEvent', eventId)
    return `/day?${params.toString()}`
  }
  
  // Set boundaries for the specific 4-day block
  const startDate = new Date(currentDate)
  startDate.setDate(startDate.getDate() - 1) // 1st slot (Yesterday)
  startDate.setHours(0,0,0,0)
  const endDate = new Date(currentDate)
  endDate.setDate(endDate.getDate() + 2) // 4th slot (Tomorrow + 1)
  endDate.setHours(23,59,59,999)

  const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate })

  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: startDate, lte: endDate }
    },
    include: { project: true }
  });

  const hours = Array.from({ length: 24 }).map((_, i) => i)

  return (
    <div className={styles.weekView}>
      <div className={styles.gridBody} style={{ gridTemplateColumns: '60px repeat(4, 1fr)' }}>
        <div className={styles.timeColHeader} />
        {daysInGrid.map(day => (
          <div key={`header-${day.toISOString()}`} className={styles.dayHeader}>
            <span className={styles.dayName}>{format(day, 'E')}</span>
            <span className={`${styles.dayNumber} ${isToday(day) ? styles.todayNum : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
        
        {/* Time Column */}
        <div className={styles.timeCol}>
          {hours.map(hour => (
            <div key={hour} className={styles.timeLabel} style={{ top: `${hour * 51}px` }}>
              {hour === 0 ? '' : format(new Date().setHours(hour, 0), 'ha')}
            </div>
          ))}
        </div>

        {/* 4 Day Grid */}
        {daysInGrid.map(day => {
            const dayEvents = events.filter((e: any) => format(e.startTime, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
            const layoutEvents = calculateEventLayout(dayEvents)
            const dateStr = format(day, 'yyyy-MM-dd')

            return (
              <InteractiveDayCol key={day.toISOString()} dateStr={dateStr} className={styles.dayCol}>
                {layoutEvents.map((event: any) => {
                  const startHour = event.startTime.getHours()
                  const startMin = event.startTime.getMinutes()
                  
                  const durationMs = event.endTime ? new Date(event.endTime).getTime() - event.startTime.getTime() : 3600000
                  const top = (startHour * 51) + (startMin * (51 / 60))
                  const height = (durationMs / 3600000) * 51

                  return (
                    <InteractiveEvent
                      key={event.id}
                      event={event}
                      href={getEventUrl(event.id)}
                      dateStr={dateStr}
                      top={top}
                      height={height}
                      assignedLeft={event.assignedLeft}
                      isLayoutIndented={event.isLayoutIndented}
                      zIndex={event.zIndex}
                      className={styles.eventBlock}
                    />
                  )
                })}
              </InteractiveDayCol>
            )
          })}
      </div>
    </div>
  )
}
