import styles from '../week/page.module.css'
import prisma from '@/lib/prisma'
import {
  eachDayOfInterval,
  isToday,
  format,
  parseISO
} from 'date-fns'

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
      <div className={styles.headerRow} style={{ gridTemplateColumns: '60px repeat(4, 1fr)' }}>
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

        {/* 4 Day Grid */}
        <div className={styles.daysContainer} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {daysInGrid.map(day => {
            const dayEvents = events.filter((e: any) => format(e.startTime, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))

            return (
              <div key={day.toISOString()} className={styles.dayCol}>
                {dayEvents.map((event: any) => {
                  const startHour = event.startTime.getHours()
                  const startMin = event.startTime.getMinutes()
                  
                  const top = (startHour * 51) + (startMin * (51 / 60))
                  const height = 51

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
