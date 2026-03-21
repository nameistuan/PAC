'use client'

import { useState, useEffect } from 'react'
import styles from './EventModal.module.css'

interface Project {
  id: string;
  name: string;
  color: string;
}

export default function EventModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [projectId, setProjectId] = useState('')
  
  const [projects, setProjects] = useState<Project[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Fetch available project tags
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data))
      .catch(err => console.error("Failed to fetch projects", err))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // For MVP phase, events default to 1-hour blocks at 9 AM
    const start = new Date(`${date}T09:00:00`).toISOString()
    const end = new Date(`${date}T10:00:00`).toISOString()

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          startTime: start,
          endTime: end,
          projectId: projectId || undefined
        })
      })
      
      // Successfully saved! Let window reload to hit the DB on the server components again
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
          <h2 className={styles.modalTitle}>New Event</h2>
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
          </div>
          
          <div className={styles.modalFooter}>
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
