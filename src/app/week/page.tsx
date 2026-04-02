import styles from './page.module.css'
import prisma from '@/lib/prisma'
import {
  eachDayOfInterval,
  isToday,
  format,
  startOfWeek,
  subDays,
  parseISO,
  startOfDay
} from 'date-fns'
import { parseISOString } from '@/lib/dateUtils'
import Link from 'next/link'
import InteractiveDayCol from '@/components/InteractiveDayCol'
import InteractiveEvent from '@/components/InteractiveEvent'
import AllDayRow from '@/components/AllDayRow'
import { calculateEventLayout } from '@/lib/groupEvents'

import { prepareEventsForGrid } from '@/lib/calendarEngine'
import { HOUR_HEIGHT } from '@/lib/constants'

export const dynamic = 'force-dynamic' 

export default async function WeekView({
  searchParams
}: {
  searchParams: Promise<{ month?: string, date?: string }>
}) {
  const { date, month } = await searchParams
  const currentDate = parseISOString(date)
  
  const getEventUrl = (eventId: string) => {
    const params = new URLSearchParams()
    if (date) params.set('date', date)
    if (month) params.set('month', month)
    params.set('editEvent', eventId)
    return `/week?${params.toString()}`
  }
  
  // Standard Rigid Week Logic: Always frame Sunday-Saturday
  const startDate = startOfWeek(currentDate, { weekStartsOn: 0 })
  startDate.setHours(0,0,0,0)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 6)
  endDate.setHours(23,59,59,999)
  
  const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate })

  // Fetch real events
  const rawEvents = await prisma.event.findMany({
    where: {
      AND: [
        { startTime: { lte: endDate } },
        { endTime: { gte: startDate } }
      ]
    },
    include: { project: true }
  }) as any[];

  // 1. Centralized Slicing & Processing
  const daySegmentsMap = prepareEventsForGrid(rawEvents, startDate, endDate);

  // Separate all-day (fluid) events per day
  const allDayByDate: Record<string, { id: string; title: string; project?: { color: string } | null }[]> = {}
  daysInGrid.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd')
    allDayByDate[dateStr] = (daySegmentsMap.get(dateStr) ?? [])
      .filter(s => s.isFluid)
      .map(s => ({ id: s.id, title: s.title, project: s.project }))
  })

  const hours = Array.from({ length: 24 }).map((_, i) => i)
  const dayStrs = daysInGrid.map(d => format(d, 'yyyy-MM-dd'))

  return (
    <div className={styles.weekView}>
      <div className={styles.gridBody}>
        <div className={styles.timeColHeader} />
        {daysInGrid.map(day => (
          <div key={`header-${day.toISOString()}`} className={styles.dayHeader}>
            <span className={styles.dayName}>{format(day, 'E')}</span>
            <span className={`${styles.dayNumber} ${isToday(day) ? styles.todayNum : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
        {/* All-day row */}
        <AllDayRow
          days={dayStrs}
          eventsByDate={allDayByDate}
          baseUrl="/week"
          dateParam={date}
        />

        {/* Time Column */}
        <div className={styles.timeCol}>
          {hours.map(hour => (
            <div key={hour} className={styles.timeLabel} style={{ top: `calc(var(--hour-height) * ${hour})` }}>
              {hour === 0 ? '' : format(new Date().setHours(hour, 0), 'ha')}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        {daysInGrid.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const daySegments = (daySegmentsMap.get(dateStr) || []).filter(s => !s.isFluid)

            // 2. Perform Layout Clustering
            const layoutEvents = calculateEventLayout(daySegments)

            return (
              <InteractiveDayCol key={day.toISOString()} dateStr={dateStr} className={styles.dayCol}>
                {layoutEvents.map((le) => {
                  const startHour = le.displayStart.getHours()
                  const startMin = le.displayStart.getMinutes()
                  
                  const durationMs = le.displayEnd.getTime() - le.displayStart.getTime()
                  const topFraction = startHour + (startMin / 60)
                  const heightFraction = durationMs / 3600000

                  return (
                    <InteractiveEvent
                      key={`${le.id}-${dateStr}`}
                      event={le}
                      href={getEventUrl(le.id)}
                      dateStr={dateStr}
                      topFraction={topFraction}
                      heightFraction={heightFraction}
                      assignedLeft={le.assignedLeft}
                      isLayoutIndented={le.isLayoutIndented}
                      zIndex={le.zIndex}
                      // Pre-computed clipping meta from the engine
                      isStartClipped={le.isStartClipped}
                      isEndClipped={le.isEndClipped}
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
