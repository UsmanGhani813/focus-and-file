# Deployment guide — focus-and-file → Vercel

This project has been migrated from Lovable Cloud Supabase to your own Supabase project. Follow these steps once to get it live on Vercel.

## 1. Update `.env` locally (one manual step)

The remote tool cannot write `.env` files for safety reasons. Open `.env` in the project root and replace its contents with:

```
SUPABASE_PROJECT_ID="yoceucrekqhyvmnkqnxn"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_i_sklAj-9xIF2z-dBxvMsw_1fTaSDNZ"
SUPABASE_URL="https://yoceucrekqhyvmnkqnxn.supabase.co"
VITE_SUPABASE_PROJECT_ID="yoceucrekqhyvmnkqnxn"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_i_sklAj-9xIF2z-dBxvMsw_1fTaSDNZ"
VITE_SUPABASE_URL="https://yoceucrekqhyvmnkqnxn.supabase.co"
```

## 2. Rotate the secret key you pasted earlier

You pasted part of your secret key in chat. Rotate it in the Supabase dashboard now:
Settings → API Keys → Secret keys → New secret key → then delete the old one.

## 3. What has already been done on the new Supabase project

- 4 tables created: `profiles`, `work_sessions`, `attachments`, `active_timers`
- All RLS policies applied
- `handle_new_user` trigger installed (auto-creates profile on signup)
- Storage bucket `work-evidence` created (private)
- Storage RLS policies applied (users see their own files; anyone can read files that belong to public sessions)

## 4. Supabase Auth setup (dashboard)

Go to **Authentication → URL Configuration** and set:

- **Site URL**: your Vercel production URL (e.g. `https://focus-and-file.vercel.app`)
- **Redirect URLs**: add both your Vercel production URL and `http://localhost:3000` (or whatever port Vite uses locally) so email confirmation links work.

Optional: In **Authentication → Providers → Email**, decide whether to require email confirmation. If off, users are logged in immediately after signup. If on, they must click the confirmation link before logging in.

## 5. Deploy to Vercel

1. Push the repo to GitHub (already at `UsmanGhani813/focus-and-file`).
2. On [vercel.com](https://vercel.com/new), import that repo.
3. Vercel will detect `vercel.json` and use these settings automatically:
   - Install: `bun install`
   - Build: `bun run build`
   - Output: `.vercel/output` (Nitro's Vercel preset via `NITRO_PRESET=vercel`)
4. In **Project Settings → Environment Variables**, add all six variables from step 1 for **Production, Preview, and Development**.
5. Click Deploy.

## 6. First-time smoke test after deploy

- Open your Vercel URL. You should see the "Tempo" landing page.
- Click "Register yourself", create an account.
- After signup you should land on `/dashboard`.
- Press START, wait a few seconds, press STOP.
- Fill in title, upload a small PNG, click "Submit work".
- Visit `/history` — the session should appear.
- Visit `/profile` — your name and email should be filled in.

## Notes

- `.env` is git-ignored, so it doesn't leak into the repo. Vercel gets its values from the dashboard env vars, not from `.env`.
- The `.lovable/` folder and `AGENTS.md` are Lovable-editor metadata. Harmless, but you can delete them once you're fully off Lovable.
- No Supabase Edge Functions are used. The app talks to the database and storage directly using the publishable key + user JWT.
