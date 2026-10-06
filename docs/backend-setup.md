# Backend setup: Supabase sign-in and saved households

The `#/next` preview can sign advisors in (an emailed link, no passwords, invite only) and save
client households. Without the two settings below, the preview works exactly as before, with no
sign-in. About 20 minutes, once.

## 1. Create the project
1. Sign up at supabase.com and create a project. Pick a US region. Save the database password in
   your password manager (the app never needs it).
2. Turn on two-factor sign-in for your own Supabase account (Account → Security). Do the same on
   GitHub and Netlify if you haven't.

## 2. Create the table and its security rules
1. In the project: **SQL Editor** → New query → paste all of
   `supabase/migrations/20261005000000_saved_households.sql` → **Run**.
2. Check it: paste `supabase/tests/rls_check.sql` into a new query → **Run**. It should end with
   **"RLS checks passed"**. It changes nothing (it rolls itself back). If it stops with
   "RLS FAIL: …", don't use sign-in until that's fixed.
3. **Advisors → Security Advisor** (in the dashboard): it should show no errors for
   `saved_households`.

## 3. Sign-in settings (Authentication)
1. **Sign In / Providers**: Email on. **Turn OFF "Allow new users to sign up."** (Invite only. The
   app also never creates users from the sign-in form, as a second lock.)
2. **URL Configuration**:
   - Site URL: `https://astonishing-sprite-b5d581.netlify.app` exactly, with no `/**` (the invitation email
     sends people to the Site URL; with `/**` on it they land on a "Page not found").
   - Redirect URLs: add `https://astonishing-sprite-b5d581.netlify.app/**` and `http://localhost:5173/**`
3. **Users → Add user → Send invitation**: add each advisor's email (start with your own). Clicking the
   invitation confirms the account; the page it opens shows a long token in the address bar: close that
   tab and don't share the address. Then sign in on the preview with "Email me a sign-in link".
4. Supabase's built-in email sender is for testing (low hourly limit). Before launch, set up custom
   SMTP on the firm's domain (see docs/security.md).

## 4. Give the app the two public settings
From **Project Settings → API**: the Project URL and the **anon public** key.
(Never the `service_role` key: that one bypasses every rule and must never leave Supabase.)

- **Local**: copy `.env.example` to `.env.local` (git-ignores it), fill in both, restart `npm run dev`.
- **Live site**: Netlify → Site configuration → Environment variables → add
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → then **Deploys → Trigger deploy** (the values
  are built into the site, so a new deploy is needed).

## 5. Try it
1. Open `/#/next` → "Sign in to save households" → your email → open the emailed link **in the same
   browser** (the link only completes in the browser that asked for it).
2. On the preview homepage: "Saved households" → save, open, delete.
3. With a second invited address in another browser: the first advisor's households don't appear.
