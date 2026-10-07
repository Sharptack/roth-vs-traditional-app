# Security: what's in place, and what to finish before launch

Stage now: **testing**. No real client data yet (the app says: initials or a nickname, no client
names, account numbers or Social Security numbers). Launch means real advisors and real clients.

## In place now
- **The database decides access** (Postgres row-level security, forced): an advisor can read,
  change and delete only their own saved households. The owner is set by the database from the
  session and can't be changed. The anon (public) key has no access to the table at all.
  `supabase/tests/rls_check.sql` proves each rule.
- **Invite only, twice**: public sign-up is off in Supabase, and the app's sign-in never creates a
  user (`shouldCreateUser: false`).
- **No passwords**: an emailed sign-in link, PKCE flow (the link carries a one-time code that only
  the requesting browser can exchange; the app removes it from the address bar).
- **Only known data is stored**: saved households are the form's values, cleaned to an allow-list of
  fields, each a short string, the accounts list rebuilt field by field, on save and on load
  (`src/lib/savedHousehold.js`); the database caps the size too.
- **Audit log** (`supabase/migrations/20261007000000_household_audit.sql`): every create, open,
  change and delete of a household is recorded (when, which advisor, which household, its label;
  for a change, whether the label and/or contents changed; never the contents). Writes are logged
  by database triggers; the contents can only be read through `open_saved_household`, which logs
  the open, so nothing reads a household unlogged. No advisor and not the public key can read or
  alter the log. `supabase/tests/audit_check.sql` proves each rule.
- **Keys**: only the URL and the anon key reach the browser, from environment variables, not the
  repo. The service_role key is never used by the app.
- **Browser hardening** (`netlify.toml`): an enforced Content-Security-Policy (scripts only from the
  site itself; network only to the site and Supabase), no framing, nosniff, a strict referrer policy
  (share links carry inputs in the address, so other sites get only the origin), HSTS.

## Before launch
**Compliance and vendor**
- [ ] Firm compliance sign-off: record-keeping and retention, privacy (Reg S-P), approved vendors.
- [ ] Supabase paid plan: daily backups / point-in-time recovery; request their SOC 2 report.
- [ ] Decide what client data is stored at all. Keep names out if possible (labels / initials), or
      encrypt them per field.

**Accounts and sign-in**
- [ ] Require two-factor (TOTP) for every advisor, and enforce it in the database policies
      (`auth.jwt() ->> 'aal' = 'aal2'`), not just in the app.
- [ ] Restrict sign-in to the firm's email domain (a Supabase auth hook).
- [ ] Session lifetime: shorter access tokens, refresh-token reuse detection on, an inactivity
      sign-out in the app.
- [ ] Custom SMTP on the firm's domain (SPF, DKIM, DMARC) for the sign-in emails. It also removes the
      built-in sender's low hourly cap. Plan (2026-10-06): once the domain is bought, a transactional
      sender with a free tier (Resend first choice; Brevo, Postmark or Amazon SES also work) in
      Supabase → Authentication → SMTP. Not Mailchimp's free plan: it has no transactional sending
      (Mandrill is a paid add-on).
- [ ] Invitation emails: switch the "Invite user" email template to a token-hash link the app verifies
      (`verifyOtp`), so accepting an invitation never puts session tokens in the address bar (today it
      uses the implicit flow: `#access_token=…` lands on the Site URL).
- [ ] Tighten Redirect URLs from `/**` to the exact addresses the app uses.
- [ ] Two-factor on every admin account: Supabase, GitHub, Netlify, the domain registrar.

**Data**
- [x] Audit log: who created, opened, changed, deleted each household and when (a table written by
      database triggers, readable by no advisor). Done 2026-10-07, see "In place now". Still to
      decide: how long to keep it, and whether to also log sign-ins (Supabase's own auth logs keep
      those for a short time on the free plan).
- [ ] Export and delete per client on request; a retention rule for old households.
- [ ] Sharing between advisors (a team, an assistant) only through explicit, tested policies.

**App and operations**
- [ ] Make the GitHub repo private (nothing secret is in it, but there's no need to publish it).
- [ ] Netlify: password-protect or remove any public preview of the signed-in area if needed.
- [ ] Dependency checks on every change (`npm audit`), and keep `@supabase/supabase-js` current.
- [ ] Supabase Security Advisor and Performance Advisor clean.
- [ ] An outside penetration test, and a written incident-response plan (who to call, how to rotate
      keys, how to notify).
