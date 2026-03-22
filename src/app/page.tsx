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

export const dynamic = 'force-dynamic' // Ensure Next.js doesn't cache the real-time calendar during MVP

export default async function MonthView({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const resolvedParams = await searchParams
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  // 1. Determine current month interval structure
  let currentDate = new Date()
  if (resolvedParams.month) {
    currentDate = parseISO(`${resolvedParams.month}-01T12:00:00Z`)
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
      <div className={styles.daysHeader}>
        {daysOfWeek.map(day => (
          <span key={day}>{day}</span>
        ))}
      </div>
      
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
            <div className={styles.dateNumber}>
              {day.date}
            </div>
            
            <div className={styles.eventsContainer}>
              {day.events.map((event: any) => (
                <div key={event.id} className={styles.eventBadge}>
                  <div 
                    className={styles.eventDot} 
                    style={{ backgroundColor: event.project ? event.project.color : 'var(--text-secondary)' }}
                  />
                  <span className={styles.eventTime}>
                    {format(new Date(event.startTime), 'h:mma').toLowerCase()}
                  </span>
                  <span className={styles.eventTitle}>{event.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
