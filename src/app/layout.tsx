import type { Metadata } from 'next'
import './globals.css'
import styles from './layout.module.css'

export const metadata: Metadata = {
  title: 'PAC | Personalized Assisted Calendar',
  description: 'Project management and calendar application with AI integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={styles.appContainer}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2>PAC.</h2>
          </div>
          <nav className={styles.sidebarNav}>
            <div className={styles.navSection}>
              <h3>Project Boards</h3>
              <ul className={styles.projectList}>
                <li>
                  <span className={styles.projectDot} style={{backgroundColor: 'var(--primary-color)'}}></span> 
                  General
                </li>
                <li>
                  <span className={styles.projectDot} style={{backgroundColor: 'var(--secondary-color)'}}></span> 
                  Engineering
                </li>
              </ul>
            </div>
          </nav>
        </aside>

        {/* Main Application Area */}
        <div className={styles.mainContent}>
          <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
              <div className={styles.dateSelector}>March 2026</div>
              
              <div className={styles.viewToggle}>
                <button className={`${styles.toggleBtn} ${styles.active}`}>Month</button>
                <button className={styles.toggleBtn}>Week</button>
                <button className={styles.toggleBtn}>Day</button>
              </div>
            </div>
            <button className={styles.addButton}>+ New Event</button>
          </header>
          
          <div className={styles.pageContent}>
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
