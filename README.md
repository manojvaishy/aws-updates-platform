# AWS Updates Platform

Personalized AWS updates — simplified, translated, and role-filtered.

## 🚀 Live Demo

- **Frontend:** https://aws-updates-platform-y1dr.vercel.app
- **Backend API:** https://aws-updates-platform.onrender.com/health

## What it does

- Fetches real AWS announcements from the official RSS feed every 6 hours
- Filters updates by your role (Developer, DevOps, Solution Architect, Data Engineer)
- Search across all AWS updates
- Timeline view grouped by date
- Multi-language support (English, Hindi, Hinglish)

## Project Structure

```
aws-updates-platform/
├── frontend/          Next.js 14 + Tailwind CSS (mobile-first)
├── backend/           Node.js + Express + TypeScript
└── .kiro/specs/       Design, requirements, and task specs
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### Backend

```bash
cd backend
cp .env.example .env        # fill in your DB and Redis URLs
npm install
npm run db:migrate          # apply schema
npm run db:seed             # optional dev data
npm run dev                 # starts on http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                 # starts on http://localhost:3000
```

### Health Check

```
GET http://localhost:4000/health
```

Returns `{ status: "ok", services: { postgres: true, redis: true } }`

## Environment Variables

| File                        | Purpose                        |
|-----------------------------|--------------------------------|
| `backend/.env`              | DB, Redis, JWT, AWS keys       |
| `frontend/.env.local`       | API URL, app name              |

See `backend/.env.example` and `frontend/.env.local.example` for all variables.
