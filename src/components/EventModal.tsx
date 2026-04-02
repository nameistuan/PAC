'use client'

import { useState, useEffect, useRef, startTransition, useLayoutEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import styles from './EventModal.module.css'
import { deleteEvent, updateEvent, pushCreate } from '@/lib/undoManager'
import { format } from 'date-fns'

interface Project {
  id: string;
  name: string;
  color: string;
}

type ModalType = 'event' | 'task' | 'reminder';

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
  const [modalType, setModalType] = useState<ModalType>('event')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState('once')

  // Robust parsing: if passed an ISO string, extract only what the <input> needs
  const parseInitTime = (val: string | undefined, fallback: string) => {
    if (!val) return fallback
    if (val.includes('T')) {
       // Example: 2026-03-31T07:00:00.000Z -> 07:00
       const parts = val.split('T')[1].split(':')
       return `${parts[0]}:${parts[1]}`
    }
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

  // Sync props to state for rapid drag-creation
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

  const calculatePosition = () => {
    const ax = parseFloat(searchParams.get('ax') || '0')
    const ay = parseFloat(searchParams.get('ay') || '0')
    const aw = parseFloat(searchParams.get('aw') || '0')
    const ah = parseFloat(searchParams.get('ah') || '0')
    const hasAnchor = searchParams.has('ax') && searchParams.has('ay')

    if (hasAnchor && modalRef.current) {
      const modalW = modalRef.current.offsetWidth || 440
      const modalH = modalRef.current.offsetHeight || 500
      const gap = 12
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight

      let left: number
      if (ax + aw + gap + modalW <= vw - 16) left = ax + aw + gap
      else if (ax - gap - modalW >= 16) left = ax - gap - modalW
      else left = Math.max(16, (vw - modalW) / 2)

      let top = (ay + ah / 2) - modalH / 2
      if (top + modalH > vh - 24) top = Math.max(16, vh - modalH - 24)
      if (top < 16) top = 16

      setModalPos({ top, left })
    } else {
      setModalPos(null)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    calculatePosition()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchParams])

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
  }, [searchParams, projects, title])

  useEffect(() => {
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
      .catch(err => console.error(err))
      
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => {
          const start = new Date(data.startTime)
          const end = new Date(data.endTime)
          setTitle(data.title)
          setDescription(data.description || '')
          setLocation(data.location || '')
          setStartDate(format(start, 'yyyy-MM-dd'))
          setEndDate(format(end, 'yyyy-MM-dd'))
          setStartTime(format(start, 'HH:mm'))
          setEndTime(format(end, 'HH:mm'))
          setIsFluid(data.isFluid ?? false)
          setProjectId(data.projectId || '')
        })
    }
  }, [eventId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const start = isFluid ? new Date(`${startDate}T00:00:00`) : new Date(`${startDate}T${startTime}:00`)
    const end = isFluid ? new Date(`${endDate}T23:59:59`) : new Date(`${endDate}T${endTime}:00`)

    if (!isFluid && start >= end) {
      alert("End time must be after start time.")
      setIsSubmitting(false)
      return
    }

    const startIso = start.toISOString(); const endIso = end.toISOString()

    try {
      if (isEditing && eventId) {
        await updateEvent(eventId, { title, description, location, startTime: startIso, endTime: endIso, projectId: projectId || null, isFluid })
      } else {
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, description, location, startTime: start, endTime: end, projectId: projectId || undefined, isFluid })
        })
        const created = await res.json()
        pushCreate({ 
          id: created.id, 
          title: created.title, 
          description: created.description || '',
          location: created.location || '',
          startTime: created.startTime, 
          endTime: created.endTime, 
          projectId: created.projectId || null, 
          taskId: created.taskId || null,
          isFluid: created.isFluid ?? false 
        })
      }
      onClose(); startTransition(() => router.refresh())
    } catch (err) { console.error(err); setIsSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!eventId) return
    setIsSubmitting(true)
    const success = await deleteEvent(eventId)
    if (!success) setIsSubmitting(false)
    // No need to manually close modal; AppShell now detects 'pac-event-deleted'
  }

  const [activeDropdown, setActiveDropdown] = useState<'start' | 'end' | null>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  const timeOptions = (() => {
    const opts = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hh = String(h).padStart(2, '0')
        const mm = String(m).padStart(2, '0')
        const date = new Date(); date.setHours(h, m)
        opts.push({ value: `${hh}:${mm}`, label: format(date, 'h:mm a') })
      }
    }
    return opts
  })()

  const updateDraftUrl = (pId: string, color?: string) => {
    if (!isEditing) {
      const params = new URLSearchParams(searchParams.toString())
      if (pId) {
        params.set('projectId', pId)
        if (color) params.set('pColor', color)
      } else {
        params.delete('projectId')
        params.delete('pColor')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleGlobalClick = () => setActiveDropdown(null)
    if (activeDropdown) {
      window.addEventListener('click', handleGlobalClick)
    }
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [activeDropdown])

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div 
        ref={modalRef}
        className={styles.modalContent} 
        onClick={(e) => e.stopPropagation()}
        style={{
          top: modalPos ? `${modalPos.top}px` : '50%',
          left: modalPos ? `${modalPos.left}px` : '50%',
          transform: modalPos ? 'none' : 'translate(-50%, -50%)',
          position: 'absolute'
        }}
        tabIndex={-1}
      >
        <form onSubmit={handleSubmit}>
          <div className={styles.topIconBar}>
             {isEditing && (
               <button type="button" className={styles.iconBtn} onClick={handleDelete} title="Delete">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
               </button>
             )}
             <div style={{ flex: 1 }} />
             <button type="button" className={styles.closeIconBtn} onClick={onClose}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
             </button>
          </div>

          <div className={styles.modalBody}>
            {/* Type Tabs */}
            <div className={styles.typeTabs}>
              <button type="button" className={`${styles.tabBtn} ${modalType === 'event' ? styles.tabBtnActive : ''}`} onClick={() => setModalType('event')}>Event</button>
              <button type="button" className={`${styles.tabBtn} ${modalType === 'task' ? styles.tabBtnActive : ''}`} onClick={() => setModalType('task')}>Task</button>
              <button type="button" className={`${styles.tabBtn} ${modalType === 'reminder' ? styles.tabBtnActive : ''}`} onClick={() => setModalType('reminder')}>Reminder</button>
            </div>

            <input
              autoFocus={!isEditing}
              className={styles.titleInput}
              type="text"
              required
              placeholder="Add title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              name="title"
            />

            {/* WHEN Section (Minimal & Inline Editable) */}
            <div className={styles.whenSectionMinimal}>
               <div className={styles.whenCohesiveRow}>
                 {/* Date Segment */}
                 <div className={styles.interactiveSegment} onClick={() => dateInputRef.current?.showPicker()}>
                   <div className={styles.cohesiveDate}>
                     {(() => {
                       const d = new Date(startDate + 'T12:00:00')
                       return format(d, 'EEEE, MMMM d')
                     })()}
                   </div>
                   <input 
                     ref={dateInputRef}
                     type="date" 
                     className={styles.invisibleOverlay} 
                     value={startDate} 
                     onChange={e => { 
                       const val = e.target.value
                       setStartDate(val)
                       setEndDate(val)
                     }} 
                   />
                 </div>

                 {!isFluid && (
                   <>
                     {/* Start Time Segment */}
                     <div className={styles.interactiveSegment} onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'start' ? null : 'start') }}>
                       <div className={styles.cohesiveTime}>
                         {(() => {
                           const [sh, sm] = startTime.split(':')
                           const ds = new Date(); ds.setHours(parseInt(sh), parseInt(sm))
                           return format(ds, 'h:mm a')
                         })()}
                       </div>
                       {activeDropdown === 'start' && (
                         <div className={styles.timeDropdown}>
                           {timeOptions.map(opt => (
                             <div 
                               key={opt.value} 
                               className={`${styles.timeOption} ${startTime === opt.value ? styles.timeOptionActive : ''}`}
                               onClick={() => { setStartTime(opt.value); setActiveDropdown(null) }}
                             >
                               {opt.label}
                             </div>
                           ))}
                         </div>
                       )}
                     </div>

                     <span style={{ color: '#dadce0' }}>–</span>

                     {/* End Time Segment */}
                     <div className={styles.interactiveSegment} onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'end' ? null : 'end') }}>
                       <div className={styles.cohesiveTime}>
                         {(() => {
                           const [eh, em] = endTime.split(':')
                           const de = new Date(); de.setHours(parseInt(eh), parseInt(em))
                           return format(de, 'h:mm a')
                         })()}
                       </div>
                       {activeDropdown === 'end' && (
                         <div className={styles.timeDropdown}>
                           {timeOptions.map(opt => (
                             <div 
                               key={opt.value} 
                               className={`${styles.timeOption} ${endTime === opt.value ? styles.timeOptionActive : ''}`}
                               onClick={() => { setEndTime(opt.value); setActiveDropdown(null) }}
                             >
                               {opt.label}
                             </div>
                           ))}
                         </div>
                       )}
                     </div>
                   </>
                 )}

                 <label className={styles.allDayToggleMinimal}>
                   <input type="checkbox" checked={isFluid} onChange={e => setIsFluid(e.target.checked)} />
                   All day
                 </label>
               </div>
               
               <div className={styles.recurrenceBoxMinimal}>
                 {['once', 'daily', 'weekly', 'monthly'].map(r => (
                   <button key={r} type="button" className={`${styles.pillBtnMinimal} ${recurrence === r ? styles.pillBtnMinimalActive : ''}`} onClick={() => setRecurrence(r)}>
                     {r === 'once' ? 'Does not repeat' : r.charAt(0).toUpperCase() + r.slice(1)}
                   </button>
                 ))}
               </div>
            </div>

            {/* CALENDAR Section */}
            <div className={styles.calendarSectionMinimal}>
              <div className={styles.calendarHeader}>
                <span className={styles.sectionLabelMinimal}>Calendar</span>
                <span className={styles.newLink}>+ New</span>
              </div>
              <div className={styles.tagCarousel}>
                <div 
                  className={`${styles.tagPill} ${!projectId ? styles.tagPillActive : ''}`}
                  onClick={() => { setProjectId(''); updateDraftUrl('') }}
                  style={!projectId ? { color: '#3c4043', border: '1px solid #dadce0' } : undefined}
                >
                   <div className={styles.tagDot} style={{ backgroundColor: '#dadce0' }} />
                   None
                </div>
                {projects.map(p => (
                  <div 
                    key={p.id}
                    className={`${styles.tagPill} ${projectId === p.id ? styles.tagPillActive : ''}`}
                    onClick={() => { setProjectId(p.id); updateDraftUrl(p.id, p.color) }}
                    style={projectId === p.id ? { color: p.color } : undefined}
                  >
                    <div className={styles.tagDot} style={{ backgroundColor: p.color }} />
                    {p.name}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               <div className={styles.fieldBox}>
                  <div className={styles.fieldIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <input type="text" className={styles.fieldInput} placeholder="Add location" value={location} onChange={e => setLocation(e.target.value)} />
               </div>

               <div className={styles.fieldBox}>
                  <div className={styles.fieldIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <input type="text" className={styles.fieldInput} placeholder="Add guests" />
               </div>

               <div className={styles.fieldBox}>
                  <div className={styles.fieldIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <textarea className={`${styles.fieldInput} ${styles.fieldArea}`} placeholder="Add description or notes…" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
               </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
