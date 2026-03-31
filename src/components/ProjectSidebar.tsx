'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './ProjectSidebar.module.css'

interface Project {
  id: string
  name: string
  color: string
}

const PRESET_COLORS = [
  '#312E81', '#4f46e5', '#7c3aed', '#8F6B91',
  '#db2777', '#ea4335', '#ea8c00', '#10b981',
  '#0ea5e9', '#64748b',
]

export default function ProjectSidebar({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const router = useRouter()
  const editInputRef = useRef<HTMLInputElement>(null)
  const newInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus()
  }, [editingId])

  useEffect(() => {
    if (isCreating && newInputRef.current) newInputRef.current.focus()
  }, [isCreating])

  const startEdit = (p: Project) => {
    setEditingId(p.id)
    setEditName(p.name)
    setEditColor(p.color)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditColor('')
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    try {
      const res = await fetch(`/api/projects/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      })
      if (res.ok) {
        const updated = await res.json()
        setProjects(prev => prev.map(p => p.id === editingId ? updated : p))
        cancelEdit()
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to update project', err)
    }
  }

  const deleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id)
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id))
        if (editingId === id) cancelEdit()
        if (project) {
          window.dispatchEvent(new CustomEvent('pac-toast', { detail: `Deleted "${project.name}"` }))
        }
        router.refresh()
      }
    } catch (err) {
      console.error('Failed to delete project', err)
    }
  }

  const createProject = async () => {
    if (!newName.trim()) return
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      if (res.ok) {
        const created = await res.json()
        setProjects(prev => [...prev, created])
        setIsCreating(false)
        setNewName('')
        setNewColor(PRESET_COLORS[0])
      }
    } catch (err) {
      console.error('Failed to create project', err)
    }
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Projects</h3>
      <ul className={styles.list}>
        {projects.map(p => (
          <li key={p.id} className={styles.item}>
            {editingId === p.id ? (
              <div className={styles.editForm}>
                <input
                  ref={editInputRef}
                  className={styles.editInput}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                <div className={styles.colorGrid}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      className={`${styles.colorSwatch} ${editColor === c ? styles.colorSwatchActive : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setEditColor(c)}
                      type="button"
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className={styles.editActions}>
                  <button className={styles.saveBtn} onClick={saveEdit}>Save</button>
                  <button className={styles.cancelBtn} onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className={styles.projectRow}>
                <span className={styles.dot} style={{ backgroundColor: p.color }} />
                <span className={styles.name}>{p.name}</span>
                <div className={styles.rowActions}>
                  <button
                    className={styles.actionBtn}
                    onClick={() => startEdit(p)}
                    aria-label="Edit project"
                    title="Edit"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className={`${styles.actionBtn} ${styles.deleteBtn}`}
                    onClick={() => deleteProject(p.id)}
                    aria-label="Delete project"
                    title="Delete"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {isCreating ? (
        <div className={styles.editForm} style={{ marginTop: '0.5rem' }}>
          <input
            ref={newInputRef}
            className={styles.editInput}
            placeholder="Project name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') createProject()
              if (e.key === 'Escape') { setIsCreating(false); setNewName('') }
            }}
          />
          <div className={styles.colorGrid}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                className={`${styles.colorSwatch} ${newColor === c ? styles.colorSwatchActive : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewColor(c)}
                type="button"
                aria-label={c}
              />
            ))}
          </div>
          <div className={styles.editActions}>
            <button className={styles.saveBtn} onClick={createProject}>Add</button>
            <button className={styles.cancelBtn} onClick={() => { setIsCreating(false); setNewName('') }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className={styles.addProjectBtn} onClick={() => setIsCreating(true)}>
          + Add project
        </button>
      )}
    </div>
  )
}
