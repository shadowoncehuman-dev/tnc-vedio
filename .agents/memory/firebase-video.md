---
name: Firebase video limitation
description: TNC Firebase Storage is inaccessible — wrong bucket was coded AND the project is on Spark plan which lost Storage in Sep 2024
---

## Root Cause (fully investigated)

Firebase Storage for TNC returns HTTP 402 with message:
> "Cloud Storage for Firebase no longer supports Firebase projects that are on the no-cost Spark pricing plan."

This is a billing issue on TNC's Firebase account, not an auth or path issue.

## Key Facts

- **Correct Firebase project**: `shivangi-nursing-academy-818e5` (confirmed via `getProjectConfig`)
- **Correct Storage bucket**: `shivangi-nursing-academy-818e5.appspot.com` (fixed in firebase-rest.ts)
- **Wrong bucket that was coded**: `team-nursing-classes-818e5.appspot.com` (returns 404 — different project)
- **Auth methods disabled**: anon=ADMIN_ONLY, email=PASSWORD_LOGIN_DISABLED, phone=OPERATION_NOT_ALLOWED
- **Storage status**: 402 on all file access — Spark plan pricing change (September 2024)
- **Bucket listing**: returns 200 with `items: []` (empty or unauthenticated listing blocked)

## What This Means

- The original TNC Android app's Firebase videos are ALSO broken since Sep 2024
- No platform (web, native Android, iOS) can access these videos until TNC upgrades to Blaze plan
- Building a native Android app will NOT fix this — same 402 from any client

## Current UI

- `watch.tsx`: Firebase sessions show `AppRequiredCard` — smartphone icon, Google Play link, tncnursing.in link
- `parseChapter` in proxy.ts: `contentType = "firebase"` when `_fs_id` present and no playable URL

## How to Fix (requires TNC action)

TNC must upgrade their Firebase project `shivangi-nursing-academy-818e5` to the Blaze (pay-as-you-go) plan.
Once upgraded, the existing `streamFirebaseVideo()` in firebase-rest.ts can be wired up — it just needs
a valid auth token. Options ranked by effort:
1. TNC provides Firebase service account JSON → set as `FIREBASE_SERVICE_ACCOUNT` secret → works immediately
2. Enable email/password auth in Firebase console → set `FIREBASE_USER_EMAIL` + `FIREBASE_USER_PASSWORD` → works immediately
