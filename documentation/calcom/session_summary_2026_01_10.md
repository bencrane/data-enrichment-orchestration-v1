# Cal.com Integration Session Summary
**Date:** January 10, 2026

## Overview

Built a complete Cal.com webhook processing system that handles booking events, manages a sales pipeline, and provides an API for frontend consumption. This is a departure from the data enrichment orchestration work — this system handles inbound sales workflow automation.

---

## What Was Built

### 1. Database Schema (Supabase: `imfwppinnfbptqdyraod`)

**Tables created:**

| Table | Purpose |
|-------|---------|
| `companies` | Organizations being sold to |
| `people` | Contacts at companies (keyed by email) |
| `bookings` | Cal.com meeting records |
| `deals` | Sales opportunities (one active per company) |
| `calcom_events` | Raw webhook payload audit trail |

**Key relationships:**
- `people.company_id` → `companies.id`
- `bookings.person_id` → `people.id`
- `deals.company_id` → `companies.id`

**Deal statuses:** `active`, `won`, `lost`, `cancelled`
**Deal stages:** `booked` → `met` → `proposal` → ...

### 2. Modal Functions (`src/calcom_ingest.py`)

**Webhook endpoint:**
```
POST https://bencrane--calcom-ingest-ingest.modal.run
```

**Event handlers:**
| Event | Handler | Actions |
|-------|---------|---------|
| `BOOKING_CREATED` | `handle_booking_created` | Create person/company/booking/deal, send notification |
| `BOOKING_RESCHEDULED` | `handle_booking_rescheduled` | Update booking (uses `rescheduleUid` for lookup) |
| `BOOKING_CANCELLED` | `handle_booking_cancelled` | Update booking status, cancel deal |
| `MEETING_ENDED` | `handle_meeting_ended` | Mark attended, advance deal to `met` stage |

**Notification function:**
- `send_booking_notification` — sends emails via Resend API
- Handles: created, rescheduled, cancelled events
- From address: `team@outboundsolutions.com`

### 3. Deals API (`src/deals_api.py`)

**Base URL:** `https://bencrane--deals-api-api.modal.run`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/deals` | GET | List deals with filters |
| `/deals/{id}` | GET | Single deal with contacts & bookings |
| `/bookings` | GET | List bookings with filters |
| `/bookings/{id}` | GET | Single booking with full context (person, company, deal) |
| `/companies` | GET | List companies |
| `/people` | GET | List contacts |
| `/stats` | GET | Pipeline statistics |

**CORS enabled** for frontend consumption.

### 4. Modal Secrets Created

| Secret | Keys |
|--------|------|
| `outbound-supabase` | `OUTBOUND_POSTGRES_URL` |
| `resend-api` | `RESEND_API_KEY` |

---

## Key Technical Decisions

### Cal.com Webhook Behavior

**Critical finding:** When a booking is rescheduled, Cal.com creates a NEW booking with new `uid` and `bookingId`. The original identifiers are in `rescheduleUid` and `rescheduleId`.

```
Original booking: uid = "abc123", bookingId = 100
Rescheduled:      uid = "xyz789", bookingId = 200
                  rescheduleUid = "abc123", rescheduleId = 100
```

**Our solution:** Look up by `rescheduleUid` for rescheduled events.

### Deal Creation Logic

- **Created on:** `BOOKING_CREATED` (not `MEETING_ENDED`)
- **Rationale:** Track full funnel from booking, not just attended meetings
- **Stage progression:** `booked` → `met` (on `MEETING_ENDED`)
- **Cancellation:** Sets deal `status='cancelled'` (not `lost` — different meaning)

### Notification Architecture

Chose **spawn pattern** over event-driven/polling:
1. Handler processes webhook
2. Handler spawns `send_booking_notification`
3. Notification function sends via Resend with retry (3 attempts, exponential backoff)
4. Updates `bookings.notification_sent_at` on success

Simple, immediate, with inline retry. No separate notifications table needed.

### Forms Architecture (Planned)

Two internal forms for post-meeting workflow:
1. **Meeting Outcome Form** — `/outcome/{booking_id}` — record what happened
2. **Proposal Generation Form** — `/proposal/{booking_id}` — kick off proposal automation

Both use `booking_id` in URL. Form fetches full context via `/bookings/{id}` API.

---

## Files Created/Modified

```
src/
  calcom_ingest.py          # Webhook handler + notification logic
  deals_api.py              # REST API for deals/pipeline data

documentation/
  calcom/
    webhook_payload_reference.md   # Cal.com payload structure documentation
    session_summary_2026_01_10.md  # This file
```

---

## Sample Data

Created 5 sample companies, people, bookings, and deals for UI development:

| Company | Contact | Stage | Status |
|---------|---------|-------|--------|
| Acme Corp | Sarah Chen | booked | active |
| TechStart Inc | Mike Johnson | met | active |
| DataFlow Systems | Lisa Wong | proposal | active |
| Growth Partners | James Miller | booked | cancelled |
| Nexus Ventures | Anna Smith | booked | active |

---

## Next Steps

1. **Meeting Outcome Form** — Build UI in Next.js admin dashboard
2. **Proposal Generation Form** — Build UI in Next.js admin dashboard
3. **Form submission endpoints** — Add POST endpoints to handle form submissions
4. **Domain routing** — Add logic to route `FROM_EMAIL` based on `bookerUrl` for multi-brand support
5. **Self-hosted Cal.com** — Test with actual self-hosted instance once fixed

---

## Reference: Cal.com Webhook Events

| Event | When Fired |
|-------|------------|
| `PING` | Test/verification |
| `BOOKING_CREATED` | New booking made |
| `BOOKING_RESCHEDULED` | Booking time changed |
| `BOOKING_CANCELLED` | Booking cancelled |
| `MEETING_ENDED` | Meeting completed (requires Cal video integration) |

See `documentation/calcom/webhook_payload_reference.md` for full payload structure.

