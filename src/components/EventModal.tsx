'use client'

import { useState, useEffect, useRef, startTransition, useLayoutEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import styles from './EventModal.module.css'
import { deleteEvent, updateEvent, pushCreate } from '@/lib/undoManager'

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function EventModal({ 
  eventId, 
  onClose,
  initialDate,
  initialStartTime,
  initialEndTime
}: { 
  eventId?: string, 
  onClose: () => void,
  initialDate?: string,
  initialStartTime?: string,
  initialEndTime?: string
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  // Robust parsing: if passed an ISO string (e.g. from InteractiveDayCol), extract only what the <input type="time"> needs
  const parseInitTime = (val: string | undefined, fallback: string) => {
    if (!val) return fallback
    if (val.includes('T')) return val.split('T')[1].slice(0, 5)
    return val
  }
  const parseInitDate = (val: string | undefined) => {
    if (!val) return new Date().toISOString().slice(0, 10)
    if (val.includes('T')) return val.split('T')[0]
    return val
  }

  const [startDate, setStartDate] = useState(() => parseInitDate(initialDate))
  const [endDate, setEndDate] = useState(() => parseInitDate(initialDate))
  const [startTime, setStartTime] = useState(() => parseInitTime(initialStartTime, '09:00'))
  const [endTime, setEndTime] = useState(() => parseInitTime(initialEndTime, '10:00'))
  const [isFluid, setIsFluid] = useState(false)
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!eventId
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const modalRef = useRef<HTMLDivElement>(null)

  // Sync props to state for rapid drag-creation without unmounting
  useEffect(() => {
    if (!isEditing) {
      if (initialDate) {
        const d = parseInitDate(initialDate)
        setStartDate(d)
        setEndDate(d)
      }
      if (initialStartTime) setStartTime(parseInitTime(initialStartTime, '09:00'))
      if (initialEndTime) setEndTime(parseInitTime(initialEndTime, '10:00'))
    }
  }, [initialDate, initialStartTime, initialEndTime, isEditing])
  
  const [modalPos, setModalPos] = useState<{ top: number; left: number } | null>(null)
  // Position the modal next to the anchor event (read from URL or fallback)
  const calculatePosition = () => {
    // Read anchor from URL (passed by InteractiveEvent/DayCol)
    const ax = parseFloat(searchParams.get('ax') || '0')
    const ay = parseFloat(searchParams.get('ay') || '0')
    const aw = parseFloat(searchParams.get('aw') || '0')
    const ah = parseFloat(searchParams.get('ah') || '0')
    const hasAnchor = searchParams.has('ax') && searchParams.has('ay')

    if (hasAnchor && modalRef.current) {
      const modalW = modalRef.current.offsetWidth || 440
      const modalH = modalRef.current.offsetHeight || 400
      const gap = 12
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight

      // Horizontal: Place to the side of the event (prefer right, then left)
      let left: number
      if (ax + aw + gap + modalW <= vw - 16) {
        left = ax + aw + gap
      } else if (ax - gap - modalW >= 16) {
        left = ax - gap - modalW
      } else {
        left = Math.max(16, (vw - modalW) / 2) // fallback to center if no side space
      }

      // Vertical: Center the modal relative to the event's center
      let top = (ay + ah / 2) - modalH / 2
      
      // Safety clamp for vertical edges
      if (top + modalH > vh - 24) {
        top = Math.max(16, vh - modalH - 24)
      }
      if (top < 16) top = 16

      // Final safety clamp for horizontal edges (though usually handled above)
      if (left + modalW > vw - 16) {
        left = Math.max(16, vw - modalW - 16)
      }

      setModalPos({ top, left })
    } else {
      // Centered fallback
      const vw = document.documentElement.clientWidth
      setModalPos(null)
    }
  }

  // Positioning and UX listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    calculatePosition()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchParams])

  // Monitor size changes (like when projects/notes load) and window resizing
  useLayoutEffect(() => {
    calculatePosition()
    
    if (modalRef.current) {
      const observer = new ResizeObserver(() => calculatePosition())
      observer.observe(modalRef.current)
      window.addEventListener('resize', calculatePosition)
      return () => {
        observer.disconnect()
        window.removeEventListener('resize', calculatePosition)
      }
    }
  }, [searchParams, projects, title, description]) // Re-run when content might change size

  // Focus Title input for new events, or just modal container for edits (to preserve delete-key functionality)
  useEffect(() => {
    if (modalRef.current) {
      if (!isEditing) {
        const titleInput = modalRef.current.querySelector('input[name="title"]') as HTMLInputElement
        titleInput?.focus()
      } else {
        modalRef.current.focus()
      }
    }
  }, [isEditing])

  useEffect(() => {
    // Fetch projects and sort by 'most recently used' usage pattern (idealized MRU simulation)
    // We sort alphabetically to be tidy, but could add MRU logic by querying recent events
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => {
        const mruId = localStorage.getItem('pac-mru-project')
        const sorted = data.sort((a: Project, b: Project) => {
          if (a.id === mruId) return -1
          if (b.id === mruId) return 1
          return a.name.localeCompare(b.name)
        })
        setProjects(sorted)
      })
      .catch(err => console.error("Failed to fetch projects", err))
      
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => {
          const start = new Date(data.startTime)
          const end = new Date(data.endTime)
          setTitle(data.title)
          setDescription(data.description || '')
          setLocation(data.location || '')
          setStartDate(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`)
          setEndDate(`${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`)
          setStartTime(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`)
          setEndTime(`${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`)
          setIsFluid(data.isFluid ?? false)
          setProjectId(data.projectId || '')
        })
        .catch(err => console.error("Failed to load focal event", err))
    } else {
      if (initialDate) {
        const d = parseInitDate(initialDate)
        setStartDate(d)
        setEndDate(d)
      }
      if (initialStartTime) setStartTime(parseInitTime(initialStartTime, '09:00'))
      if (initialEndTime) setEndTime(parseInitTime(initialEndTime, '10:00'))
    }
  }, [eventId, initialDate, initialStartTime, initialEndTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // All-day events span the full day
    const start = isFluid
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime}:00`)
    const end = isFluid
      ? new Date(`${endDate}T23:59:59`)
      : new Date(`${endDate}T${endTime}:00`)

    if (!isFluid && start >= end) {
      alert("End time must be after start time.")
      setIsSubmitting(false)
      return
    }

    if (projectId) {
      localStorage.setItem('pac-mru-project', projectId)
    }

    const startIso = start.toISOString()
    const endIso = end.toISOString()

    try {
      if (isEditing && eventId) {
        const label = await updateEvent(eventId, {
          title,
          description,
          location,
          startTime: startIso,
          endTime: endIso,
          projectId: projectId || null,
          isFluid,
        })
        if (label) {
          window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Edited "${title}" — Press ⌘Z to undo` }))
        }
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            location: location || undefined,
            startTime: start,
            endTime: end,
            projectId: projectId || undefined,
            isFluid,
          })
        })
        const created = await res.json()
        pushCreate({
          id: created.id,
          title: created.title,
          description: created.description,
          location: created.location,
          startTime: created.startTime,
          endTime: created.endTime,
          projectId: created.projectId,
          taskId: created.taskId,
          isFluid: created.isFluid ?? false,
        })
      }
      
      onClose()
      startTransition(() => {
        router.refresh()
      })
    } catch (err) {
      console.error(err)
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId) return
    setIsSubmitting(true)
    const success = await deleteEvent(eventId)
    if (success) {
      window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Deleted "${title}" — Press ⌘Z to undo` }))
      onClose()
      startTransition(() => {
        router.refresh()
      })
    } else {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        ref={modalRef}
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        style={{
          top: modalPos ? `${modalPos.top}px` : '50%',
          left: modalPos ? `${modalPos.left}px` : '50%',
          transform: modalPos ? 'none' : 'translate(-50%, -50%)',
          position: 'absolute'
        }}
        tabIndex={-1}
        onKeyDown={(e) => {
          const tag = document.activeElement?.tagName
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
          if ((e.key === 'Delete' || e.key === 'Backspace') && isEditing) {
            e.preventDefault()
            handleDelete()
          }
        }}
      >
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {/* Header Icons (Google style) */}
          <div className={styles.topIconBar}>
            {isEditing && (
              <>
                <button type="button" className={styles.iconBtn} onClick={handleDelete} title="Delete">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                </button>
                <button type="button" className={styles.iconBtn} title="More options">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
              </>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" className={styles.closeIconBtn} onClick={onClose} title="Close">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className={styles.modalBody}>
            {/* Title Section */}
            <div className={styles.titleSection}>
              <div className={styles.tagIndicator} style={{ backgroundColor: projects.find(p => p.id === projectId)?.color || 'var(--border-color)' }} />
              <input
                name="title"
                className={styles.titleInput}
                type="text"
                required
                placeholder="Add title"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            {/* Time & Date */}
            <div className={styles.fieldRow}>
              <div className={styles.iconContainer}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <div className={styles.timeInputsWrapper} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '4px 0' }}>
                 <label className={styles.allDayToggle}>
                   <input
                     type="checkbox"
                     checked={isFluid}
                     onChange={e => setIsFluid(e.target.checked)}
                     className={styles.allDayCheckbox}
                   />
                   All day
                 </label>
                 <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                     <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} />
                     {!isFluid && <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} />}
                 </div>
                 <div style={{ marginLeft: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>to</div>
                 <div style={{ display: 'flex', gap: '8px', width: '100%', alignItems: 'center' }}>
                     <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} />
                     {!isFluid && <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} />}
                 </div>
              </div>
            </div>

            {/* Location */}
            <div className={styles.fieldRow}>
              <div className={styles.iconContainer}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <input 
                type="text" 
                placeholder="Add location" 
                className={styles.inlineInput}
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
            </div>

            {/* Description / Notes */}
            <div className={styles.fieldRow} style={{ alignItems: 'flex-start' }}>
              <div className={styles.iconContainer} style={{ marginTop: '4px' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <textarea 
                className={styles.notesArea}
                placeholder="Add description or notes…" 
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Project Pill Selector (Horizontal scrollable) */}
            <div className={styles.fieldRow}>
              <div className={styles.iconContainer}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              </div>
              <div className={styles.tagCarousel}>
                <button
                  type="button"
                  className={`${styles.tagPill} ${!projectId ? styles.tagPillActive : ''}`}
                  onClick={() => setProjectId('')}
                >
                  None
                </button>
                {projects.map(p => (
                  <button
                    type="button"
                    key={p.id}
                    className={`${styles.tagPill} ${projectId === p.id ? styles.tagPillActive : ''}`}
                    onClick={() => setProjectId(p.id)}
                    style={projectId === p.id ? { 
                      borderColor: p.color, 
                      backgroundColor: `${p.color}11`,
                      color: p.color 
                    } : undefined}
                  >
                    <span className={styles.tagDot} style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
