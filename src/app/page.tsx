import styles from './page.module.css'
import prisma from '@/lib/prisma'
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

export const dynamic = 'force-dynamic' // Ensure Next.js doesn't cache the real-time calendar during MVP

export default async function MonthView({
  searchParams
}: {
  searchParams: Promise<{ month?: string, date?: string }>
}) {
  const resolvedParams = await searchParams
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  // 1. Determine current month interval structure
  let currentDate = new Date()
  if (resolvedParams.date) {
    currentDate = parseISO(`${resolvedParams.date}T12:00:00Z`)
  } else if (resolvedParams.month) {
    currentDate = parseISO(`${resolvedParams.month}-01T12:00:00Z`)
  }
  
  // Helper to construct event editing URL cleanly
  const getEventUrl = (eventId: string) => {
    const params = new URLSearchParams()
    if (resolvedParams.date) params.set('date', resolvedParams.date)
    if (resolvedParams.month) params.set('month', resolvedParams.month)
    params.set('editEvent', eventId)
    return `/?${params.toString()}`
  }
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(monthStart)
  
  // 2. Pad the grid with trailing days from the previous/next month automatically
  const startDate = startOfWeek(monthStart)
  const endDate = endOfWeek(monthEnd)
  
  const daysInGrid = eachDayOfInterval({
    start: startDate,
    end: endDate
  })

  // 3. Fetch real events from database for this specific visual range
  const events = await prisma.event.findMany({
    where: {
      startTime: {
        gte: startDate,
        lte: endDate,
      }
    },
    include: {
      project: true // Bring in the Tags/Colors
    }
  });

  // 4. Map the UI representations safely
  const calendarDays = daysInGrid.map(day => {
    // Isolate events that occur on this exact day
    const dayDateString = format(day, 'yyyy-MM-dd');
    
    const dayEvents = events.filter((e: any) => {
      const eventDateString = format(e.startTime, 'yyyy-MM-dd');
      return eventDateString === dayDateString;
    }).sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return {
      dateObj: day,
      date: day.getDate(),
      isToday: isToday(day),
      isOtherMonth: !isSameMonth(day, monthStart),
      events: dayEvents
    }
  })

  return (
    <div className={styles.monthView}>
      <div className={styles.calendarGrid}>
        {calendarDays.map((day, index) => (
          <div 
            key={index} 
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
                <Link 
                  href={getEventUrl(event.id)} 
                  scroll={false} 
                  key={event.id} 
                  className={styles.eventBadge}
                >
                  <div 
                    className={styles.eventDot} 
                    style={{ backgroundColor: event.project ? event.project.color : 'var(--text-secondary)' }}
                  />
                  <span className={styles.eventTime}>
                    {format(new Date(event.startTime), 'h:mma').toLowerCase()}
                  </span>
                  <span className={styles.eventTitle}>{event.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
