# AWS Updates Platform — Requirements (v2)

## Functional Requirements

### 1. Authentication & Role Selection
- FR-1.1: Users must be able to register and log in with email/password
- FR-1.2: On first login, users must select their role (Solution Architect, Developer, DevOps Engineer, Data Engineer)
- FR-1.3: Users can update their role and language preference from profile settings
- FR-1.4: Sessions must persist across page refreshes (JWT-based)

### 2. Personalized Dashboard
- FR-2.1: Dashboard must display AWS updates filtered and prioritized by the user's role
- FR-2.2: Updates must be sorted by date (newest first by default)
- FR-2.3: Each update card must show: title, date, category, priority badge, and simplified summary
- FR-2.4: Users must be able to switch between "My Feed" (role-filtered) and "All Updates" views
- FR-2.5: Dashboard must show a "Most Viewed This Week" section powered by analytics data

### 3. Update Tracking
- FR-3.1: Users must be able to mark individual updates as read or unread
- FR-3.2: The platform must track the user's last-seen position in the feed
- FR-3.3: On returning to the dashboard, the feed must scroll to or highlight the last-seen update
- FR-3.4: Unread count must be visible as a badge in the navigation

### 4. Advanced Search
- FR-4.1: Users must be able to search updates by AWS service name (e.g., EC2, S3, Lambda)
- FR-4.2: Users must be able to search by keyword across titles and simplified summaries
- FR-4.3: Users must be able to filter search results by date range, category, and priority
- FR-4.4: Search results must be ranked by relevance and recency
- FR-4.5: Common search queries must be cached for faster repeated lookups

### 5. Timeline & Navigation
- FR-5.1: Updates must be browsable via a date-based timeline or grouped table view
- FR-5.2: Users must be able to navigate updates day by day

### 6. Notifications & High-Priority Alerts
- FR-6.1: On login, users must see a popup for any unread high-priority updates relevant to their role
- FR-6.2: Critical updates (deprecations, breaking changes) must be visually distinguished with color coding
- FR-6.3: Users must be able to dismiss notifications; dismissal must be persisted

### 7. Content Simplification (LLM Cost Optimized)
- FR-7.1: Every AWS update must have a plain-English simplified summary generated via LLM
- FR-7.2: LLM simplification must run exactly once per update at ingestion time; results stored permanently
- FR-7.3: LLM must never be called at request time — only during pipeline processing
- FR-7.4: Users must be able to toggle between the original announcement and the simplified version

### 8. Multilingual Support
- FR-8.1: Users must be able to select their preferred language (English, Hindi, Hinglish)
- FR-8.2: Simplified content must be translated after simplification (not raw technical content)
- FR-8.3: All translation outputs must be stored permanently and reused — no repeated translation calls
- FR-8.4: Language preference must be saved to the user profile

### 9. Hybrid Role Classification
- FR-9.1: Each update must be tagged with all relevant roles at ingestion time
- FR-9.2: Role tagging must use a two-layer approach: rule-based keyword matching + AI classifier
- FR-9.3: AI classifier must run once at ingestion and results stored — not re-run at query time
- FR-9.4: Role tags must be used to filter the personalized feed

### 10. Caching
- FR-10.1: Role-based feed responses must be cached in Redis (TTL: 5 minutes)
- FR-10.2: Per-user dashboard state must be cached (TTL: 2 minutes)
- FR-10.3: Search results must be cached for repeated identical queries (TTL: 10 minutes)
- FR-10.4: Cache must be invalidated when new updates are ingested or read state changes

### 11. Analytics
- FR-11.1: The platform must track: update viewed, update skipped, mark as read, search performed, language switched, notification dismissed
- FR-11.2: Analytics data must feed into the "Most Viewed" dashboard section
- FR-11.3: Analytics must be collected silently without impacting user experience
- FR-11.4: An admin view must show platform-level usage metrics

### 12. Content Ingestion Pipeline
- FR-12.1: The system must poll the AWS What's New RSS feed every 6 hours
- FR-12.2: Duplicate updates must be detected via content hash and skipped
- FR-12.3: Each update must go through: simplification → role tagging → priority scoring → translation → storage
- FR-12.4: Pipeline failures must be logged and retried without crashing the system

---

## Non-Functional Requirements

- NFR-1: Dashboard must load within 2 seconds for up to 1000 concurrent users (aided by Redis caching)
- NFR-2: LLM simplification must complete within 5 seconds per update (pipeline only, not request time)
- NFR-3: The platform must be fully responsive and usable on mobile devices (mobile-first design)
- NFR-4: All user data must be stored securely; passwords must be hashed with bcrypt
- NFR-5: The system must handle RSS feed failures gracefully with retry logic
- NFR-6: Read state must sync across devices for the same user account
- NFR-7: Search must return results within 500ms for cached queries, 1.5s for uncached
- NFR-8: Analytics event ingestion must be non-blocking and must not slow down API responses
