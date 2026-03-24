'use client'

import React, { useRef } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'

export default function InteractiveEvent({ 
  event, 
  href, 
  top, 
  height,
  className
}: { 
  event: any, 
  href: string, 
  top: number, 
  height: number,
  className: string 
}) {
  const router = useRouter()
  const blockRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('eventId', event.id)
    e.dataTransfer.effectAllowed = 'move'
    
    // Make the original temporarily invisible natively during flight
    setTimeout(() => {
      if (blockRef.current) blockRef.current.style.opacity = '0.4'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (blockRef.current) blockRef.current.style.opacity = '1'
  }

  return (
    <div 
      ref={blockRef}
      className={className}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        position: 'absolute',
        width: 'calc(100% - 10px)',
        backgroundColor: event.project ? `${event.project.color}33` : 'var(--surface-hover)',
        color: event.project ? event.project.color : 'var(--text-primary)',
        borderLeft: `4px solid ${event.project ? event.project.color : 'var(--border-color)'}`,
        cursor: 'move',
        userSelect: 'none',
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        overflow: 'hidden',
        fontSize: '0.75rem',
        lineHeight: 1.2
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Link 
        href={href} 
        scroll={false} 
        style={{ display: 'block', height: '100%', width: '100%', color: 'inherit', textDecoration: 'none' }}
        draggable={false} // don't trigger native Link ghost drags concurrently
      >
        <div style={{ fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</div>
        <div style={{ opacity: 0.8 }}>{format(new Date(event.startTime), 'h:mm a')}</div>
      </Link>
    </div>
  )
}
