# Juggle Future Plans

A roadmap of features, improvements, and architectural goals for the Juggle app.

---

## 🟢 Recently Accomplished (Current State)
- [x] **Unified Identity System**: Seamless API synchronization where updating an event auto-updates its associated parent task, and vice-versa. Clicking an event linked to a task correctly opens the Task configurations.
- [x] **Glassy UI Components**: Complete UI overhaul utilizing semi-transparent status chips, color-coded priority pills, and project labels for a significantly more modern, seamless, and "glassy" app experience.
- [x] **Temporal Kanban Sync**: Dragging a task strictly onto a calendar view automatically places it on your chronological timeline while independently firing off an API call to upgrade its status to `IN_PROGRESS` on the physical Kanban board. 
- [x] **Month Grid Stability**: Eliminated CSS `1fr` auto-sizing bugs so events successfully text-truncate without disrupting the grid sizing geometry.

---

## 🚀 High Priority (Soon)

### User Onboarding & First Run
- [ ] **Empathetic Onboarding**: When a user has zero data, show a welcoming overlay or empty state card: *"What are you juggling right now?"*
- [ ] **Interactive Tutorial**: Subtle pulse animations to guide the user towards the `+ New Event` or drag-and-drop mechanics.

### Kanban Enhancements
- [ ] **Overdue Highlights**: Visually flag tasks whose `dueDate` has passed.
- [ ] **Subtask Progress**: Show a progress indicator (e.g., "2/5 items") on the card based on Tiptap checklist items.
- [ ] **Column Density**: Support for "compact" vs "comfortable" Kanban card views.

## ⚡ Efficiency & Shortcuts
- [ ] **Event Duplication**: Support for `Ctrl+C` / `Ctrl+V` (or `Cmd+C/V`) to quickly clone events or tasks on the calendar/kanban board.
- [ ] **Quick Creation**: `Shift + N` to open the creation modal from anywhere.

---

## 🛠 Stability & DX
- [ ] **Full PostgreSQL Migration**: The next step towards hosting is switching standard SQLite data paradigms out for persistent relational models (Postgres via Prisma) to support seamless horizontal deployments.
- [ ] **Optimistic Sync**: Even more robust handling of offline/slow connections for drag-and-drop.
- [ ] **Authentication**: Add JWT/NextAuth providers (Google, GitHub) for individual accounts and user routing.

---

## 💡 Ideas & Research
- [ ] **AI Prioritization**: Suggest which tasks to "Juggle" onto today's calendar based on deadlines.
- [ ] **Mobile App**: PWA or React Native companion for quick task entry.
