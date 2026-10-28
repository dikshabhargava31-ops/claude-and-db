# Everything CUET: logins and leads (Supabase)

Students log in with Google or a 6-digit email code, then add their name, mobile, Class 12 year, category, state and interest. Each student is one row in the `leads` table, with their saved list. Orders, senior-call bookings, alert sign-ups, group requests and allotment reports go to the `requests` table. Admins see everything at **More → Account → Leads** on the site (`#/admin`), with CSV downloads.

Until the steps below are done, the site falls back to a short sign-up form (name, mobile, email). It saves sign-ups in the student's browser and sends them to WhatsApp or `formEndpoint` if those are set in `config.js`.

## Setup (about 20 minutes, free)

1. **Create the project.** Go to [supabase.com](https://supabase.com), sign up, choose **New project**, and pick the region **Mumbai (ap-south-1)**.
2. **Create the tables.** Open **SQL Editor → New query** and paste in [`schema.sql`](schema.sql). On the last line, replace `your-email@example.com` with the email you will log in with, then choose **Run**.
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
6. **Connect the site.**
   1. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
   2. Paste them into `cuet/config.js` under `supabase`.
   3. The anon key is meant to be public. The row-level security in `schema.sql` lets each student read only their own row, and lets only the emails in `admins` read every lead.

## Leads

- **On the site:** log in with an admin email and open **More → Account → Leads**. You can search, and download the leads and requests CSVs.
- **In Supabase:** go to **Table Editor → leads** and choose **Export to CSV**.
- **Add another admin:** run `insert into public.admins (email) values ('them@example.com');` in the SQL Editor.

## Phone OTP later

To add mobile-number login, turn on **Authentication → Sign In / Providers → Phone** with an SMS provider (MSG91 or Twilio). SMS in India needs DLT registration first. The lead form already collects the mobile number, so no data is lost in the meantime.
