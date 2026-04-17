# Juggle Future Plans

A roadmap of features, improvements, and architectural goals for the Juggle app.

---

## 🟢 Recently Accomplished (Current State)
- [x] **Unified Identity System**: Seamless API synchronization where updating an event auto-updates its associated parent task, and vice-versa. Clicking an event linked to a task correctly opens the Task configurations.
- [x] **Glassy UI Components**: Complete UI overhaul utilizing semi-transparent status chips, color-coded priority pills, and project labels for a significantly more modern, seamless, and "glassy" app experience.
- [x] **Temporal Kanban Sync**: Dragging a task strictly onto a calendar view automatically places it on your chronological timeline while independently firing off an API call to upgrade its status to `IN_PROGRESS` on the physical Kanban board. 
- [x] **Month Grid Stability**: Eliminated CSS `1fr` auto-sizing bugs so events successfully text-truncate without disrupting the grid sizing geometry.
- [x] **Relational Cloud Migration**: Migrated from local SQLite to **Neon (PostgreSQL)**. Configured Prisma for serverless edge environments and successfully deployed the core engine to **Vercel** with optimized Turbopack builds.

---

## 🚀 High Priority (Soon)

### 🔐 Multi-User Support & Security
- [ ] **Authentication Engine**: Implement `NextAuth.js` (Auth.js) to support Google and GitHub OAuth providers.
- [ ] **Data Isolation (Multi-Tenant)**: Update Prisma schema to include a `User` model. Migrating existing `Project`, `Task`, and `Event` relations to include a `userId` field to ensure private user data.
- [ ] **Personalized Workspaces**: Allow users to save their unique sidebar project configurations and UI preferences (e.g., collapsed states).
- [ ] **Secure API Middleware**: Implement server-side session checks to prevent cross-user data access (IDOR protection).

### 🎨 User Experience Enhancements
- [ ] **Empathetic Onboarding**: When a user has zero data, show a welcoming overlay or empty state card: *"What are you juggling right now?"*
- [ ] **Interactive Tutorial**: Subtle pulse animations to guide the user towards the `+ New Event` or drag-and-drop mechanics.
- [ ] **Overdue Highlights**: Visually flag tasks whose `dueDate` has passed.
- [ ] **Subtask Progress**: Show a progress indicator (e.g., "2/5 items") on the card based on Tiptap checklist items.
- [ ] **Column Density**: Support for "compact" vs "comfortable" Kanban card views.

### ⚡ Efficiency & Shortcuts
- [ ] **Event Duplication**: Support for `Ctrl+C` / `Ctrl+V` (or `Cmd+C/V`) to quickly clone events or tasks.
- [ ] **Quick Creation**: `Shift + N` to open the creation modal from anywhere.
- [ ] **Multi-Select**: Enable `Shift + Click and Drag` to highlight and select multiple events/tasks at once for bulk movement or editing.

---

## 🛠 Stability & DX
- [ ] **Optimistic Sync**: Even more robust handling of offline/slow connections for drag-and-drop.

---

## 💡 Ideas & Research
- [ ] **AI Prioritization**: Suggest which tasks to "Juggle" onto today's calendar based on deadlines.
- [ ] **Mobile App**: PWA or React Native companion for quick task entry.
