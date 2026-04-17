'use client'

import React, { useRef, useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { deleteEvent, updateEvent } from '@/lib/undoManager'

const getCurrentHourHeight = () => {
  if (typeof window === 'undefined') return 38;
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-height')) || 38;
};

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
  const searchParams = useSearchParams()
  const editEventId = searchParams.get('editEvent')
  const draftPColor = searchParams.get('pColor')

  const [currentScale, setCurrentScale] = useState(1)

  useEffect(() => {
    // Stale-Lock Handshake: Hide if our current props match the captured 'old' state.
    if (typeof window !== 'undefined') {
      const staleEvents = (window as any).__staleEvents || {}
      const stale = staleEvents[event.id]
      if (stale) {
        const currentStart = new Date(event.fullStartTime).toISOString()
        const currentEnd = new Date(event.fullEndTime).toISOString()
        
        // If our data matches the stale/old state, STAY HIDDEN. 
        if (currentStart === stale.start && currentEnd === stale.end) {
          setIsHidden(true)
        } else {
          // As soon as data changes, the lock is broken for this specific segment!
          setIsHidden(false)
          // We can optionally clear the global here, but we'll let the timer handle it.
        }
      } else {
        setIsHidden(false)
      }
    }
    
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
      // Stay hidden if our data still matches the captured 'stale' state.
      // This bridges the visual gap between the ghost disappearing and the router refresh completing.
      const win = (window as any)
      const staleEvents = win.__staleEvents || {}
      const stale = staleEvents[event.id]
      
      if (stale) {
        const currentStart = new Date(event.fullStartTime).toISOString()
        const currentEnd = new Date(event.fullEndTime).toISOString()
        
        if (currentStart === stale.start && currentEnd === stale.end) {
          setIsHidden(true)
          return
        }
      }
      
      setIsHidden(false)
    }

    const handleDeleted = (e: any) => {
      if (e.detail === event.id) setIsHidden(true)
    }

    window.addEventListener('pac-resize-preview', handlePreview)
    window.addEventListener('pac-resize-end', handleEnd)
    window.addEventListener('pac-event-deleted', handleDeleted)

    return () => {
      window.removeEventListener('pac-scale-change', onZoom)
      window.removeEventListener('pac-resize-preview', handlePreview)
      window.removeEventListener('pac-resize-end', handleEnd)
      window.removeEventListener('pac-event-deleted', handleDeleted)
    }
    // Deep dependency array ensures we un-hide correctly after the server payload arrives
  }, [event.id, String(event.fullStartTime), String(event.fullEndTime)])

  const activeScaledPixelHeight = heightFraction * 38 * currentScale
  const isRowLayout = activeScaledPixelHeight < 35 
  const isMicroLayout = activeScaledPixelHeight < 20

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const success = await deleteEvent(event.id)
      if (success) {
        window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Deleted "${event.title}"` }))
        await router.refresh()
      }
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (isResizing.current) { e.preventDefault(); return; }
    const actualStart = new Date(event.fullStartTime)
    const actualEnd = new Date(event.fullEndTime)
    const durationMs = actualEnd.getTime() - actualStart.getTime()
    const hScale = getCurrentHourHeight()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    
    // Simplest math: pixel offset within the event block converted to time
    const pixelOffsetInsideEvent = e.clientY - rect.top
    const cursorOffsetFromStartMs = (pixelOffsetInsideEvent / hScale) * 3600000

    e.dataTransfer.setData('eventId', event.id)
    e.dataTransfer.effectAllowed = 'move'
    ;(window as any).__activeDragId = event.id
    ;(window as any).__activeDragCursorOffsetMs = cursorOffsetFromStartMs
    ;(window as any).__activeDragDuration = durationMs
    ;(window as any).__activeDragTitle = event.title
    ;(window as any).__activeDragColor = event.project?.color ?? '#4285f4'
    ;(window as any).__activeDragOriginalStart = event.fullStartTime
    ;(window as any).__activeDragOriginalEnd = event.fullEndTime

    // Hide ghost
    const blankImg = new Image()
    blankImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(blankImg, 0, 0)
    
    // Important: use opacity/pointer-events instead of display:none.
    // display:none can cancel the drag-and-drop session in many browsers (like Chrome)
    // because the "source" element disappears from the accessibility/layout tree.
    setTimeout(() => setIsHidden(true), 0)
  }

  const handleDragEnd = () => {
    ;(window as any).__activeDragId = null
    const isLocked = (window as any).__staleEvents && (window as any).__staleEvents[event.id]
    window.dispatchEvent(new CustomEvent('pac-resize-end', { detail: { immediate: !isLocked } }))
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
          color: event.project?.color ?? '#4285f4'
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
    
    if (!currentTargetEndTime.current) {
      window.dispatchEvent(new CustomEvent('pac-resize-end', { detail: { immediate: true } }))
      return
    }
    
    const startIso = new Date(event.fullStartTime).toISOString()
    const origEndIso = new Date(event.fullEndTime).toISOString()
    const endIso = currentTargetEndTime.current.toISOString()
    
    if (endIso === origEndIso) {
      window.dispatchEvent(new CustomEvent('pac-resize-end', { detail: { immediate: true } }))
      return // No change happened
    }

    // Capture the STALE state (what we have right now) to keep things hidden until the change arrives
    const win = (window as any)
    if (!win.__staleEvents) win.__staleEvents = {}
    win.__staleEvents[event.id] = { start: startIso, end: origEndIso }
    
    // Auto-cleanup stale lock after 5s to prevent permanent 'ghosting' if anything fails.
    setTimeout(() => {
      if (win.__staleEvents) delete win.__staleEvents[event.id]
      setIsHidden(false)
    }, 5000)

    try {
      await updateEvent(event.id, { endTime: endIso })
      await router.refresh()
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
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? 'none' : 'auto',
        top: `calc(var(--hour-height) * ${topFraction})`,
        height: `max(16px, calc(var(--hour-height) * ${heightFraction}))`,
        position: 'absolute',
        left: assignedLeft,
        right: '6px',
        zIndex: zIndex,
        boxShadow: isLayoutIndented ? 'inset 0 0 0 1px rgba(0,0,0,0.05), 0 0 0 1.5px var(--surface-color), 0 4px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)',
        backgroundColor: (editEventId === event.id && draftPColor) ? `${draftPColor}33` : `${event.project?.color ?? '#4285f4'}33`,
        color: (editEventId === event.id && draftPColor) ? draftPColor : (event.project?.color ?? '#4285f4'),
        borderLeft: `4px solid ${(editEventId === event.id && draftPColor) ? draftPColor : (event.project?.color ?? '#4285f4')}`,
        cursor: 'move',
        userSelect: 'none',
        borderTopLeftRadius: isStartClipped ? '0px' : '4px',
        borderTopRightRadius: isStartClipped ? '0px' : '4px',
        borderBottomLeftRadius: isEndClipped ? '0px' : '4px',
        borderBottomRightRadius: isEndClipped ? '0px' : '4px',
        borderTop: isStartClipped ? `2px dashed ${event.project?.color ?? '#4285f4'}` : (isLayoutIndented ? '1px solid var(--border-color)' : 'none'),
        borderBottom: isEndClipped ? `2px dashed ${event.project?.color ?? '#4285f4'}` : (isLayoutIndented ? '1px solid var(--border-color)' : 'none'),
        overflow: 'hidden',
        fontSize: isMicroLayout ? '0.7rem' : '0.85rem',
        padding: isMicroLayout ? '0px 4px' : (isRowLayout ? '0px 6px' : '4px 6px')
      }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.stopPropagation()
        if (justResized.current) return

        // Check for unsaved changes before switching
        if (typeof window !== 'undefined' && (window as any).__isJuggleModalDirty) {
          const confirmDiscard = window.confirm("You have unsaved changes in the current task/event. Do you want to discard them?")
          if (!confirmDiscard) return
          ;(window as any).__isJuggleModalDirty = false
        }

        let anchorParams = ''
        if (blockRef.current) {
          const rect = blockRef.current.getBoundingClientRect()
          anchorParams = `&ax=${Math.round(rect.left)}&ay=${Math.round(rect.top)}&aw=${Math.round(rect.width)}&ah=${Math.round(rect.height)}`
        }
        router.push(`${href}${anchorParams}`, { scroll: false })
      }}
    >
      <div style={{ display: 'flex', flexDirection: isRowLayout ? 'row' : 'column', justifyContent: isRowLayout ? 'space-between' : 'flex-start', alignItems: isRowLayout ? 'center' : 'flex-start', gap: isRowLayout ? '6px' : '0px', height: '100%', width: '100%', color: 'inherit' }}>
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
