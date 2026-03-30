'use client'

import React, { useRef } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { EventSegment } from '@/lib/calendarEngine'

export default function InteractiveMonthEvent({ 
  event, 
  href, 
  className,
  dotClassName,
  timeClassName,
  titleClassName
}: { 
  event: EventSegment, 
  href: string, 
  className: string,
  dotClassName: string,
  timeClassName: string,
  titleClassName: string
}) {
  const badgeRef = useRef<HTMLAnchorElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    const actualStart = new Date(event.fullStartTime)
    const actualEnd = new Date(event.fullEndTime)
    
    e.dataTransfer.setData('eventId', event.id)
    e.dataTransfer.setData('eventStartTime', actualStart.toISOString())
    
    const durationMs = actualEnd.getTime() - actualStart.getTime()
    e.dataTransfer.setData('eventDurationMs', durationMs.toString())
    
    e.dataTransfer.effectAllowed = 'move'
    
    setTimeout(() => {
      if (badgeRef.current) badgeRef.current.style.opacity = '0.3'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (badgeRef.current) badgeRef.current.style.opacity = '1'
  }

  return (
    <Link 
      ref={badgeRef}
      href={href} 
      scroll={false} 
      className={className}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      style={{ cursor: 'move' }}
    >
      <div 
        className={dotClassName} 
        style={{ backgroundColor: event.project ? event.project.color : 'var(--text-secondary)' }}
      />
      <span className={timeClassName}>
        {format(new Date(event.fullStartTime), 'h:mma').toLowerCase()}
      </span>
      <span className={titleClassName}>
        {event.title}
      </span>
    </Link>
  )
}
