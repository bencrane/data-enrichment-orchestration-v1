# Post-Mortem: Incorrect Modal API URL in Frontend Prompt

**Date:** 2026-01-10  
**Severity:** High  
**Time Lost:** ~30-60 minutes of user debugging + frontend AI iterations  
**Author:** AI Assistant

---

## Summary

The frontend AI was given an incorrect Modal API endpoint URL (`https://outboundsolutions--deals-api-app.modal.run/...`) instead of the correct URL (`https://bencrane--deals-api-api.modal.run/...`). This caused the proposal embed page to fail silently or return 404 errors, leading to multiple debugging cycles and wasted time.

---

## Root Cause

1. **Assumed workspace name instead of verifying:** I assumed the Modal workspace was named `outboundsolutions` based on project context (the project involves "Outbound Solutions" as a business). I did not verify the actual workspace name by checking deployment output or running `modal app list`.

2. **No verification step before providing external-facing URLs:** When generating prompts for other AI agents or external integrations, I provided URLs without first confirming they were correct by testing or checking deployment logs.

3. **Compounded by app naming confusion:** The app name in the URL is `deals-api-api` (the function is named `api` within an app named `deals-api`), which I also got wrong as `deals-api-app`.

---

## Timeline

| Time | Event |
|------|-------|
| Earlier in session | Deployed `deals_api.py` successfully |
| ~20:00 | Provided prompt to frontend AI with incorrect URL |
| ~20:00-20:30 | Frontend AI built page using wrong endpoint |
| ~20:30 | User reported "Not Found" errors, assumed it was Documenso staging vs production issue |
| ~20:30-21:00 | Multiple iterations debugging Documenso embed, host prop, token issues |
| 21:XX | User questioned why URL had "outboundsolutions" |
| 21:XX | Ran `modal deploy` and discovered actual URL is `bencrane--deals-api-api.modal.run` |

---

## Impact

1. **Direct time waste:** 30-60 minutes of user time spent debugging a non-existent problem
2. **Cascading confusion:** The 404 errors were attributed to Documenso staging/production mismatch, leading to unnecessary token debugging
3. **Trust erosion:** User correctly identified this as "sloppy work"
4. **Frontend AI wasted cycles:** Multiple iterations on the frontend for a backend URL issue

---

## What Went Wrong

### 1. No URL Verification Protocol
When I deploy a Modal app or reference a deployed endpoint, I should **always** verify the actual URL from deployment output before using it in prompts or documentation.

### 2. Assumptions Based on Business Context
I inferred `outboundsolutions` from the business domain rather than the technical reality (Modal workspace = `bencrane`).

### 3. No Sanity Check
A simple `curl` to the URL or checking `modal app list` would have immediately revealed the error.

---

## Corrective Actions

### Immediate
- [x] Identified correct URL: `https://bencrane--deals-api-api.modal.run/`
- [x] Provided corrected prompt to user for frontend AI

### Process Changes

1. **Always verify Modal URLs after deployment:**
   ```bash
   modal deploy src/deals_api.py 2>&1 | grep "https://"
   ```
   Extract and confirm the URL before using it anywhere.

2. **Test endpoints before providing to external consumers:**
   ```bash
   curl -s https://bencrane--deals-api-api.modal.run/deals | head -c 200
   ```

3. **Document deployed URLs in a central location:**
   Create/update a file like `documentation/global/deployed_endpoints.md` with all live URLs.

4. **When generating prompts for other AI agents:**
   - Include a verification step
   - Test the endpoint first
   - Never assume workspace/app names

---

## Lessons Learned

1. **Technical identifiers ≠ business names.** The Modal workspace is `bencrane`, not `outboundsolutions`. Never conflate the two.

2. **Verify, don't assume.** A 10-second command (`modal deploy ... | grep https`) would have prevented 30+ minutes of debugging.

3. **When debugging fails in unexpected ways, question the fundamentals.** The 404 errors were a clear signal that the URL itself might be wrong, not just the token or Documenso configuration.

4. **Cross-agent communication requires extra rigor.** When providing information that another AI agent will use, the cost of errors is multiplied because the user has to debug across multiple agents.

---

## Deployed Endpoints Reference (Verified 2026-01-10)

For future reference, here are the correct Modal endpoints for this project:

| App | Function | URL |
|-----|----------|-----|
| deals-api | api | `https://bencrane--deals-api-api.modal.run` |
| forms-api | api | `https://bencrane--forms-api-api.modal.run` |
| calcom-ingest | ingest | `https://bencrane--calcom-ingest-ingest.modal.run` |

**URL Pattern:** `https://{workspace}--{app-name}-{function-name}.modal.run`

### Quick Reference for Frontend
```
# Deals API (GET endpoints)
GET https://bencrane--deals-api-api.modal.run/deals
GET https://bencrane--deals-api-api.modal.run/companies
GET https://bencrane--deals-api-api.modal.run/people
GET https://bencrane--deals-api-api.modal.run/bookings
GET https://bencrane--deals-api-api.modal.run/bookings/{id}
GET https://bencrane--deals-api-api.modal.run/proposal/{deal_id}
GET https://bencrane--deals-api-api.modal.run/stats
POST https://bencrane--deals-api-api.modal.run/checkout/{deal_id}

# Forms API (POST endpoints)
POST https://bencrane--forms-api-api.modal.run/outcome
POST https://bencrane--forms-api-api.modal.run/proposal

# Cal.com Webhook Ingest
POST https://bencrane--calcom-ingest-ingest.modal.run
```

---

## Status

- **Resolved:** Yes
- **Prevention measures:** Documented above
- **Follow-up required:** Verify frontend AI receives corrected prompt and page works

