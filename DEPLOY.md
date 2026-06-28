# Deploying QuantPrep (free): Vercel + Supabase

The app works on **local storage** with zero setup. To add **Google sign-in + a
cloud database** that syncs progress across devices, follow the steps below.
Everything here is on free tiers.

---

## 1. Create the Supabase project (free Postgres + auth)

1. Go to <https://supabase.com> → sign in with GitHub → **New project**.
2. Pick a name, a strong database password, and a region near you. Wait ~2 min
   for it to provision.
3. **Create the table:** left sidebar → **SQL Editor** → **New query** → paste
   the contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
4. **Get your keys:** **Project Settings → API**. Copy:
   - **Project URL** → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Enable Google sign-in

1. In Supabase: **Authentication → Providers → Google → enable**. Leave it open;
   you'll paste the Client ID/Secret in a moment.
2. In a new tab, open the **Google Cloud Console** → <https://console.cloud.google.com>:
   - Create (or pick) a project → **APIs & Services → OAuth consent screen** →
     External → fill the app name + your email → save.
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID →
     Web application.**
   - Under **Authorized redirect URIs**, add the callback URL Supabase shows on
     its Google provider screen — it looks like
     `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   - Create → copy the **Client ID** and **Client secret**.
3. Back in Supabase's Google provider screen, paste the Client ID + Secret →
   **Save**.

## 3. Push the code to GitHub

Already done if I pushed it for you (private repo on your account). Otherwise:

```bash
cd quant-interview-prep
gh repo create quant-interview-prep --private --source=. --remote=origin --push
```

## 4. Deploy on Vercel

1. Go to <https://vercel.com> → sign in with GitHub → **Add New… → Project**.
2. Import the `quant-interview-prep` repo. Framework is auto-detected (Next.js).
3. **Environment Variables** — add both:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
4. **Deploy.** You'll get a URL like `https://quant-interview-prep.vercel.app`.

## 5. Point auth at your live URL

1. **Supabase → Authentication → URL Configuration:**
   - **Site URL:** your Vercel URL (e.g. `https://quant-interview-prep.vercel.app`)
   - **Redirect URLs:** add `https://<your-vercel-url>/auth/callback`
     (and `http://localhost:3000/auth/callback` for local dev).
2. Redeploy isn't needed for this change. Open your site, click **Sign in**, and
   your progress will now save to Supabase and sync across devices.

---

### Local development with Supabase

Create `.env.local` (copy from `.env.example`) and fill in the two values, then
`npm run dev`. Without the file, the app simply uses local storage.
