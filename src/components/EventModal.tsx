'use client'

import { useState, useEffect, useRef, startTransition, useLayoutEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import styles from './EventModal.module.css'
import { deleteEvent, updateEvent, pushCreate } from '@/lib/undoManager'
import { format } from 'date-fns'

// Tiptap Imports
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'

interface Project {
  id: string;
  name: string;
  color: string;
}

type ModalType = 'event' | 'task' | 'reminder';

export default function EventModal({ 
  eventId, 
  taskId,
  onClose,
  initialDate,
  initialStartTime,
  initialEndTime
}: { 
  eventId?: string, 
  taskId?: string,
  onClose: () => void,
  initialDate?: string,
  initialStartTime?: string,
  initialEndTime?: string
}) {
  // --- 1. HOOKS (STATES) ---
  const [modalType, setModalType] = useState<ModalType>(taskId ? 'task' : 'event')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState('once')

  // Unsaved changes tracking
  const initialValues = useRef<any>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasInitializedValues, setHasInitializedValues] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // ... existing parsing helpers ...
  const parseInitTime = (val: string | undefined, fallback: string) => {
    if (!val) return fallback
    if (val.includes('T')) {
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
  const isEditing = !!eventId || !!taskId
  
  const [taskStatus, setTaskStatus] = useState<'todo' | 'inprogress' | 'done'>('todo')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectColor, setNewProjectColor] = useState('#ea4335')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [modalPos, setModalPos] = useState<{ top: number; left: number } | null>(null)
  const [activeDropdown, setActiveDropdown] = useState<'start' | 'end' | null>(null)

  // --- 2. HOOKS (REFS) ---
  const modalRef = useRef<HTMLDivElement>(null)
  const colorPickerBtnRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // --- 3. HOOKS (ROUTING) ---
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // --- 4. HOOKS (TIPTAP) ---
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: description,
    onUpdate: ({ editor }) => {
      setDescription(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: `${styles.fieldInput} ${styles.tiptapEditor}`,
      },
    },
  })

  // --- 5. LOGIC HELPERS ---
  const isDirty = () => {
    if (!hasInitializedValues || !initialValues.current) return false
    const current = {
      title, description, location, startDate, endDate, startTime, endTime, isFluid, projectId, modalType
    }
    return JSON.stringify(current) !== JSON.stringify(initialValues.current)
  }

  const handleCloseAttempt = () => {
    if (isDirty()) {
      const confirmDiscard = window.confirm("You have unsaved changes. Do you want to discard them?")
      if (!confirmDiscard) return
    }
    onClose()
  }

  const updateDraftUrl = (pId: string, color?: string) => {
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

  // --- Drag and Drop Reordering ---
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null) return
    const newItems = [...projects]
    const [draggedItem] = newItems.splice(draggedIdx, 1)
    newItems.splice(targetIdx, 0, draggedItem)
    setProjects(newItems)
    setDraggedIdx(null)
    localStorage.setItem('pac-project-order', JSON.stringify(newItems.map(p => p.id)))
  }

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


  // --- 6. HOOKS (EFFECTS) ---
  
  // Initialize baseline for "Dirty" check in Creation mode
  useEffect(() => {
    if (!isEditing && !hasInitializedValues) {
      initialValues.current = {
        title: '', description: '', location: '',
        startDate: parseInitDate(initialDate),
        endDate: parseInitDate(initialDate),
        startTime: parseInitTime(initialStartTime, '09:00'),
        endTime: parseInitTime(initialEndTime, '10:00'),
        isFluid: false, projectId: '', modalType: 'event'
      }
      setHasInitializedValues(true)
    }
  }, [isEditing, initialDate, initialStartTime, initialEndTime])

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseAttempt()
    }
    window.addEventListener('keydown', handleKeyDown)
    calculatePosition()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchParams, title, description, location, startDate, endDate, startTime, endTime, isFluid, projectId, modalType, hasInitializedValues])

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
        const orderStr = localStorage.getItem('pac-project-order')
        const order = orderStr ? JSON.parse(orderStr) : []
        const mruId = localStorage.getItem('pac-mru-project')
        
        const sorted = data.sort((a: Project, b: Project) => {
          if (order.length > 0) {
            const idxA = order.indexOf(a.id); const idxB = order.indexOf(b.id)
            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
          }
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
          
          const baseline = {
            title: data.title,
            description: data.description || '',
            location: data.location || '',
            startDate: format(start, 'yyyy-MM-dd'),
            endDate: format(end, 'yyyy-MM-dd'),
            startTime: format(start, 'HH:mm'),
            endTime: format(end, 'HH:mm'),
            isFluid: data.isFluid ?? false,
            projectId: data.projectId || '',
            modalType: 'event'
          }
          
          setTitle(baseline.title)
          setDescription(baseline.description)
          setLocation(baseline.location)
          setStartDate(baseline.startDate)
          setEndDate(baseline.endDate)
          setStartTime(baseline.startTime)
          setEndTime(baseline.endTime)
          setIsFluid(baseline.isFluid)
          setProjectId(baseline.projectId)
          setModalType('event')
          
          initialValues.current = baseline
          setHasInitializedValues(true)
          
          if (editor && data.description) {
            editor.commands.setContent(data.description)
          }
        })
    } else if (taskId) {
      fetch(`/api/tasks/${taskId}`)
        .then(res => res.json())
        .then(data => {
          const baseline = {
            title: data.title,
            description: data.description || '',
            location: '',
            startDate: data.dueDate ? format(new Date(data.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            endDate: data.dueDate ? format(new Date(data.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            startTime: '09:00',
            endTime: '10:00',
            isFluid: true,
            projectId: data.projectId || '',
            modalType: 'task'
          }
          
          setTitle(baseline.title)
          setDescription(baseline.description)
          setStartDate(baseline.startDate)
          setEndDate(baseline.endDate)
          setProjectId(baseline.projectId)
          setModalType('task')
          setTaskStatus(data.status.toLowerCase() as any)
          
          initialValues.current = baseline
          setHasInitializedValues(true)
          
          if (editor && data.description) {
            editor.commands.setContent(data.description)
          }
        })
    }
  }, [eventId, taskId, editor])

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id)
      if (!isEditing) {
        updateDraftUrl(projects[0].id, projects[0].color)
      } else {
        initialValues.current = { ...initialValues.current, projectId: projects[0].id }
      }
    }
  }, [projects, projectId, isEditing])

  // Live preview for new project color
  useEffect(() => {
    if (isCreatingProject && newProjectColor) {
      updateDraftUrl(projectId || 'preview', newProjectColor)
    } else if (!isCreatingProject && projects.length > 0) {
      const active = projects.find(p => p.id === projectId)
      if (active) updateDraftUrl(active.id, active.color)
    }
  }, [newProjectColor, isCreatingProject, projectId, projects])


  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveDropdown(null)
      setShowColorPicker(false)
    }
    if (activeDropdown || showColorPicker) {
      window.addEventListener('click', handleGlobalClick)
    }
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [activeDropdown, showColorPicker])

  // --- 7. HANDLERS ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (modalType === 'task') {
        const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks'
        const method = taskId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            description,
            status: taskStatus.toUpperCase(),
            dueDate: isFluid ? new Date(`${startDate}T23:59:59`) : new Date(`${startDate}T${startTime}:00`),
            projectId: projectId || undefined
          })
        })
        if (!res.ok) throw new Error('Failed to save task')
      } else {
        const start = isFluid ? new Date(`${startDate}T00:00:00`) : new Date(`${startDate}T${startTime}:00`)
        const end = isFluid ? new Date(`${endDate}T23:59:59`) : new Date(`${endDate}T${endTime}:00`)
        if (!isFluid && start >= end) {
          alert("End time must be after start time.")
          setIsSubmitting(false)
          return
        }
        const startIso = start.toISOString(); const endIso = end.toISOString()
        
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
            id: created.id, title, description, location, startTime: created.startTime, endTime: created.endTime, 
            projectId: created.projectId || null, taskId: created.taskId || null, isFluid: created.isFluid ?? false 
          })
        }
      }
      
      window.dispatchEvent(new CustomEvent('pac-toast', { detail: isEditing ? `${modalType} updated` : `${modalType} created` }))
      if (modalType === 'task') {
        window.dispatchEvent(new CustomEvent('pac-task-updated'))
      }
      onClose(); startTransition(() => router.refresh())
    } catch (err) { console.error(err); setIsSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!isEditing) return
    setIsSubmitting(true)
    
    try {
      if (taskId) {
        const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
        if (res.ok) {
          window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Task deleted` }))
          window.dispatchEvent(new CustomEvent('pac-task-updated'))
          onClose(); startTransition(() => router.refresh())
        }
      } else if (eventId) {
        const title = await deleteEvent(eventId)
        if (title) {
           window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Deleted "${title}"` }))
           onClose(); startTransition(() => router.refresh())
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveProject = async () => {
    if (!newProjectName.trim()) return
    try {
      const isEditingProject = !!editingProjectId
      const url = isEditingProject ? `/api/projects/${editingProjectId}` : '/api/projects'
      const method = isEditingProject ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), color: newProjectColor })
      })
      if (res.ok) {
        const result = await res.json()
        if (isEditingProject) {
          setProjects(prev => prev.map(p => p.id === editingProjectId ? result : p))
        } else {
          setProjects(prev => [...prev, result].sort((a,b) => a.name.localeCompare(b.name)))
          setProjectId(result.id)
        }
        updateDraftUrl(result.id, result.color)
      }
    } catch (e) { console.error(e) } 
    finally {
      setIsCreatingProject(false); setEditingProjectId(null); setNewProjectName(''); setNewProjectColor('#ea4335'); setShowColorPicker(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!editingProjectId) return
    const confirmDelete = window.confirm("Are you sure you want to delete this calendar? ALL events and tasks associated with it will be permanently removed.")
    if (!confirmDelete) return

    try {
      const res = await fetch(`/api/projects/${editingProjectId}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== editingProjectId))
        if (projectId === editingProjectId) {
          setProjectId('')
          updateDraftUrl('')
        }
        setIsCreatingProject(false)
        setEditingProjectId(null)
      }
    } catch (e) { console.error(e) }
  }

  const handleStartEditProject = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProjectId(p.id)
    setNewProjectName(p.name)
    setNewProjectColor(p.color)
    setIsCreatingProject(true)
    setShowColorPicker(false)
  }

  const presetColors = [
    '#ea4335', '#fbbc05', '#34a853', '#4285f4', '#fa7b17', '#f06292', '#ba68c8', '#9575cd', 
    '#4db6ac', '#81c784', '#aed581', '#dce775', '#7986cb', '#4fc3f7', '#4dd0e1', '#a1887f', 
    '#1a237e', '#0d47a1', '#1b5e20', '#b71c1c'
  ]

  const timeOptions = (() => {
    const opts = []
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hh = String(h).padStart(2, '0'); const mm = String(m).padStart(2, '0')
        const date = new Date(); date.setHours(h, m)
        opts.push({ value: `${hh}:${mm}`, label: format(date, 'h:mm a') })
      }
    }
    return opts
  })()

  // --- 8. RENDER ---
  return (
    <div className={styles.modalOverlay} onClick={handleCloseAttempt}>
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
             <button type="button" className={styles.closeIconBtn} onClick={handleCloseAttempt}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
             </button>
          </div>

          <div className={styles.modalBody}>
            <input 
              type="text" 
              className={styles.titleInput} 
              placeholder="Add title" 
              autoFocus 
              value={title}
              onChange={e => setTitle(e.target.value)}
            />

            <div className={styles.typeTabs}>
              <button type="button" className={`${styles.tabBtn} ${modalType === 'event' ? styles.tabBtnActive : ''}`} onClick={() => setModalType('event')}>Event</button>
              <button type="button" className={`${styles.tabBtn} ${modalType === 'task' ? styles.tabBtnActive : ''}`} onClick={() => setModalType('task')}>Task</button>
              <button type="button" className={`${styles.tabBtn} ${modalType === 'reminder' ? styles.tabBtnActive : ''}`} onClick={() => setModalType('reminder')}>Reminder</button>
            </div>

            <div className={styles.whenSectionMinimal}>
              <div className={styles.whenCohesiveRow}>
                <div className={styles.interactiveSegment}>
                  <div className={styles.cohesiveDate}>{format(new Date(`${startDate}T12:00:00`), 'EEEE, MMMM d')}</div>
                  <input type="date" className={styles.invisibleOverlay} value={startDate} onChange={e => { setStartDate(e.target.value); setEndDate(e.target.value) }} />
                </div>
                {!isFluid && (
                  <>
                    <div className={styles.interactiveSegment}>
                      <div className={styles.cohesiveTime}>{timeOptions.find(o => o.value === startTime)?.label || startTime}</div>
                      <div className={styles.invisibleOverlay} onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'start' ? null : 'start') }} />
                      {activeDropdown === 'start' && (
                        <div className={styles.timeDropdown} onClick={e => e.stopPropagation()}>
                          {timeOptions.map(opt => (
                            <div key={opt.value} className={`${styles.timeOption} ${startTime === opt.value ? styles.timeOptionActive : ''}`} onClick={() => { setStartTime(opt.value); setActiveDropdown(null) }}>{opt.label}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span style={{ color: '#5f6368' }}>–</span>
                    <div className={styles.interactiveSegment}>
                      <div className={styles.cohesiveTime}>{timeOptions.find(o => o.value === endTime)?.label || endTime}</div>
                      <div className={styles.invisibleOverlay} onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'end' ? null : 'end') }} />
                      {activeDropdown === 'end' && (
                        <div className={styles.timeDropdown} onClick={e => e.stopPropagation()}>
                          {timeOptions.map(opt => (
                            <div key={opt.value} className={`${styles.timeOption} ${endTime === opt.value ? styles.timeOptionActive : ''}`} onClick={() => { setEndTime(opt.value); setActiveDropdown(null) }}>{opt.label}</div>
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
            </div>

            <div className={styles.calendarSectionMinimal}>
              <div className={styles.calendarHeader}>
                <span className={styles.sectionLabelMinimal}>Calendar</span>
                {!isCreatingProject && <span className={styles.newLink} onClick={() => { setIsCreatingProject(true); setShowColorPicker(true) }}>+ New</span>}
              </div>
              {isCreatingProject ? (
                <div className={styles.inlineCreateForm}>
                  <div ref={colorPickerBtnRef} className={styles.customColorBtn} style={{ backgroundColor: newProjectColor }} onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker) }} />
                  {showColorPicker && (
                    <div className={styles.customColorPopover} onClick={(e) => e.stopPropagation()}>
                       <div className={styles.colorGrid}>
                         {presetColors.map(c => (
                           <div key={c} className={`${styles.colorChip} ${newProjectColor === c ? styles.colorChipActive : ''}`} style={{ backgroundColor: c }} onClick={() => { setNewProjectColor(c); setShowColorPicker(false) }} />
                         ))}
                       </div>
                       <input type="text" className={styles.hexInput} value={newProjectColor} onChange={e => setNewProjectColor(e.target.value)} placeholder="#HEX" />
                    </div>
                  )}
                  <input type="text" className={styles.createInput} autoFocus placeholder={editingProjectId ? "Calendar name" : "New calendar name"} value={newProjectName} onClick={e => e.stopPropagation()} onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => { if(e.key==='Enter'){ e.preventDefault(); handleSaveProject() } else if(e.key==='Escape'){ setIsCreatingProject(false); setEditingProjectId(null) } }} />
                  {editingProjectId && (
                    <button type="button" className={styles.deleteProjectBtn} onClick={handleDeleteProject} title="Delete Calendar">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>
                    </button>
                  )}
                  <button type="button" className={styles.cancelCreateBtn} onClick={() => { setIsCreatingProject(false); setEditingProjectId(null); setShowColorPicker(false) }}>Cancel</button>
                  <button type="button" className={styles.createBtn} onClick={handleSaveProject}>{editingProjectId ? 'Update' : 'Save'}</button>
                </div>
              ) : (
                <div className={styles.tagCarousel}>
                  {mounted && projects.map((p, idx) => (
                    <div 
                      key={p.id} 
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(idx)}
                      className={`${styles.tagPill} ${projectId === p.id ? styles.tagPillActive : ''}`} 
                      onClick={() => { setProjectId(p.id); updateDraftUrl(p.id, p.color) }} 
                      style={projectId === p.id ? { color: p.color } : undefined}
                    >
                      <div className={styles.tagDot} style={{ backgroundColor: p.color }} />
                      {p.name}
                      {projectId === p.id && (
                        <div className={styles.editPillIcon} onClick={(e) => handleStartEditProject(p, e)}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {modalType === 'event' && (
                 <div className={styles.fieldBox}>
                    <div className={styles.fieldIcon}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
                    <input type="text" className={styles.fieldInput} placeholder="Add location" value={location} onChange={e => setLocation(e.target.value)} />
                 </div>
               )}
               {modalType === 'event' && (
                 <div className={styles.fieldBox}>
                    <div className={styles.fieldIcon}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
                    <input type="text" className={styles.fieldInput} placeholder="Add guests" />
                 </div>
               )}
               {modalType === 'task' && (
                 <div className={styles.fieldBox}>
                    <div className={styles.fieldIcon}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
                    <select className={styles.fieldSelect} value={taskStatus} onChange={e => setTaskStatus(e.target.value as any)}>
                      <option value="todo">To Do</option>
                      <option value="inprogress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                 </div>
               )}
               {modalType !== 'reminder' && (
                 <div className={styles.descriptionBox}>
                   <div className={styles.descriptionBoxInner}>
                     <div className={styles.fieldIcon}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
                     {!editor && <div className={styles.fieldInput} style={{minHeight: '80px', color: '#dadce0'}}>Loading…</div>}
                     {editor && <EditorContent editor={editor} style={{ width: '100%' }} />}
                   </div>
                   {editor && (
                     <div className={styles.markdownToolbar}>
                        <button type="button" className={`${styles.toolbarBtn} ${editor.isActive('bold') ? styles.toolbarBtnActive : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg></button>
                        <button type="button" className={`${styles.toolbarBtn} ${editor.isActive('italic') ? styles.toolbarBtnActive : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg></button>
                        <div style={{ width: '1px', background: '#e0e0e0', margin: '4px' }} />
                        <button type="button" className={`${styles.toolbarBtn} ${editor.isActive('taskList') ? styles.toolbarBtnActive : ''}`} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="9 11 12 14 22 4"/></svg></button>
                        <button type="button" className={`${styles.toolbarBtn} ${editor.isActive('bulletList') ? styles.toolbarBtnActive : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
                        <button type="button" className={`${styles.toolbarBtn} ${editor.isActive('orderedList') ? styles.toolbarBtnActive : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered List"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg></button>
                     </div>
                   )}
                 </div>
               )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.cancelBtn} onClick={handleCloseAttempt}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={isSubmitting || !title}>Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
