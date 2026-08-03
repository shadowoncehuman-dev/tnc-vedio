---
name: Firebase video limitation
description: _fs_id UUIDs are NOT Firebase Storage paths — they're IDs for fs-stream.net CDN, played via videoplay.tncnursing.in iframe
---

## Root Cause (fully resolved)

The `_fs_id` field in CRM chapters is NOT a Firebase Storage path. It's an ID for a
third-party video CDN (fs-stream.net). The TNC app plays them through a dedicated
player at `videoplay.tncnursing.in`.

## How It Works

1. CRM row has `json._vi._fs_id = "some-uuid"`
2. TNC app loads: `https://videoplay.tncnursing.in/videos/fs/index.html?{fs_id}`
3. That page iframes: `https://fs-stream.net/video/8KHkEmpcrjoDH9OAlRMxr6d7jcrYdjOo/1681712213826_R9nD/{fs_id}`
4. fs-stream.net referer-checks — 403 on direct access, 200 via the videoplay.tncnursing.in referrer

## Current Web Implementation

- `watch.tsx`: `FsVideoPlayer` component iframes `videoplay.tncnursing.in/videos/fs/index.html?{encodeURIComponent(fs_id)}`
- `videoplay.tncnursing.in` sets no X-Frame-Options header → embeds cleanly on web
- This makes ALL non-YouTube lectures work on the website

## False Leads (do not retry)

- Firebase Storage bucket `shivangi-nursing-academy-818e5.appspot.com` → 402 (Spark plan)
- Firebase RTDB `shivangi-nursing-academy-818e5.firebaseio.com` → 401 (auth required, irrelevant)
- All Firebase Auth methods disabled: anon=ADMIN_ONLY, email=PASSWORD_LOGIN_DISABLED, phone=OPERATION_NOT_ALLOWED
- Wrong bucket `team-nursing-classes-818e5.appspot.com` → 404 (different project)
- `_fs_id` is NOT a Firebase Storage filename — Firebase is a red herring

## APK Discovery Method

Downloaded com.tncnursing APK (XAPK), extracted `main_apk/`, ran `strings` on
`libapp.so` to find the `videoplay.tncnursing.in` URL. Config at
`assets/flutter_assets/lib/config/config.json` also reveals second backend:
`https://tncnursing.com/` (WordPress/WooCommerce) with credentials.
