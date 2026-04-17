import styles from './page.module.css'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  parseISO
} from 'date-fns'
import Link from 'next/link'
import InteractiveMonthCell from '@/components/InteractiveMonthCell'
import InteractiveMonthEvent from '@/components/InteractiveMonthEvent'

import { prepareEventsForGrid } from '@/lib/calendarEngine'

export const dynamic = 'force-dynamic' 

export default async function MonthView({
  searchParams
}: {
  searchParams: Promise<{ month?: string, date?: string }>
}) {
  const resolvedParams = await searchParams
  const session = await auth()
  const userId = session?.user?.id
  
  // 1. Determine current month interval structure
  let currentDate = new Date()
  if (resolvedParams.date) {
    currentDate = parseISO(`${resolvedParams.date}T12:00:00Z`)
  } else if (resolvedParams.month) {
    currentDate = parseISO(`${resolvedParams.month}-01T12:00:00Z`)
  }
  
  const getEventUrl = (event: any) => {
    const params = new URLSearchParams()
    if (resolvedParams.date) params.set('date', resolvedParams.date)
    if (resolvedParams.month) params.set('month', resolvedParams.month)
    if (event.taskId) {
      params.set('editTask', event.taskId)
    } else {
      params.set('editEvent', event.id)
    }
    return `/?${params.toString()}`
  }
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  
  const daysInGrid = eachDayOfInterval({
    start: startDate,
    end: endDate
  })

  // 3. Fetch real events
  const rawEvents = await prisma.event.findMany({
    where: {
      AND: [
        { startTime: { lte: endDate } },
        { endTime: { gte: startDate } },
        ...(userId ? [{ userId }] : []),
      ]
    },
    include: { project: true }
  }) as any[];

  // 4. Centralized Slicing
  const daySegmentsMap = prepareEventsForGrid(rawEvents, startDate, endDate);

  const calendarDays = daysInGrid.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const daySegments = daySegmentsMap.get(dateStr) || [];
    
    // Sort by original start time
    daySegments.sort((a, b) => a.fullStartTime.getTime() - b.fullStartTime.getTime());

    return {
      dateObj: day,
      date: day.getDate(),
      isToday: isToday(day),
      isOtherMonth: !isSameMonth(day, monthStart),
      events: daySegments
    }
  })

  return (
    <div className={styles.monthView}>
      <div className={styles.calendarGrid}>
        {calendarDays.map((day, index) => {
          const dateStr = format(day.dateObj, 'yyyy-MM-dd')
          
          return (
          <InteractiveMonthCell 
            key={index} 
            dateStr={dateStr}
            className={`
              ${styles.dayCell} 
              ${day.isToday ? styles.today : ''} 
              ${day.isOtherMonth ? styles.otherMonth : ''}
            `}
          >
            {index < 7 && (
              <div className={styles.dayName}>{format(day.dateObj, 'EEE')}</div>
            )}
            <div className={styles.dateNumberWrapper}>
              <div className={styles.dateNumber}>
                {day.date}
              </div>
            </div>
            
            <div className={styles.eventsContainer}>
              {day.events.map((event: any) => (
                <InteractiveMonthEvent
                  key={event.id}
                  event={event}
                  href={getEventUrl(event)}
                  className={styles.eventBadge}
                  dotClassName={styles.eventDot}
                  timeClassName={styles.eventTime}
                  titleClassName={styles.eventTitle}
                />
              ))}
            </div>
          </InteractiveMonthCell>
        )})}
      </div>
    </div>
  )
}
