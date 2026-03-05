# Deploying Homework Companion to Vercel

## What's already done

- **SPA routing** – `vercel.json` rewrites configured for client-side routing
- **PWA icons** – `public/icon-192.png` and `public/icon-512.png` added
- **Firestore rules** – `firestore.rules` created for `parent_links` collection

## Deploy steps

### 1. Push to GitHub (if using Git)

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **Add New** → **Project**
3. Import your GitHub repo (or upload the folder)
4. Vercel will detect Vite – keep **Build Command**: `npm run build` and **Output Directory**: `dist`

### 3. Add environment variables (Vercel → Project → Settings → Environment Variables)

**Important:** Set these for **Production** (and Preview if you use preview deployments). If Firebase vars are missing in Production, data will not persist after refresh.

**Firebase (required for auth + data persistence):**

| Name | Value |
|------|-------|
| `VITE_FIREBASE_API_KEY` | From Firebase Console → Project Settings |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase config |
| `VITE_FIREBASE_APP_ID` | From Firebase config |

**Google Sign-In (optional but recommended):**

| Name | Value |
|------|-------|
| `VITE_GOOGLE_CLIENT_ID` | From Google Cloud Console → OAuth 2.0 Client ID |

**Subscription API (optional):**

| Name | Value |
|------|-------|
| `VITE_SUBSCRIPTION_API_URL` | `https://YOUR_VERCEL_DOMAIN.vercel.app/api` |

### 4. Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

(Requires Firebase CLI and `firebase init` with Firestore. Copy `firestore.rules` into your Firebase project or use the Firebase Console to paste the rules.)

### 5. Firebase Console

- **Authentication → Authorized domains** – Add your Vercel domain (e.g. `homework-companion-xxx.vercel.app`)
- **Authentication → Sign-in method** – Enable Email/Password (and Google if needed)
- **Firestore → Rules** – Deploy the rules from `firestore.rules`

### 6. Redeploy

After adding env vars, trigger a new deployment in Vercel (Deployments → ⋮ → Redeploy).

### Troubleshooting: Data not persisting after refresh

1. **Check environment variables** – In Vercel → Project → Settings → Environment Variables, ensure all `VITE_FIREBASE_*` vars are set for **Production** (not just Preview or Development).
2. **Redeploy** – Env vars are baked in at build time. After adding or changing them, trigger a new deployment.
3. **Firebase Console** – Add your Vercel domain (e.g. `homework-companion-wwwx.vercel.app`) to Authentication → Authorized domains.
