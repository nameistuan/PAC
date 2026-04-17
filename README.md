# Juggle

A revolutionary productivity command center that seamlessly merges a robust Kanban task manager with a highly polished calendar grid. Stop switching between apps, and start seeing your time and tasks in one continuous, holistic canvas.

> **Note:** For a full breakdown of the project goals, philosophy, and UI architecture, please see [VISION.md](./VISION.md).

## What is Juggle?
Traditional productivity forces you to jump between a task board (what you need to do) and a calendar (when you need to do it). **Juggle** eliminates mode-switching by treating both Status (Kanban) and Time (Calendar) as physical spaces on a unified view. 

It is designed for professionals, students, and polymaths who are juggling multiple contexts in their life and need a single home base to rule them all.

## How to Use Juggle

Working in Juggle is designed to be frictionless and fluid:
1. **Create Projects:** Start by categorizing your life. Create color-coded "Projects" (e.g. Work, Side Hustle, Personal) using the left-hand navigation. 
2. **Brainstorm Tasks:** Add tasks on your Kanban board. Assign them to your projects, flag their priority level (Low, Medium, High, Urgent), and add start/due dates.
3. **Time-Box Your Day:** Grab a task from the "Backlog" or "To Do" column and drag it directly onto your calendar timeline (Daily, Weekly, or Monthly view). 
4. **Auto-Synthesis:** We take care of the rest. That dragged task is instantly time-boxed on your calendar and its status on the Kanban board is auto-magically updated to "In Progress". 
5. **Inline Everything:** Click on any event or task to see our gorgeous, glassy action modal. No page reloads. No friction.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router + Turbopack)
- **Language**: TypeScript
- **Styling**: Vanilla CSS (CSS Modules & Global CSS Variables for premium aesthetics)
- **Database**: PostgreSQL (Neon Serverless) with Prisma ORM
- **Deployment**: [Vercel](https://vercel.com)
- **Date Utilities**: `date-fns` & drag-and-drop temporal math.

## Live Application
Juggle is deployed and accessible in production:
- **Production URL**: [https://juggle-pm.vercel.app](https://juggle-pm.vercel.app) (Update with your actual Vercel URL)
- **Database**: Hosted on Neon (Serverless Postgres)

## Developer Setup
If you would like to run Juggle locally for development:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Generate Prisma Client & Sync DB:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Development Principles
- **Living Documents**: Always keep `VISION.md`, README, and implementation plans strictly aligned with the codebase.
- **Premium UI**: Utilizing high quality Vanilla CSS for fluid animations, gradients, and a borderless modern aesthetic.
- **Robust Data Engine**: Ensure the hybrid Task/Event database model maintains integrity.
- **Atomic Commits**: Ensure small, atomic commits for a clean repository history.
