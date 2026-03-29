'use client'

import React, { useRef, useState, useEffect, startTransition } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { deleteEvent, updateEvent } from '@/lib/undoManager'

export default function InteractiveEvent({ 
  event, 
  href, 
  dateStr,
  top, 
  height,
  className,
  assignedLeft = '2px',
  isLayoutIndented = false,
  zIndex = 1
}: { 
  event: any, 
  href: string, 
  dateStr: string,
  top: number, 
  height: number,
  className: string,
  assignedLeft?: string,
  isLayoutIndented?: boolean,
  zIndex?: number
}) {
  const [isHidden, setIsHidden] = useState(false)
  const router = useRouter()
  const blockRef = useRef<HTMLDivElement>(null)
  
  const [dragHeight, setDragHeight] = useState(height)
  const dragHeightRef = useRef(height) // Synchronous bypass for stale closure DOM events
  const isResizing = useRef(false)
  const justResized = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(height)
  const currentTargetEndTime = useRef<Date | null>(null)

  const isMoreThanHour = dragHeight > 55 // > 1 hr
  const is30MinOrLess = dragHeight <= 27 // <= 30 mins
  const is15Min = dragHeight <= 16

  const linkPadding = is15Min ? '0 0.15rem' : '0.25rem 0.5rem'

  // Sync internal drag height if server pushes a prop update
  // Sync internal drag height if server pushes a prop update
  useEffect(() => {
    setDragHeight(height)
    dragHeightRef.current = height
    // Recover visibility only once the server data has actually flipped to the new state
    if ((window as any).__pendingEventId === event.id) {
      (window as any).__pendingEventId = null
    }
    setIsHidden(false)
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
    const actualStart = event.fullStartTime ? new Date(event.fullStartTime) : new Date(event.startTime)
    const actualEnd = event.fullEndTime ? new Date(event.fullEndTime) : new Date(actualStart.getTime() + 3600000)
    const durationMs = actualEnd.getTime() - actualStart.getTime()
    
    // Multi-day offset: Distance from the actual event start to the top of the current day's rendered block
    const clipOffsetMs = event.displayStart ? (new Date(event.displayStart).getTime() - actualStart.getTime()) : 0
    const clipOffsetPx = (clipOffsetMs / 3600000) * 51

    // Calculate the precise pixel offset from the TRUE start of the event where the cursor grabbed it
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dragOffsetY = (e.clientY - rect.top) + clipOffsetPx

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
    const startTimeStr = format(actualStart, 'h:mm a')
    const endTimeStr = event.endTime ? ` - ${format(actualEnd, 'h:mm a')}` : ''
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
    currentTargetEndTime.current = new Date(event.endTime) // Default to original
    
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  // Listen for resize signals to hide real segments while resizer ghost handles the visuals
  useEffect(() => {
    const handlePreview = (e: any) => {
      const { id } = e.detail
      if (id === event.id) {
        setIsHidden(true)
      }
    }
    const handleEnd = () => {
      if ((window as any).__pendingEventId === event.id) {
        setIsHidden(true)
      } else {
        setIsHidden(false)
      }
    }
    window.addEventListener('pac-resize-preview', handlePreview)
    window.addEventListener('pac-resize-end', handleEnd)
    return () => {
      window.removeEventListener('pac-resize-preview', handlePreview)
      window.removeEventListener('pac-resize-end', handleEnd)
    }
  }, [event.id])

  const handlePointerMove = (e: PointerEvent) => {
    if (!isResizing.current) return
    
    let el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    while (el && !el.hasAttribute('data-day-col')) {
      el = el.parentElement
    }

    const tDateStr = el?.getAttribute('data-date')
    const actualStart = event.fullStartTime ? new Date(event.fullStartTime) : new Date(event.startTime)

    if (tDateStr) {
      const rect = el!.getBoundingClientRect()
      const y = e.clientY - rect.top
      
      // Strict boundary clamping within the current target day
      const rawMinutes = (y / 51) * 60
      const minutesOnTargetDay = Math.max(0, Math.min(Math.round(rawMinutes / 15) * 15, 24 * 60))
      
      const [yyyy, mm, dd] = tDateStr.split('-').map(Number)
      const targetTime = new Date(yyyy, mm - 1, dd)
      targetTime.setHours(Math.floor(minutesOnTargetDay / 60), minutesOnTargetDay % 60, 0, 0)
      
      // Even if mouse is in the 24th hour of day N, don't let targetTime jump to midnight of day N+1
      // unless the user literally moves the cursor to day N+1
      if (minutesOnTargetDay === 24 * 60) {
        targetTime.setHours(23, 59, 59, 999) 
      }

      const minEnd = new Date(actualStart.getTime() + 15 * 60000)
      const finalTargetTime = targetTime < minEnd ? minEnd : targetTime
      
      currentTargetEndTime.current = finalTargetTime

      // Broadcast unified time for ghost blocks across all columns
      window.dispatchEvent(new CustomEvent('pac-resize-preview', { 
        detail: { 
          id: event.id,
          title: event.title,
          startTimeStr: actualStart.toISOString(),
          targetEndTimeStr: finalTargetTime.toISOString(),
          color: event.project ? event.project.color : 'var(--primary-color)'
        } 
      }))

      window.dispatchEvent(new CustomEvent('pac-toast', { 
        detail: `Target: ${format(finalTargetTime, 'MMM d, h:mm a')}` 
      }))
    } else {
      // Just ignore out-of-bounds mouse moves so the interaction doesn't flick/reset
      return
    }
  }


  const handlePointerUp = async (e: PointerEvent) => {
    isResizing.current = false
    justResized.current = true
    setTimeout(() => { justResized.current = false }, 100)
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    
    // Cleanup cross-day previews
    window.dispatchEvent(new CustomEvent('pac-resize-end'))
    
    if (!currentTargetEndTime.current) return
    
    ;(window as any).__pendingEventId = event.id
    setIsHidden(true)

    try {
      const label = await updateEvent(event.id, { endTime: currentTargetEndTime.current.toISOString() })
      if (label) {
        window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Resized "${label}" to ${format(currentTargetEndTime.current, 'MMM d, h:mm a')}` }))
      }
      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      console.error("Resize mutation failed - data integrity preserved.", err)
      setDragHeight(height)
      dragHeightRef.current = height
    }
  }

  return (
    <div 
      ref={blockRef}
      className={className}
      data-event-block="true"
      onKeyDown={handleKeyDown}
      style={{
        display: isHidden ? 'none' : 'block',
        top: `${top}px`,
        height: `${dragHeight}px`,
        position: 'absolute',
        left: assignedLeft,
        right: '4px',
        zIndex: zIndex,
        outline: 'none',
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
      onClick={(e) => {
        e.stopPropagation()
        if (justResized.current) return
        
        // Use local positioning for robustness across Next.js transitions
        let anchorParams = ''
        if (blockRef.current) {
          const rect = blockRef.current.getBoundingClientRect()
          anchorParams = `&ax=${Math.round(rect.left)}&ay=${Math.round(rect.top)}&aw=${Math.round(rect.width)}&ah=${Math.round(rect.height)}`
        }
        router.push(`${href}${anchorParams}`, { scroll: false })
      }}
    >
      <div 
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
