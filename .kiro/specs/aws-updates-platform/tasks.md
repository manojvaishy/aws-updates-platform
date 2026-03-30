# AWS Updates Platform — Task List (v2)

## Phase 1: Project Setup
- [ ] 1.1 Initialize Next.js 14 frontend project with Tailwind CSS (mobile-first config)
- [ ] 1.2 Initialize backend project (Node.js/Express or FastAPI)
- [ ] analytics_events)1.3 Set up PostgreSQL database schema (users, updates, user_update_state, 
- [ ] 1.4 Set up Redis instance and connection layer
- [ ] 1.5 Configure environment variables and project structure
- [ ] 1.6 Set up basic CI/CD pipeline

## Phase 2: Authentication & User Management
- [ ] 2.1 Create User model (id, email, password_hash, role, language_preference)
- [ ] 2.2 Build register and login API endpoints (JWT + bcrypt)
- [ ] 2.3 Build role selection screen on first login
- [ ] 2.4 Build profile settings page (update role, language preference)
- [ ] 2.5 Implement auth middleware for protected routes

## Phase 3: Content Ingestion Pipeline
- [ ] 3.1 Build RSS feed poller for AWS What's New (scheduled every 6 hours via EventBridge/cron)
- [ ] 3.2 Implement duplicate detection via content hash
- [ ] 3.3 Integrate LLM simplification step (AWS Bedrock) — runs once, result stored permanently
- [ ] 3.4 Implement Layer 1 role tagger: rule-based keyword + service category mapping
- [ ] 3.5 Implement Layer 2 role tagger: AI classifier via LLM — runs once, stored
- [ ] 3.6 Merge and deduplicate role tags from both layers
- [ ] 3.7 Implement priority scorer (keyword heuristics + LLM classification for critical/high/normal)
- [ ] 3.8 Integrate Amazon Translate for Hindi and Hinglish — store all outputs permanently
- [ ] 3.9 Mark update as processed and invalidate relevant Redis caches
- [ ] 3.10 Add pipeline error handling, logging, and retry logic

## Phase 4: Caching Layer
- [ ] 4.1 Implement Redis cache wrapper utility (get/set/invalidate with TTL)
- [ ] 4.2 Cache role-based feed responses (`feed:{role}:{page}`, TTL 5 min)
- [ ] 4.3 Cache per-user dashboard (`dashboard:{user_id}`, TTL 2 min)
- [ ] 4.4 Cache unread count per user (`unread:{user_id}`, TTL 1 min)
- [ ] 4.5 Cache search results (`search:{query_hash}`, TTL 10 min)
- [ ] 4.6 Implement cache invalidation on new ingestion and read state changes

## Phase 5: Backend API — Feed & Updates
- [ ] 5.1 GET /updates — paginated feed with role filter, date filter, category filter (Redis-cached)
- [ ] 5.2 GET /updates/:id — single update detail with all language variants
- [ ] 5.3 GET /updates/priority — unread high-priority updates for current user
- [ ] 5.4 POST /updates/:id/read — mark as read, invalidate user cache
- [ ] 5.5 POST /updates/:id/unread — mark as unread, invalidate user cache
- [ ] 5.6 GET /user/state — fetch last-seen cursor and unread count (Redis-backed)
- [ ] 5.7 POST /user/state/last-seen — update last-seen position

## Phase 6: Advanced Search API
- [ ] 6.1 Set up PostgreSQL full-text search (tsvector on title + simplified_en)
- [ ] 6.2 Build search index on updates table
- [ ] 6.3 GET /search?q=&service=&from=&to=&priority= — full-text + faceted search endpoint
- [ ] 6.4 Implement relevance + recency ranking for search results
- [ ] 6.5 Integrate Redis search result caching (TTL 10 min, keyed by query hash)

## Phase 7: Analytics API
- [ ] 7.1 Create analytics_events schema (user_id, event_type, update_id, metadata, created_at)
- [ ] 7.2 POST /analytics/event — ingest user interaction events (non-blocking, async)
- [ ] 7.3 GET /analytics/popular — return most-viewed updates for current week
- [ ] 7.4 GET /admin/analytics — platform-level usage metrics (admin only)

## Phase 8: Frontend — Dashboard & Feed
- [ ] 8.1 Build mobile-first dashboard layout (bottom nav on mobile, sidebar on desktop)
- [ ] 8.2 Build update card component (title, date, category badge, priority badge, summary)
- [ ] 8.3 Build "My Feed" view (role-filtered, sorted by date)
- [ ] 8.4 Build "All Updates" view
- [ ] 8.5 Implement infinite scroll or pagination
- [ ] 8.6 Implement mark as read/unread (tap on mobile, click on desktop)
- [ ] 8.7 Implement swipe-to-mark-read gesture on mobile cards
- [ ] 8.8 Implement resume-from-last-seen scroll behavior on dashboard load
- [ ] 8.9 Build unread count badge in navigation
- [ ] 8.10 Build "Most Viewed This Week" section using analytics data

## Phase 9: Frontend — Search UI
- [ ] 9.1 Build sticky search bar in header (always accessible)
- [ ] 9.2 Build search results page with service, keyword, and date filters
- [ ] 9.3 Highlight matched keywords in search results
- [ ] 9.4 Show recent searches (stored in localStorage)

## Phase 10: Frontend — Timeline View
- [ ] 10.1 Build date-grouped timeline/table view
- [ ] 10.2 Build filter controls (date range, category, priority)

## Phase 11: Notifications & Alerts
- [ ] 11.1 Build login-time popup/bottom sheet for unread high-priority updates
- [ ] 11.2 Color-code priority: critical (red), high (orange), normal (default)
- [ ] 11.3 Build notification dismiss flow (persisted to user_update_state)

## Phase 12: Update Detail & Language Toggle
- [ ] 12.1 Build update detail page/modal (responsive: modal on desktop, full page on mobile)
- [ ] 12.2 Implement toggle between original and simplified content
- [ ] 12.3 Implement language switcher (English / Hindi / Hinglish)
- [ ] 12.4 Display translated simplified content based on user language preference

## Phase 13: Analytics Event Tracking (Frontend)
- [ ] 13.1 Fire `update_viewed` event when user opens an update
- [ ] 13.2 Fire `update_skipped` event on scroll-past (intersection observer)
- [ ] 13.3 Fire `search_performed` event on search submission
- [ ] 13.4 Fire `language_switched` event on language toggle
- [ ] 13.5 Fire `notification_dismissed` event on alert dismiss
- [ ] 13.6 Ensure all analytics calls are async and non-blocking

## Phase 14: Mobile Responsiveness Polish
- [ ] 14.1 Audit all pages at 375px, 768px, 1280px breakpoints
- [ ] 14.2 Ensure tap targets are minimum 44x44px
- [ ] 14.3 Test and fix notification popup as full-screen bottom sheet on mobile
- [ ] 14.4 Verify search, timeline, and detail views on mobile

## Phase 15: Testing
- [ ] 15.1 Unit tests for ingestion pipeline (simplification, role tagging, priority scoring)
- [ ] 15.2 Unit tests for cache invalidation logic
- [ ] 15.3 API integration tests for feed, search, and user state endpoints
- [ ] 15.4 Performance test: dashboard load under 2s, search under 500ms (cached)
- [ ] 15.5 Test RSS feed failure handling and retry logic

## Phase 16: Deployment
- [ ] 16.1 Deploy frontend to Vercel
- [ ] 16.2 Deploy backend to AWS ECS (containerized)
- [ ] 16.3 Set up RDS PostgreSQL (production)
- [ ] 16.4 Set up ElastiCache Redis (production)
- [ ] 16.5 Configure EventBridge + Lambda for pipeline scheduling
- [ ] 16.6 Set up monitoring, alerting, and error logging
- [ ] 16.7 Configure production secrets and environment variables
