# Juggle

**The unified command center for your time and tasks.**

Juggle is a premium productivity platform that eliminates the conceptual gap between "what you need to do" (Tasks) and "when you're going to do it" (Calendar). By merging a powerful Kanban board with a fluid, multi-view calendar, Juggle provides a holistic canvas for high-performers to manage their lives in one place.

## 🚀 Live Application
- **URL**: [https://juggle-alpha.vercel.app](https://juggle-alpha.vercel.app)
- **Status**: Production-ready, Personal/Multi-user enabled.

## ✨ Core Features

### 1. The Unified Canvas
- **Hybrid Data Engine**: Every task can become an event, and every event tracks back to a project.
- **Fluid Time-Boxing**: Drag any task from the Kanban board directly onto the Calendar to instantly schedule it. Tasks automatically update to "In Progress" when hit the timeline.

### 2. Multi-User Intelligence
- **Google OAuth**: One-click secure login via Auth.js (NextAuth v5).
- **Absolute Data Isolation**: Users see only their own projects, tasks, and events. 
- **Security-First API**: Every backend route (GET/PUT/DELETE) is protected by IDOR-safe checks against the user session.

### 3. Professional Calendar Suite
- **Interactive Views**: Switch between Day, Week, and Month views with zero friction.
- **Smart Layout Engine**: Overlapping events automatically cluster and indent for perfect readability.
- **Timezone Correction**: Intelligent client-side rendering ensures your calendar looks correct in your local time, regardless of the server's location.

### 4. Kanban Methodology
- **Project-Centric**: Organize everything into color-coded projects.
- **Priority Scaling**: Assign Low, Medium, High, or Urgent priorities to focus on what matters.
- **Full Sync**: Dragging tasks between status columns (To Do, In Progress, Done) is reflected across the entire app instantly.

## 🛠 Tech Stack
- **Framework**: Next.js 15+ (App Router, Turbopack)
- **Authentication**: Auth.js (v5 Beta) + Google OAuth
- **Database**: PostgreSQL (Neon Serverless)
- **ORM**: Prisma 7
- **Styling**: Vanilla CSS (Premium Glassmorphism & Dark Mode)
- **Deployment**: Vercel

## 📖 Development Status

| Module | Status | Details |
| :--- | :--- | :--- |
| **Auth** | ✅ Complete | Google Login + JWT Session Strategy |
| **Database** | ✅ Complete | Multi-tenant schema with User relations |
| **Kanban** | ✅ Complete | Drag & Drop + Project Filtering |
| **Calendar** | ✅ Complete | Overlap Detection + Timezone safety |
| **Security** | ✅ Complete | Scoped API tokens + Route Protection |

## 🛠 Setup & Deployment

1. **Install**: `npm install`
2. **Environment**: Set up `.env` with `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`.
3. **Database**: `npx prisma db push`
4. **Run**: `npm run dev`

---
*Juggle is designed for pros, polymaths, and anyone jumping between too many tabs. Stop switching. Start juggling.*
