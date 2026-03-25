'use client'

import { useState, useEffect } from 'react'
import styles from './EventModal.module.css'

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
  const [date, setDate] = useState(initialDate || new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState(initialStartTime || '09:00')
  const [endTime, setEndTime] = useState(initialEndTime || '10:00')
  const [projectId, setProjectId] = useState('')
  
  const [projects, setProjects] = useState<Project[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!eventId

  useEffect(() => {
    // Fetch available project tags
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error("Failed to fetch projects", err))
      
    // Fetch existing event payload if editing natively
    if (eventId) {
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => {
          setTitle(data.title)
          setDescription(data.description || '')
          setDate(data.startTime.slice(0, 10))
          setStartTime(data.startTime.slice(11, 16))
          setEndTime(data.endTime.slice(11, 16))
          setProjectId(data.projectId || '')
        })
        .catch(err => console.error("Failed to load focal event", err))
    } else {
      if (initialDate) setDate(initialDate)
      if (initialStartTime) setStartTime(initialStartTime)
      if (initialEndTime) setEndTime(initialEndTime)
    }
  }, [eventId, initialDate, initialStartTime, initialEndTime])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Use the specific date/time from state
    const start = new Date(`${date}T${startTime}:00`).toISOString()
    const end = new Date(`${date}T${endTime}:00`).toISOString()

    try {
      await fetch(isEditing ? `/api/events/${eventId}` : '/api/events', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          startTime: start,
          endTime: end,
          projectId: projectId || undefined
        })
      })
      
      window.location.reload()
    } catch (err) {
      console.error(err)
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!eventId || !confirm('Are you absolutely sure you want to delete this event?')) return
    setIsSubmitting(true)
    try {
      await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      window.location.reload()
    } catch (err) {
      console.error(err)
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div className={styles.modalContent} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroup}>
              <label>Event Title</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Intro to Biology Midterm" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.formGroup}>
              <label>Class / Project Tag</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}>
                <option value="">No specific class</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div className={styles.formGroup}>
              <label>Date</label>
              <input 
                type="date" 
                required 
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>

            <div className={styles.timeRow}>
              <div className={styles.formGroup}>
                <label>Start Time</label>
                <input 
                  type="time" 
                  required 
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>
              <div className={styles.formGroup}>
                <label>End Time</label>
                <input 
                  type="time" 
                  required 
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <div className={styles.modalFooter}>
            {isEditing && (
              <button 
                type="button" 
                className={`${styles.cancelBtn} ${styles.deleteBtn}`} 
                onClick={handleDelete} 
                disabled={isSubmitting}
                style={{ color: '#ef4444', marginRight: 'auto' }}
              >
                Delete Event
              </button>
            )}
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.saveBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
