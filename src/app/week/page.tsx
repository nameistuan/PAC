import styles from './page.module.css'
import prisma from '@/lib/prisma'
import {
  eachDayOfInterval,
  isToday,
  format,
  parseISO,
  startOfWeek
} from 'date-fns'
  format,
  parseISO
} from 'date-fns'

export const dynamic = 'force-dynamic' 

export default async function WeekView({
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
  } else {
    currentDate = startOfWeek(new Date())
  }
  
  const startDate = new Date(currentDate)
  startDate.setHours(0,0,0,0)
  const endDate = new Date(currentDate)
  endDate.setDate(endDate.getDate() + 6)
  endDate.setHours(23,59,59,999)
  
  const daysInGrid = eachDayOfInterval({ start: startDate, end: endDate })

  // Fetch real events
  const events = await prisma.event.findMany({
    where: {
      startTime: { gte: startDate, lte: endDate }
    },
    include: { project: true }
  });

  const hours = Array.from({ length: 24 }).map((_, i) => i)

  return (
    <div className={styles.weekView}>
      <div className={styles.headerRow}>
        <div className={styles.timeColHeader} />
        {daysInGrid.map(day => (
          <div key={day.toISOString()} className={styles.dayHeader}>
            <span className={styles.dayName}>{format(day, 'E')}</span>
            <span className={`${styles.dayNumber} ${isToday(day) ? styles.todayNum : ''}`}>
              {format(day, 'd')}
            </span>
          </div>
        ))}
      </div>
      
      <div className={styles.gridBody}>
        {/* Time Column */}
        <div className={styles.timeCol}>
          {hours.map(hour => (
            <div key={hour} className={styles.timeLabel} style={{ top: `${hour * 51}px` }}>
              {hour === 0 ? '' : format(new Date().setHours(hour, 0), 'ha')}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className={styles.daysContainer}>
          {daysInGrid.map(day => {
            const dayEvents = events.filter((e: any) => format(e.startTime, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))

            return (
              <div key={day.toISOString()} className={styles.dayCol}>
                {dayEvents.map((event: any) => {
                  const startHour = event.startTime.getHours()
                  const startMin = event.startTime.getMinutes()
                  
                  // For MVP, we assume 1 hour duration. In the future we will use event.endTime
                  const top = (startHour * 51) + (startMin * (51 / 60))
                  const height = 51 // 1 hour = 51px

                  return (
                    <div 
                      key={event.id} 
                      className={styles.eventBlock}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: event.project ? `${event.project.color}33` : 'var(--surface-hover)',
                        color: event.project ? event.project.color : 'var(--text-primary)',
                        borderLeft: `4px solid ${event.project ? event.project.color : 'var(--border-color)'}`
                      }}
                    >
                      <span className={styles.eventTitle}>{event.title}</span>
                      <span className={styles.eventTime}>{format(event.startTime, 'h:mm a')}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
