# Firebase Setup Verification Checklist

Use this checklist to verify your Firebase configuration when cloud save fails.

## 1. Firebase Console (console.firebase.google.com)

### Project & Firestore
- [ ] **Firestore Database exists** – Firestore → Create database (if not done). Use **Native mode**, not Datastore.
- [ ] **Firestore rules deployed** – Run `firebase deploy --only firestore:rules` from project root, or paste rules in Console → Firestore → Rules.
- [ ] **Rules allow your collections** – `firestore.rules` must allow `user_data/{userId}` with `request.auth.uid == userId`.

### Authentication
- [ ] **Sign-in method enabled** – Authentication → Sign-in method → Enable **Google** (and Email/Password if used).
- [ ] **Authorized domains** – Authentication → Settings → Authorized domains must include your exact Vercel URL, e.g.:
  - `your-project-wwwx.vercel.app` (or whatever your live URL is)
  - `localhost` (for local dev)
  - **If missing, Firestore will fail with "unavailable" even when WiFi/mobile work.**

### Project Settings
- [ ] **Web app registered** – Project Settings → Your apps → Web app. Copy config values for env vars.

---

## 2. Vercel Environment Variables

Project → Settings → Environment Variables. **All must be set for Production.**

| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_FIREBASE_API_KEY` | Yes | From Firebase config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Must match Firebase project |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | From Firebase config |
| `VITE_FIREBASE_APP_ID` | Yes | From Firebase config |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional | For Analytics |

**Important:** After adding or changing env vars, **redeploy** – Vite bakes them in at build time.

---

## 3. Google Cloud Console (for Google Sign-In)

- [ ] **OAuth consent screen** – APIs & Services → OAuth consent screen configured.
- [ ] **OAuth 2.0 Client ID** – APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application).
- [ ] **Authorized JavaScript origins** – Add `https://homework-companion-wwwx.vercel.app` and `http://localhost:5173`.
- [ ] **Authorized redirect URIs** – Add `https://homework-companion-wwwx.vercel.app` and `https://YOUR_PROJECT.firebaseapp.com/__/auth/handler`.

---

## 4. Common Error Causes

| Error / Symptom | Likely cause |
|-----------------|--------------|
| "Could not save to cloud" | Firestore write failed – check rules, env vars, network |
| "client is offline" | Firestore can't reach servers – try different network, disable VPN |
| "permission-denied" | Firestore rules block the write – ensure `request.auth.uid == userId` |
| "unavailable" | Often **domain not in Firebase Auth** – add your Vercel URL to Authorized domains. Or network blocks Firebase. |
| Data disappears on refresh | Save overwrote before load – fixed with `firestoreSyncReady` guard |
| No cloud button | Firebase not configured – `db` is null; check env vars |

---

## 5. Quick Diagnostic

1. Open the app, sign in with Google.
2. Open DevTools (F12) → Console.
3. Look for:
   - `[HWC] Firebase configured` – Firebase initialized.
   - `[HWC] Firebase not configured` – Env vars missing or invalid.
   - `Save to cloud failed:` – Actual error will follow (e.g. `permission-denied`, `unavailable`).

---

## 6. Deploy Firestore Rules

```bash
firebase login
firebase use your-project-id   # if you have multiple projects
firebase deploy --only firestore:rules
```

Ensure `firebase.json` points to `firestore.rules` and the project is linked (`firebase use`).
