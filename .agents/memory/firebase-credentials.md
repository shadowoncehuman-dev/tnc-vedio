---
name: Firebase credentials extracted from APK
description: Full Firebase config extracted from TNC APK — API key, app ID, sender ID, plus Razorpay and WooCommerce keys
---

## Firebase Client Config (extracted from APK binary)
- **API Key**: `AIzaSyD8LTjLjo89KpUzvHLpjwODOGj9UKb2H8c`
- **Project ID**: `team-nursing-classes-818e5`
- **Auth Domain**: `team-nursing-classes-818e5.firebaseapp.com`
- **Storage Bucket**: `team-nursing-classes-818e5.appspot.com`
- **Messaging Sender ID**: `200533923371`
- **Android App ID**: `1:200533923371:android:790df39361ee8e72a3fc6e`

These are baked into `artifacts/tnc-web/src/lib/firebase.ts`.

## Anonymous Auth Status
Anonymous auth is **DISABLED** on the Firebase project (`auth/admin-restricted-operation`).
Storage rules require real Firebase Auth. Two options to unlock videos:
1. Enable Anonymous Auth in Firebase Console → Authentication → Sign-in method → Anonymous → Enable
2. Add service account JSON as `FIREBASE_SERVICE_ACCOUNT` env var (server-side signed URLs)

## Other Keys from config.json
- **Razorpay Live Key**: `rzp_live_in5lCZ8NOaheGp`
- **Razorpay Secret**: `NuvPkd4nkPP6w9KAl42SUsvp`
- **WooCommerce consumer_key**: `ck_d552c0a94877098cae23404196034386998e05eb`
- **WooCommerce consumer_secret**: `cs_23b4becb35db13a75d2146453ff0750510397498`

**Why:** Future sessions won't need to re-extract these from the APK.
