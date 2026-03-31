'use client'

import React, { useRef, useState, useEffect, startTransition } from 'react'
import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import { deleteEvent, updateEvent } from '@/lib/undoManager'

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
  event: any, 
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

  const [currentScale, setCurrentScale] = useState(1)

  useEffect(() => {
    // Handshake: If we are the newly mounted replacement for a recently moved event, clear the pending flag
    if ((window as any).__pendingEventId === event.id) {
      (window as any).__pendingEventId = null
    }
    setIsHidden(false)
    if (blockRef.current) blockRef.current.style.opacity = '1'
    
    // Zoom scale listener
    const onZoom = () => {
      const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38
      setCurrentScale(hScale / 38)
    }
    onZoom()
    window.addEventListener('pac-scale-change', onZoom)

    // Move/Resize Listeners: Hide during 'Optimistic Preview' phase
    const handlePreview = (e: any) => {
      if (e.detail.id === event.id) setIsHidden(true)
    }
    const handleEnd = () => {
      // Stay hidden only if we are the 'stale' DB version waiting for a refresh
      if ((window as any).__pendingEventId === event.id) {
        setIsHidden(true) 
      } else {
        setIsHidden(false)
      }
    }

    window.addEventListener('pac-resize-preview', handlePreview)
    window.addEventListener('pac-resize-end', handleEnd)
    
    return () => {
      window.removeEventListener('pac-scale-change', onZoom)
      window.removeEventListener('pac-resize-preview', handlePreview)
      window.removeEventListener('pac-resize-end', handleEnd)
    }
    // Deep dependency array ensures we un-hide correctly after the server payload arrives
  }, [event.id, String(event.fullStartTime), String(event.fullEndTime)])

  const activeScaledPixelHeight = heightFraction * 38 * currentScale
  const is30MinOrLess = heightFraction <= 0.5 
  const is15Min = heightFraction <= 0.25

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const success = await deleteEvent(event.id)
      if (success) {
        window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Deleted "${event.title}"` }))
        startTransition(() => router.refresh())
      }
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (isResizing.current) { e.preventDefault(); return; }
    const actualStart = new Date(event.fullStartTime)
    const actualEnd = new Date(event.fullEndTime)
    const durationMs = actualEnd.getTime() - actualStart.getTime()
    const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const topPixels = parseFloat(getComputedStyle(e.currentTarget as HTMLElement).top) || 0
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
    
    // Hide ghost
    const blankImg = new Image()
    blankImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(blankImg, 0, 0)
    
    // Hide self
    setTimeout(() => setIsHidden(true), 0)
  }

  const handleDragEnd = () => {
    ;(window as any).__activeDragId = null
    window.dispatchEvent(new CustomEvent('pac-resize-end'))
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    isResizing.current = true
    startY.current = e.clientY
    currentTargetEndTime.current = new Date(event.fullEndTime) 
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handlePointerMove = (e: PointerEvent) => {
    if (!isResizing.current) return
    let el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    while (el && !el.hasAttribute('data-day-col')) el = el.parentElement
    const tDateStr = el?.getAttribute('data-date')
    if (tDateStr) {
      const rect = el!.getBoundingClientRect()
      const y = e.clientY - rect.top
      const hScale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38
      const rawMinutes = (y / hScale) * 60
      const snapped = Math.max(0, Math.min(Math.round(rawMinutes / 15) * 15, 24 * 60))
      const [y_y, m_m, d_d] = tDateStr.split('-').map(Number)
      const targetTime = new Date(y_y, m_m - 1, d_d)
      targetTime.setHours(Math.floor(snapped / 60), snapped % 60, 0, 0)
      const actualStart = new Date(event.fullStartTime)
      const minEnd = new Date(actualStart.getTime() + 15 * 60000)
      const finalTargetTime = targetTime < minEnd ? minEnd : targetTime
      currentTargetEndTime.current = finalTargetTime

      window.dispatchEvent(new CustomEvent('pac-resize-preview', { 
        detail: { 
          id: event.id, title: event.title, startTimeStr: actualStart.toISOString(), targetEndTimeStr: finalTargetTime.toISOString(),
          color: event.project ? event.project.color : null
        } 
      }))
    }
  }

  const handlePointerUp = async () => {
    isResizing.current = false
    justResized.current = true
    setTimeout(() => { justResized.current = false }, 100)
    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
    window.dispatchEvent(new CustomEvent('pac-resize-end'))
    if (!currentTargetEndTime.current) return
    ;(window as any).__pendingEventId = event.id
    try {
      await updateEvent(event.id, { endTime: currentTargetEndTime.current.toISOString() })
      startTransition(() => router.refresh())
    } catch (err) { console.error(err) }
  }

  return (
    <div 
      ref={blockRef}
      className={className}
      data-event-block="true"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{
        display: isHidden ? 'none' : 'block',
        top: `calc(var(--hour-height) * ${topFraction})`,
        height: `max(16px, calc(var(--hour-height) * ${heightFraction}))`,
        position: 'absolute',
        left: assignedLeft,
        right: '6px',
        zIndex: zIndex,
        boxShadow: isLayoutIndented ? 'inset 0 0 0 1px rgba(0,0,0,0.05), 0 0 0 1.5px var(--surface-color), 0 4px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
        backgroundColor: event.project ? `${event.project.color}33` : 'var(--surface-hover)',
        color: event.project ? event.project.color : 'var(--text-primary)',
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
      <div style={{ display: 'flex', flexDirection: is30MinOrLess ? 'row' : 'column', justifyContent: is30MinOrLess ? 'space-between' : 'flex-start', alignItems: 'flex-start', gap: is30MinOrLess ? '6px' : '0px', height: '100%', width: '100%', color: 'inherit', padding: 0.5 }}>
        <div style={{ fontWeight: 600, flexShrink: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.title}
        </div>
        <div style={{ opacity: 0.8, fontSize: '0.75rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {(() => {
              const actualStart = new Date(event.fullStartTime)
              const actualEnd = new Date(event.fullEndTime)
              const isMultiday = format(actualStart, 'yyyy-MM-dd') !== format(actualEnd, 'yyyy-MM-dd')
              if (!isMultiday && activeScaledPixelHeight <= 55) return format(actualStart, 'h:mm a')
              const s_str = isMultiday ? format(actualStart, 'EEE, h:mm a').toUpperCase() : format(actualStart, 'h:mm a')
              const e_str = isMultiday ? format(actualEnd, 'EEE, h:mm a').toUpperCase() : format(actualEnd, 'h:mm a')
              return `${s_str} → ${e_str}`
            })()}
        </div>
      </div>
      {!isEndClipped && (
        <div onPointerDown={handlePointerDown} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '8px', cursor: 'ns-resize', zIndex: 10 }} />
      )}
    </div>
  )
}
