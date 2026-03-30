# AWS Updates Platform — High-Level Design (v2)

## Overview

A personalized web platform that aggregates AWS updates, simplifies technical content, and delivers role-based, multilingual experiences to developers and cloud professionals. This version incorporates enhanced search, caching strategy, hybrid role classification, LLM cost optimization, analytics, and mobile-first UI.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│         Next.js + Tailwind CSS (Mobile-First)               │
│  Dashboard │ Timeline │ Search │ Notifications │ Settings   │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
┌────────────────────────▼────────────────────────────────────┐
│                      BACKEND API                            │
│                  Node.js / FastAPI                          │
│  Auth │ Feed │ Search │ Personalization │ Analytics │ State │
└──────┬──────────┬──────────────┬────────────────────────────┘
       │          │              │
┌──────▼──┐  ┌────▼─────┐  ┌────▼──────────────────────────┐
│  Redis  │  │PostgreSQL│  │     Content Pipeline Worker    │
│  Cache  │  │  (main)  │  │  Ingest → Simplify → Tag →    │
│         │  │          │  │  Translate → Score → Store     │
└─────────┘  └──────────┘  └───────────────────────────────┘
                                        │
                            ┌───────────▼──────────┐
                            │   AWS What's New RSS  │
                            └──────────────────────┘
```

---

## System Components

### 1. Frontend (Next.js + Tailwind CSS)
- Mobile-first responsive design — all views optimized for phone, tablet, desktop
- Login & role selection screen
- Personalized dashboard with role-filtered, prioritized feed
- Advanced search interface (service name, keyword, date range)
- Timeline/table view grouped by date
- Mark as read/unread, resume from last seen
- Notification/popup for high-priority updates on login
- Language toggle (English, Hindi, Hinglish, regional)
- Analytics-aware interactions (read events, clicks tracked silently)

### 2. Backend API (Node.js / FastAPI)
- Auth service — register, login, JWT session management
- Feed service — serves enriched updates with role filtering and pagination
- Search service — full-text + faceted search (service, keyword, date)
- Personalization service — hybrid role classification scoring
- Notification service — priority alert delivery on login
- User state service — read/unread tracking, last-seen cursor
- Analytics service — event ingestion and aggregation
- Cache layer — Redis-backed response caching for feeds and dashboards

### 3. Data Layer

#### PostgreSQL (persistent store)
- `users` — profile, role, language preference
- `updates` — raw + simplified + translated content, role tags, priority
- `user_update_state` — per-user read/unread, last-seen
- `analytics_events` — user interaction events (read, skip, click, dwell time)

#### Redis (cache + ephemeral)
- Cached feed responses per role (TTL: 5 min)
- Cached personalized dashboard per user (TTL: 2 min)
- Unread count per user (invalidated on state change)
- Search result cache for common queries (TTL: 10 min)
- Session tokens

### 4. Content Ingestion Pipeline

```
AWS RSS Feed (scheduled poll — every 6 hours)
        ↓
Duplicate check (hash of source URL + published date)
        ↓
Raw update stored
        ↓
Simplification Engine (LLM — runs ONCE, result stored permanently)
        ↓
Role Tagger (Hybrid: rule-based + AI classifier)
        ↓
Priority Scorer (keyword heuristics + LLM classification)
        ↓
Translation Engine (Amazon Translate — per language, stored)
        ↓
Enriched update marked ready, cache invalidated
```

**LLM Cost Optimization:**
- Simplification and priority classification run exactly once per update at ingestion time
- Results stored in DB — never re-called for the same update
- Translation outputs cached per language in DB
- LLM is never called at request time — only during pipeline processing

### 5. Hybrid Role Classification

Two-layer approach for accurate role tagging:

```
Layer 1 — Rule-Based (fast, deterministic)
  - Keyword lists per role (e.g., "Lambda", "API Gateway" → Developer)
  - AWS service category mappings
  - Regex patterns for known service names

Layer 2 — AI Classifier (accuracy boost)
  - LLM prompt: "Which of these roles would care about this update: 
    Solution Architect, Developer, DevOps, Data Engineer? List all that apply."
  - Runs once at ingestion, result stored as role_tags[]
  - Overrides or supplements rule-based tags

Final tag = union of both layers, deduplicated
```

### 6. Advanced Search

```
Search Query
     ↓
Parse intent: service name | keyword | date range | combination
     ↓
Check Redis search cache (TTL 10 min)
     ↓ (cache miss)
PostgreSQL full-text search (tsvector on title + simplified_content)
  + filter by: date range, category, priority, role
     ↓
Results ranked by relevance score + recency
     ↓
Cache result, return to client
```

Supported search patterns:
- `EC2` → service name match
- `cost optimization` → keyword in simplified content
- `2025-03` → date-scoped results
- `EC2 deprecation` → combined service + keyword

### 7. Analytics System

Events tracked (client-side, sent to analytics API):
- `update_viewed` — user opened/read an update
- `update_skipped` — scrolled past without opening
- `update_marked_read` — explicit read action
- `search_performed` — query + result count
- `language_switched` — language toggle used
- `notification_dismissed` — high-priority alert dismissed

Aggregations stored and used for:
- "Most viewed this week" section on dashboard
- Improving role-tag relevance over time
- Identifying updates users consistently skip (low relevance signal)
- Admin dashboard for platform health metrics

### 8. Notification System
- On login: query unread high-priority updates for user's role → show popup
- Badge count on nav (served from Redis cache)
- Visual distinction: critical (red), high (orange), normal (default)
- Dismiss stores acknowledgment in `user_update_state`

---

## Data Models

### users
```
id, email, password_hash, name, role, language_preference, created_at, updated_at
```

### updates
```
id, title, raw_content, simplified_en, simplified_hi, simplified_hinglish,
source_url, published_at, category, service_tags[], role_tags[],
priority (critical|high|normal), processed_at, content_hash
```

### user_update_state
```
user_id, update_id, is_read, read_at, last_seen (bool), acknowledged_at
```

### analytics_events
```
id, user_id, event_type, update_id, metadata (jsonb), created_at
```

---

## Caching Strategy

| Data                        | Cache Key Pattern              | TTL     | Invalidation Trigger         |
|-----------------------------|-------------------------------|---------|------------------------------|
| Role feed (paginated)       | `feed:{role}:{page}`          | 5 min   | New update ingested          |
| User dashboard              | `dashboard:{user_id}`         | 2 min   | Read state change            |
| Unread count                | `unread:{user_id}`            | 1 min   | Mark read/unread             |
| Search results              | `search:{query_hash}`         | 10 min  | New update ingested          |
| High-priority alerts        | `alerts:{user_id}`            | 5 min   | Alert acknowledged           |

---

## Role → Content Mapping

| Role                | Prioritized Services / Categories                        |
|---------------------|----------------------------------------------------------|
| Solution Architect  | Architecture, Pricing, New Services, Limits, Well-Arch  |
| Developer           | SDKs, APIs, Lambda, Compute, Storage, AppSync           |
| DevOps Engineer     | CI/CD, ECS, EKS, CloudFormation, CloudWatch, Systems Mgr|
| Data Engineer       | Glue, Redshift, S3, Athena, Kinesis, EMR, Lake Formation|

---

## Simplification + Localization Flow

```
Raw AWS Announcement
      ↓
LLM: "Explain this AWS update in simple English. What changed, 
      why it matters, and what should a developer do about it?"
      ↓
Simplified English (stored permanently)
      ↓
Amazon Translate → Hindi (stored permanently)
      ↓
LLM or rule-based → Hinglish blend (stored permanently)
      ↓
Served from DB — no LLM calls at request time
```

---

## Mobile-First UI Principles

- Tailwind CSS responsive breakpoints: mobile base, tablet `md:`, desktop `lg:`
- Update cards stack vertically on mobile, grid on desktop
- Bottom navigation bar on mobile (Dashboard, Search, Timeline, Profile)
- Swipe gestures for mark-as-read on mobile cards
- Notification popup adapts to full-screen sheet on mobile
- Search bar always accessible via sticky header
- Font sizes, tap targets, and spacing follow mobile accessibility guidelines

---

## Tech Stack Summary

| Layer            | Technology                              |
|------------------|-----------------------------------------|
| Frontend         | Next.js 14, Tailwind CSS                |
| Backend          | Node.js (Express) or FastAPI (Python)   |
| Database         | PostgreSQL (RDS)                        |
| Cache            | Redis (ElastiCache)                     |
| Search           | PostgreSQL full-text (tsvector/tsquery) |
| LLM              | AWS Bedrock (Claude / Titan)            |
| Translation      | Amazon Translate                        |
| Analytics        | Custom event store (PostgreSQL JSONB)   |
| Auth             | JWT + bcrypt                            |
| Hosting          | Vercel (frontend), AWS ECS (backend)    |
| Feed Source      | AWS What's New RSS Feed                 |
| Scheduling       | AWS EventBridge + Lambda (pipeline)     |
