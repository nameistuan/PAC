'use client'

import React, { useRef, useState, useEffect, startTransition } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { deleteEvent, updateEvent } from '@/lib/undoManager'
import { EventSegment } from '@/lib/calendarEngine'
import { HOUR_HEIGHT } from '@/lib/constants'

export default function InteractiveEvent({ 
  event, 
  href, 
  dateStr,
  topFraction, 
  heightFraction,
  className,
  assignedLeft = '2px',
  isLayoutIndented = false,
  zIndex = 1,
  isStartClipped = false,
  isEndClipped = false
}: { 
  event: EventSegment, 
  href: string, 
  dateStr: string,
  topFraction: number, 
  heightFraction: number,
  className: string,
  assignedLeft?: string,
  isLayoutIndented?: boolean,
  zIndex?: number,
  isStartClipped?: boolean,
  isEndClipped?: boolean
}) {
  const [isHidden, setIsHidden] = useState(false)
  const router = useRouter()
  const blockRef = useRef<HTMLDivElement>(null)
  
  const isResizing = useRef(false)
  const justResized = useRef(false)
  const startY = useRef(0)
  const currentTargetEndTime = useRef<Date | null>(null)

  // Use state to track zoom, re-calculating typography thresholds dynamically
  const [currentScale, setCurrentScale] = useState(1)

  useEffect(() => {
    if ((window as any).__pendingEventId === event.id) {
      (window as any).__pendingEventId = null
    }
    setIsHidden(false)
    if (blockRef.current) blockRef.current.style.opacity = '1'
    
    // Subscribe to zoom
    const onZoom = () => {
      const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38
      setCurrentScale(hScale / 38)
    }
    onZoom()
    window.addEventListener('pac-scale-change', onZoom)
    return () => window.removeEventListener('pac-scale-change', onZoom)
  }, [event.startTime, event.endTime, event.id])

  // Thresholds use the active scaled pixel value
  const activeScaledPixelHeight = heightFraction * 38 * currentScale
  const isMoreThanHour = heightFraction >= 1 
  const is30MinOrLess = heightFraction <= 0.5 
  const is15Min = heightFraction <= 0.25

  const handleKeyDown = async (e: React.KeyboardEvent) => {
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
    
    const actualStart = new Date(event.fullStartTime)
    const actualEnd = new Date(event.fullEndTime)
    const durationMs = actualEnd.getTime() - actualStart.getTime()
    
    const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    // calculate pixel offset in column coordinate system
    const topPixelsStr = getComputedStyle(e.currentTarget as HTMLElement).top
    const topPixels = parseFloat(topPixelsStr) || 0
    const cursorYInCol = (e.clientY - rect.top) + topPixels
    
    const cursorDayOffsetMs = (cursorYInCol / hScale) * 3600000
    
    const [yyyy, mm, dd] = dateStr.split('-').map(Number)
    const currentDayStart = new Date(yyyy, mm - 1, dd)
    const dragCursorTimeMs = currentDayStart.getTime() + cursorDayOffsetMs
    const cursorOffsetFromStartMs = dragCursorTimeMs - actualStart.getTime()

    e.dataTransfer.setData('eventId', event.id)
    e.dataTransfer.effectAllowed = 'move'
    
    ;(window as any).__activeDragId = event.id
    ;(window as any).__activeDragCursorOffsetMs = cursorOffsetFromStartMs
    ;(window as any).__activeDragDuration = durationMs
    ;(window as any).__activeDragTitle = event.title
    ;(window as any).__activeDragColor = event.project ? event.project.color : null
    
    const startTimeStr = format(actualStart, 'h:mm a')
    const endTimeStr = ` - ${format(actualEnd, 'h:mm a')}`
    ;(window as any).__activeDragTime = startTimeStr + endTimeStr
    
    const blankImg = new Image()
    blankImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(blankImg, 0, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(window as any).__activeDragId = null
    ;(window as any).__activeDragCursorOffsetMs = null
    window.dispatchEvent(new CustomEvent('pac-resize-end'))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault() 
    e.stopPropagation()
    isResizing.current = true
    startY.current = e.clientY
    currentTargetEndTime.current = new Date(event.fullEndTime) 
    
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  useEffect(() => {
    const handlePreview = (e: any) => {
      const { id } = e.detail
      if (id === event.id) setIsHidden(true)
    }
    const handleEnd = () => {
      if ((window as any).__pendingEventId === event.id) setIsHidden(true)
      else setIsHidden(false)
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
    while (el && !el.hasAttribute('data-day-col')) el = el.parentElement

    const tDateStr = el?.getAttribute('data-date')
    const actualStart = new Date(event.fullStartTime)

    if (tDateStr) {
      const rect = el!.getBoundingClientRect()
      const y = e.clientY - rect.top
      const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38
      const rawMinutes = (y / hScale) * 60
      const minutesOnTargetDay = Math.max(0, Math.min(Math.round(rawMinutes / 15) * 15, 24 * 60))
      
      const [yyyy, mm, dd] = tDateStr.split('-').map(Number)
      const targetTime = new Date(yyyy, mm - 1, dd)
      
      if (minutesOnTargetDay === 24 * 60) {
        targetTime.setDate(targetTime.getDate() + 1)
        targetTime.setHours(0, 0, 0, 0) 
      } else {
        targetTime.setHours(Math.floor(minutesOnTargetDay / 60), minutesOnTargetDay % 60, 0, 0)
      }
      targetTime.setMilliseconds(0)

      const minEnd = new Date(actualStart.getTime() + 15 * 60000)
      const finalTargetTime = targetTime < minEnd ? minEnd : targetTime
      currentTargetEndTime.current = finalTargetTime

      window.dispatchEvent(new CustomEvent('pac-resize-preview', { 
        detail: { 
          id: event.id,
          title: event.title,
          startTimeStr: actualStart.toISOString(),
          targetEndTimeStr: finalTargetTime.toISOString(),
          color: event.project ? event.project.color : null
        } 
      }))
    }
  }

  const handlePointerUp = async (e: PointerEvent) => {
    isResizing.current = false
    justResized.current = true
    setTimeout(() => { justResized.current = false }, 100)
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
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
      console.error(err)
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
        top: `calc(var(--hour-height) * ${topFraction})`,
        height: `max(16px, calc(var(--hour-height) * ${heightFraction}))`,
        position: 'absolute',
        left: assignedLeft,
        right: '6px',
        zIndex: zIndex,
        outline: 'none',
        boxShadow: isLayoutIndented ? 'inset 0 0 0 1px rgba(0,0,0,0.05), 0 0 0 1.5px var(--surface-color), 0 4px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
        backgroundColor: event.project ? `${event.project.color}33` : 'var(--surface-hover)',
        color: event.project ? event.project.color : 'var(--text-primary)',
        borderRight: isLayoutIndented ? '1px solid var(--border-color)' : 'none',
        borderLeft: `4px solid ${event.project ? event.project.color : 'var(--border-color)'}`,
        cursor: 'move',
        userSelect: 'none',
        borderTopLeftRadius: isStartClipped ? '0px' : '4px',
        borderTopRightRadius: isStartClipped ? '0px' : '4px',
        borderBottomLeftRadius: isEndClipped ? '0px' : '4px',
        borderBottomRightRadius: isEndClipped ? '0px' : '4px',
        borderTop: isStartClipped ? `2px dashed ${event.project ? event.project.color : 'rgba(0,0,0,0.5)'}` : (isLayoutIndented ? '1px solid var(--border-color)' : 'none'),
        borderBottom: isEndClipped ? `2px dashed ${event.project ? event.project.color : 'rgba(0,0,0,0.5)'}` : (isLayoutIndented ? '1px solid var(--border-color)' : 'none'),
        overflow: 'hidden',
        fontSize: is15Min ? '0.7rem' : '0.85rem',
        opacity: (isStartClipped || isEndClipped) ? 0.85 : 1,
        lineHeight: 1.2,
        fontWeight: 500,
        padding: is15Min ? '0px 4px' : '4px 6px'
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.stopPropagation()
        if (justResized.current) return
        let anchorParams = ''
        if (blockRef.current) {
          const rect = blockRef.current.getBoundingClientRect()
          anchorParams = `&ax=${Math.round(rect.left)}&ay=${Math.round(rect.top)}&aw=${Math.round(rect.width)}&ah=${Math.round(rect.height)}`
        }
        router.push(`${href}${anchorParams}`, { scroll: false })
      }}
    >
      <div style={{ display: 'flex', flexDirection: is30MinOrLess ? 'row' : 'column', justifyContent: is30MinOrLess ? 'space-between' : 'flex-start', alignItems: 'flex-start', gap: is30MinOrLess ? '6px' : '0px', height: '100%', width: '100%', color: 'inherit', padding: 0, overflow: 'hidden' }}>
        <div style={{ fontWeight: 600, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        <div style={{ opacity: 0.8, fontSize: '0.75rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {(() => {
              const actualStart = new Date(event.fullStartTime)
              const actualEnd = new Date(event.fullEndTime)
              const isMultiday = format(actualStart, 'yyyy-MM-dd') !== format(actualEnd, 'yyyy-MM-dd')
              if (!isMultiday && activeScaledPixelHeight <= 55) return format(actualStart, 'h:mm a')
              
              const startStr = isMultiday ? format(actualStart, 'EEE, h:mm a').toUpperCase() : format(actualStart, 'h:mm a')
              const endStr = isMultiday ? format(actualEnd, 'EEE, h:mm a').toUpperCase() : format(actualEnd, 'h:mm a')
              return `${startStr} → ${endStr}`
            })()}
        </div>
      </div>
      
      {!isEndClipped && (
        <div 
          onPointerDown={handlePointerDown}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px', cursor: 'ns-resize', zIndex: 10 }}
        />
      )}
    </div>
  )
}
