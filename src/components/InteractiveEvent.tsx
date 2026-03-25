'use client'

import React, { useRef, useState, useEffect, startTransition } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { deleteEvent } from '@/lib/undoManager'

export default function InteractiveEvent({ 
  event, 
  href, 
  top, 
  height,
  className,
  assignedLeft = '2px',
  isLayoutIndented = false,
  zIndex = 1
}: { 
  event: any, 
  href: string, 
  top: number, 
  height: number,
  className: string,
  assignedLeft?: string,
  isLayoutIndented?: boolean,
  zIndex?: number
}) {
  const router = useRouter()
  const blockRef = useRef<HTMLDivElement>(null)
  
  const [dragHeight, setDragHeight] = useState(height)
  const dragHeightRef = useRef(height) // Synchronous bypass for stale closure DOM events
  const isResizing = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(height)

  const isMoreThanHour = dragHeight > 55 // > 1 hr
  const is30MinOrLess = dragHeight <= 27 // <= 30 mins
  const is15Min = dragHeight <= 16

  const linkPadding = is15Min ? '0 0.15rem' : '0.25rem 0.5rem'

  // Sync internal drag height if server pushes a prop update
  useEffect(() => {
    setDragHeight(height)
    dragHeightRef.current = height
    // Forcefully restore visibility when the server pushes a newly positioned DND drop coordinate cleanly!
    if (blockRef.current) blockRef.current.style.opacity = '1'
  }, [height, top, event.startTime, event.endTime])



  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // Only delete if not inside a text field
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const success = await deleteEvent(event.id)
      if (success) {
        window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Deleted "${event.title}" — Press ⌘Z to undo` }))
        startTransition(() => {
          router.refresh()
        })
      }
    }
  }
  const handleDragStart = (e: React.DragEvent) => {
    if (isResizing.current) {
      e.preventDefault()
      return
    }
    
    // Inject relative timescale data structurally into payload
    const originalStartTime = new Date(event.startTime).getTime()
    const originalEndTime = event.endTime ? new Date(event.endTime).getTime() : originalStartTime + 3600000
    const durationMs = originalEndTime - originalStartTime
    
    // Calculate the precise pixel offset from the top of the event where the cursor grabbed it
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dragOffsetY = e.clientY - rect.top

    e.dataTransfer.setData('eventId', event.id)
    e.dataTransfer.setData('eventDurationMs', durationMs.toString())
    e.dataTransfer.setData('dragOffsetY', dragOffsetY.toString())
    e.dataTransfer.effectAllowed = 'move'
    
    // Globally register internal telemetry because Chrome explicitly locks dataTransfer reads securely until the exact moment of 'drop'
    ;(window as any).__activeDragOffsetY = dragOffsetY
    ;(window as any).__activeDragDuration = durationMs
    ;(window as any).__activeDragTitle = event.title
    ;(window as any).__activeDragColor = event.project ? event.project.color : null
    
    // Pass precise static typography to identically match original visual node
    const startTimeStr = format(new Date(event.startTime), 'h:mm a')
    const endTimeStr = event.endTime ? ` - ${format(new Date(event.endTime), 'h:mm a')}` : ''
    ;(window as any).__activeDragTime = startTimeStr + endTimeStr
    
    // Natively override the browser OS ghost graphic out of the layout rendering
    const blankImg = new Image()
    blankImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(blankImg, 0, 0)
    
    // Completely hide the native item initially
    setTimeout(() => {
      if (blockRef.current) blockRef.current.style.opacity = '0'
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    // If the browser natively aborted the drag, restore transparency
    if (e.dataTransfer.dropEffect === 'none') {
      if (blockRef.current) blockRef.current.style.opacity = '1'
    }
    
    ;(window as any).__activeDragOffsetY = null
    ;(window as any).__activeDragDuration = null
    ;(window as any).__activeDragTitle = null
    ;(window as any).__activeDragColor = null
    ;(window as any).__activeDragTime = null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault() // Prevents native HTML5 drag-and-drop ghosting conflict
    e.stopPropagation()
    isResizing.current = true
    startY.current = e.clientY
    startHeight.current = dragHeight
    
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isResizing.current) return
    const deltaY = e.clientY - startY.current
    
    // Snap cleanly to 15-minute intervals (51px / 4 = 12.75px)
    const snappedDeltaY = Math.round(deltaY / 12.75) * 12.75
    
    let newHeight = startHeight.current + snappedDeltaY
    if (newHeight < 12.75) newHeight = 12.75 // absolute min 15 mins
    
    setDragHeight(newHeight)
    dragHeightRef.current = newHeight // Sycnhronize natively against closure scope
  }

  const handlePointerUp = async (e: PointerEvent) => {
    isResizing.current = false
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    
    // Calculate new duration snapped strictly to 15 minute granular boundaries (bypass stale closure)
    const newDurationMins = Math.round((dragHeightRef.current / 51) * 60)
    const newEndTime = new Date(new Date(event.startTime).getTime() + newDurationMins * 60000)

    try {
      await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endTime: newEndTime.toISOString() })
      })
      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      console.error("Failed to commit resize", err)
    }
  }

  return (
    <div 
      ref={blockRef}
      className={className}
      data-event-block="true"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        top: `${top}px`,
        height: `${dragHeight}px`,
        position: 'absolute',
        left: assignedLeft,
        right: '4px',
        zIndex: zIndex,
        boxShadow: isLayoutIndented ? '0 0 0 1.5px var(--surface-color), 0 4px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)' : 'none', // Cutout gap + shadow
        backgroundColor: event.project ? `${event.project.color}33` : 'var(--surface-hover)',
        backdropFilter: isLayoutIndented ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: isLayoutIndented ? 'blur(8px)' : 'none',
        color: event.project ? event.project.color : 'var(--text-primary)',
        borderLeft: `4px solid ${event.project ? event.project.color : 'var(--border-color)'}`,
        border: isLayoutIndented ? '1px solid var(--border-color)' : 'none',
        cursor: 'move',
        userSelect: 'none',
        borderRadius: '4px',
        overflow: 'hidden',
        fontSize: is15Min ? '0.65rem' : '0.75rem',
        lineHeight: 1.2,
        padding: is15Min ? '0px 4px' : undefined
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div 
        onClick={() => router.push(href, { scroll: false })}
        style={{ 
          display: 'flex', 
          flexDirection: is30MinOrLess ? 'row' : 'column',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          gap: is30MinOrLess ? '4px' : '0px',
          height: '100%', 
          width: '100%', 
          color: 'inherit', 
          textDecoration: 'none', 
          padding: linkPadding,
          overflow: 'hidden'
        }}
      >
        <div style={{ fontWeight: 600, flexShrink: 0, maxWidth: '100%', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        <div style={{ opacity: 0.8, flexShrink: 1, maxWidth: '100%', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {format(new Date(event.startTime), 'h:mm a')} 
          {isMoreThanHour && event.endTime && ` - ${format(new Date(event.endTime), 'h:mm a')}`}
        </div>
      </div>
      
      {/* Structural Resizer Hook */}
      <div 
        onPointerDown={handlePointerDown}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '8px',
          cursor: 'ns-resize',
          zIndex: 10
        }}
      />
    </div>
  )
}
