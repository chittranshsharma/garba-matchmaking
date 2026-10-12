# Raas ✺

**Find your garba people in Delhi NCR.** Raas is a free, 18+ matching site for finding dance partners, friends, or a new connection. It takes the fun of a swipe app and gives it a Navratri heart: three photos, personality prompts, mutual likes, and private chat.

## What it does

- Sign in with Google and build a profile one step at a time.
- Upload up to three photos, then crop, zoom, and rotate them before saving.
- Answer up to three prompts so people have something better than “hey” to start with.
- Discover people by Delhi NCR area and an age range. Gender preferences work in both directions, including same-gender matches.
- Like or pass. A chat opens only after both people like each other.
- Block or report someone from a conversation.

The site is designed for phones first. Its festival motion stays on, while the canvas uses fewer particles and frames on small screens. Scene images are served as compact WebP files.
The original PNG artwork is kept in [`artwork/`](artwork/), outside the deployed `public/` folder.

## Stack

| Part | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, CSS |
| Hosting | Vercel static deployment |
| Backend | Supabase Auth, Postgres, Storage, Realtime |
| Sign-in | Google OAuth through Supabase Auth |

No paid service or server is required for the intended small launch. Free plans have usage and project limits; check the current limits before inviting a larger crowd.

## Run locally

You need Node.js **20.19+**, npm, a Supabase project, and a Google OAuth web client.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a Supabase project. For a **new, empty project**, run [`supabase/schema.sql`](supabase/schema.sql) once in the SQL Editor. It creates the tables, row-level security policies, private photo bucket, discovery and swipe functions, and message Realtime publication. Review it before running it against any existing project.

3. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the Google OAuth client ID and secret. In Google Cloud, set the OAuth client's **Authorized redirect URI** to the Supabase callback URL shown on that provider page (usually `https://<project-ref>.supabase.co/auth/v1/callback`). Keep the Google client secret in Supabase only.

4. In Supabase **Authentication → URL Configuration**, add your local origin to the redirect allow list: `http://localhost:5173` (and `http://127.0.0.1:5173` if you use that address). The app sends users back to the origin they signed in from.

5. Copy `.env.example` to `.env.local` and fill in the project URL and **publishable** key:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

6. Start the app with `npm run dev`. Open the local address Vite prints.

Other commands: `npm run build` makes the production bundle in `dist`; `npm run preview` serves that bundle locally; `npm test` runs the small age and crop tests.

## Deploy on Vercel

1. Push this repository to GitHub and import it as a new Vercel project.
2. Use the Vite preset. Build command: `npm run build`. Output directory: `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel project environment variables for Production (and Preview if you want preview sign-in). Redeploy after changing build variables.
4. Add the final Vercel origin, such as `https://your-project.vercel.app`, to the Supabase Auth redirect allow list. Set the Supabase **Site URL** to the production origin.
5. Keep Google's redirect URI pointed at the **Supabase Auth callback**, not the Vercel site. Before public launch, check the Google OAuth app's audience/publishing status: Testing mode allows only added test users.
6. Test Google sign-in, onboarding, photo upload, discovery, mutual matching, chat, block/report, and a phone-sized viewport on the deployed URL.

[`vercel.json`](vercel.json) rewrites app paths to `index.html` for the single-page app. The `VITE_` variables are visible in the browser bundle; use only the publishable key there. Never put a Supabase service role key or Google client secret in the repo or Vercel frontend variables.

## Data and safety notes

- Profiles are limited to self-reported adults aged 18+. The app does not verify identity or age.
- Profile photos live in a private Supabase Storage bucket and are displayed with short-lived signed URLs.
- Row-level security and database functions protect profile, match, message, and block access. Reports are stored for the project owner to review in Supabase.
- Discovery returns at most 30 unswiped profiles at a time. Filters run after a short pause while dragging the age slider.
- The SQL file is the **initial schema**, not an idempotent migration. This repo's existing Supabase project may already have it applied.

If a Google client secret has been shown in a screenshot or pasted into a chat, rotate it in Google Cloud and update the Supabase Google provider before launch.

For current platform setup details, see the [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite).
