# Cal.com Webhook Payload Reference

## Event Identification

The event type is identified by the top-level `triggerEvent` field:

```json
{
  "triggerEvent": "BOOKING_CREATED",
  "createdAt": "2026-01-10T23:40:58.020Z",
  "payload": { ... }
}
```

### Known Event Types
- `PING` — Test/verification webhook
- `BOOKING_CREATED` — New booking made
- `BOOKING_CANCELLED` — Booking cancelled
- `BOOKING_RESCHEDULED` — Booking time changed
- `MEETING_ENDED` — Meeting completed (requires Cal.com integration)

---

## BOOKING_CREATED Payload Structure

### Top Level
| Field | Type | Description |
|-------|------|-------------|
| `triggerEvent` | string | Event type identifier |
| `createdAt` | ISO timestamp | When event was fired |
| `payload` | object | The booking details |

### payload.* (Booking Details)

#### Identifiers
| Field | Example | Notes |
|-------|---------|-------|
| `uid` | `qGDMWyZkfkjt3yhcpQGxh8` | Cal.com's unique booking ID (use this as primary key) |
| `bookingId` | `14475160` | Cal.com internal numeric ID |
| `iCalUID` | `qGDMWyZkfkjt3yhcpQGxh8@Cal.com` | iCal format UID |
| `eventTypeId` | `3863864` | Which calendar event type was booked |

#### Timing
| Field | Example | Notes |
|-------|---------|-------|
| `startTime` | `2026-01-11T02:30:00Z` | UTC |
| `endTime` | `2026-01-11T03:00:00Z` | UTC |
| `length` | `30` | Duration in minutes |

#### Event Type Info
| Field | Example | Notes |
|-------|---------|-------|
| `type` | `30min` | Event type slug |
| `title` | `30 Min Meeting between X and Y` | Generated title |
| `eventTitle` | `30 Min Meeting` | Event type name |
| `status` | `ACCEPTED` | Booking status |

#### Organizer (Cal.com account owner)
```json
"organizer": {
  "id": 1905657,
  "name": "Substrate - BC",
  "email": "tools@substrate.build",
  "username": "benjamin-crane-hq",
  "timeZone": "America/New_York",
  "language": { "locale": "en" },
  "timeFormat": "h:mma",
  "utcOffset": -300
}
```

#### Attendees (people who booked)
```json
"attendees": [
  {
    "email": "benjaminjcrane@gmail.com",
    "name": "Substrate - BC",
    "firstName": "",
    "lastName": "",
    "timeZone": "America/New_York",
    "language": { "locale": "en" },
    "utcOffset": -300
  }
]
```

**Note:** `firstName` and `lastName` are often empty. Use `name` as primary.

#### Responses (Form Fields)
These are the answers to booking form questions:

```json
"responses": {
  "name": {
    "label": "your_name",
    "value": "Substrate - BC",
    "isHidden": false
  },
  "email": {
    "label": "email_address",
    "value": "benjaminjcrane@gmail.com",
    "isHidden": false
  },
  "attendeePhoneNumber": {
    "label": "phone_number",
    "isHidden": true
  },
  "location": {
    "label": "location",
    "value": {
      "optionValue": "",
      "value": "integrations:daily"
    },
    "isHidden": false
  },
  "notes": {
    "label": "additional_notes",
    "isHidden": false
  },
  "guests": {
    "label": "additional_guests",
    "value": [],
    "isHidden": false
  }
}
```

**TODO:** Add custom fields for `company` and `domain` in Cal.com booking form to capture company info.

#### Location & Video
| Field | Example | Notes |
|-------|---------|-------|
| `location` | `integrations:daily` | Location type |
| `videoCallData.type` | `daily_video` | Video provider |
| `videoCallData.url` | `https://meetco.daily.co/XqAIvG6DO8tFx2agohHv` | Meeting link |
| `metadata.videoCallUrl` | `https://app.cal.com/video/...` | Cal.com video link |

---

## Data Extraction Logic

### Person (from attendees[0])
- `email` → `people.email` (unique key)
- `name` → `people.name`
- `firstName` → `people.first_name` (often empty)
- `lastName` → `people.last_name` (often empty)

### Company (requires custom booking fields OR email domain)
Current fallback logic:
1. Check `responses` for keys containing "company" or "domain"
2. If not found, extract domain from email
3. Skip personal domains (gmail, yahoo, etc.)

**Action needed:** Configure Cal.com event types to include company name/domain fields.

### Booking
- `uid` → `bookings.calcom_uid` (unique key)
- `bookingId` → `bookings.calcom_booking_id`
- `title` → `bookings.title`
- `type` → `bookings.event_type`
- `startTime` → `bookings.start_time`
- `endTime` → `bookings.end_time`
- `location` → `bookings.location`
- `videoCallData.url` → `bookings.video_url`
- `status` → `bookings.status`
- Full inner payload → `bookings.raw_payload`

---

## TODO / Open Items

1. **Custom booking fields** — Add company name/domain fields to Cal.com event types
2. **MEETING_ENDED handling** — Verify Cal.com sends this event (may require specific integration)
3. ~~**Rescheduled payload** — Capture a real BOOKING_RESCHEDULED event to verify structure~~ DONE
4. **Cancelled payload** — Capture a real BOOKING_CANCELLED event to verify structure
5. **Multiple attendees** — Current logic only handles first attendee; decide if multi-attendee support needed

---

## CRITICAL: Reschedule ID Behavior

**When a booking is rescheduled, Cal.com creates a NEW booking record.**

| Field | Original Booking | Rescheduled Booking |
|-------|------------------|---------------------|
| `uid` | `qGDMWyZkfkjt3yhcpQGxh8` | `vjNc4gM4wXMzZvz2MoSLXA` ← **NEW** |
| `bookingId` | `14475160` | `14475447` ← **NEW** |
| `iCalUID` | `qGDMWyZkfkjt3yhcpQGxh8@Cal.com` | `qGDMWyZkfkjt3yhcpQGxh8@Cal.com` ← **SAME** |

**Reschedule-specific fields (only in BOOKING_RESCHEDULED):**
| Field | Value | Meaning |
|-------|-------|---------|
| `rescheduleUid` | `qGDMWyZkfkjt3yhcpQGxh8` | The ORIGINAL booking's uid |
| `rescheduleId` | `14475160` | The ORIGINAL booking's bookingId |
| `rescheduledBy` | `benjaminjcrane@gmail.com` | Who initiated the reschedule |
| `rescheduleStartTime` | `2026-01-11T02:30:00Z` | New start time |
| `rescheduleEndTime` | `2026-01-11T03:00:00Z` | New end time |
| `iCalSequence` | `1` | Incremented from original (was `0`) |

**Handler logic must:**
1. Look up existing booking by `rescheduleUid` (NOT `uid`)
2. Update that booking with:
   - New `calcom_uid` (the new `uid`)
   - New `calcom_booking_id` (the new `bookingId`)
   - New `start_time` / `end_time`
3. OR: Mark old booking as rescheduled, create new booking linked to same person

**Recommended approach:** Update existing booking record (maintains history, simpler queries)

---

## Sample Payloads

### PING (Test Event)
```json
{
  "triggerEvent": "PING",
  "createdAt": "2026-01-10T23:32:44.665Z",
  "payload": {
    "type": "Test",
    "title": "Test trigger event",
    "startTime": "2026-01-10T23:32:44.665Z",
    "endTime": "2026-01-10T23:32:44.665Z",
    "attendees": [
      {
        "email": "jdoe@example.com",
        "name": "John Doe",
        "timeZone": "Europe/London",
        "language": { "locale": "en" },
        "utcOffset": 0
      }
    ],
    "organizer": {
      "name": "Cal",
      "email": "no-reply@cal.com",
      "timeZone": "Europe/London",
      "language": { "locale": "en" },
      "utcOffset": 0
    }
  }
}
```

### BOOKING_CREATED (Real Event)
See: `/calcom_booking_created.json` in project root for full payload.

