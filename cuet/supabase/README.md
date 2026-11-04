# Everything CUET: leads (Supabase)

**Live now.** The site is connected to the Supabase project **everything-cuet** (Mumbai, `kvfgjsnhbyduntbsxqxs`), set in `cuet/config.js` with `login: "form"`.

Every time a student signs up, books a senior call, turns on a reminder or asks for help, the site adds a row to the **`signups`** table. Each row holds the kind (`lead`, `senior-call`, `reminder`, `alerts`, `form`, ...), name, phone, email, course, the page they were on and the details in `payload`. Visitors can only add rows; nobody can read them through the API.

**See your leads:** Supabase → **Table Editor → signups**. Sort by `created_at`, filter by `kind`, or choose **Export to CSV**.

The `leads`, `requests` and `admins` tables are ready for proper logins (Google and 6-digit email codes). To switch those on, finish steps 3 to 5 below, then set `login: "auth"` in `config.js`. Until then the short sign-up form is used, so students never wait for an email.

## Turning on Google and email-code logins (optional)

1. **Create the project.** Done: `everything-cuet` in Mumbai.
2. **Create the tables.** Done: [`schema.sql`](schema.sql) has been run, with dikshabhargava31@gmail.com as admin.
3. **Turn on email codes.**
   1. Go to **Authentication → Sign In / Providers → Email** and make sure it is on.
   2. Go to **Authentication → Emails → Magic Link** and replace the body with:
      `<h2>Your Everything CUET code</h2><p>Enter this code to log in: <b>{{ .Token }}</b></p><p>It expires in 1 hour.</p>`
   3. Supabase's built-in email only sends a few emails an hour, which is enough for testing only. Before launch, set up **Authentication → Emails → SMTP Settings** with a free sender such as Brevo or Resend.
4. **Set the site address.** Go to **Authentication → URL Configuration**.
   - Set **Site URL** to `https://dikshabhargava31-ops.github.io/claude-and-db/cuet/`.
   - Add the same address under **Redirect URLs**. If you move to your own domain, add that too.
5. **Turn on Google login.**
   1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), go to **Create credentials → OAuth client ID → Web application**.
   2. Under **Authorized redirect URIs**, add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   3. Copy the client ID and secret into Supabase under **Authentication → Sign In / Providers → Google**.
   4. On Google's **OAuth consent screen**, set the app name to *Everything CUET* and add your logo.
6. **Switch the site over.** Set `login: "auth"` in `cuet/config.js`. The URL and anon key are already there. The anon key is meant to be public: row-level security lets each student read only their own row, and only the emails in `admins` read every lead.

## Leads

- **On the site:** log in with an admin email and open **More → Account → Leads**. You can search, and download the leads and requests CSVs.
- **In Supabase:** go to **Table Editor → leads** and choose **Export to CSV**.
- **Add another admin:** run `insert into public.admins (email) values ('them@example.com');` in the SQL Editor.

## Phone OTP later

To add mobile-number login, turn on **Authentication → Sign In / Providers → Phone** with an SMS provider (MSG91 or Twilio). SMS in India needs DLT registration first. The lead form already collects the mobile number, so no data is lost in the meantime.
