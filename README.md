# FIRST FLIGHT: website and client management system

Website and connected portals for **FIRST FLIGHT BEST TRAVEL SOLUTION LTD**: Work Abroad, Study Abroad and Visa Processing.

- **Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, PostgreSQL with Drizzle ORM.
- **Logins:** session-based, with bcrypt password hashing.
- **Permissions:** enforced on the server in every page, action and API route.

## What's in Phase 1

- **Public site.** It covers:
  - the home page: three service cards, live promotions, featured opportunities, portfolio, testimonials, news and contact
  - Work Abroad: country → job offers → job details, with filters
  - Study Abroad: continent → country → university → program, plus search by country, university, program, level and intake
  - the visa checker: nationality, residence, destination country and city, and purpose → a checklist with the official source and the last-checked date, or a consultation request
- **Apply flow.** The chosen job, program or visa and its document checklist are saved as a snapshot, so later catalogue edits don't change submitted applications.
- **Client portal.** Applications with a stage tracker, a document checklist with secure uploads, updates from the consultant, enquiries and notifications.
- **Staff dashboard.** Admin assigns and reassigns consultants. Consultants see their assigned files and open documents. Every action is logged in the activity history and notifies the next person.
- **APIs.** `/api/locations/countries`, `/api/locations/cities?country=GB`, and `/api/documents/:id` (every download is permission-checked).

## What's in Phase 2

- **Consultants.** Verify or reject each uploaded document (a rejection tells the client why), request extra documents, move applications through stages or close them, post client updates and internal notes, and take and answer enquiries.
- **Finance.** Issue invoices on an application (one per instalment), record payments with receipt numbers, block duplicate payment references and overpayment, void unpaid invoices, print invoices and receipts, and run a monthly payment report (print or CSV).
- **Administrator.** Add staff with a temporary password, change roles, reset passwords, deactivate accounts, reassign work, and search all activity.
- **Everyone.** A change-password page; anyone with a temporary password must choose their own before using the system. Notifications link to the page they concern and can be marked as read.
- **Email.** Key events (document requested or rejected, progress, updates, invoices, receipts, enquiry answers) are emailed through Resend once it is connected. Every attempt is recorded in `email_log`.

## What's in Phase 3

- **Content area** (`/staff/content`, Content Manager and Admin). Continents, countries, job categories, job offers, universities, programs, visa purposes, visa guidance, promotions, portfolio, testimonials and news.
- **Publishing.** New items start as drafts. Drafts can be previewed on the real page (`?preview=1`, content staff only), published, unpublished or archived; only drafts that nothing uses can be deleted.
- **Document checklists.** Jobs, programs and visa guidance each have an ordered checklist (required or optional, with notes). Jobs and programs can't be published without one. Submitted applications keep the checklist they were given.
- **Visa guidance review queue.** Lists entries that are flagged or not checked for 180 days (and those due within 30). "Mark as checked today" requires confirming the official source was compared.
- **Rules.** Testimonials need recorded consent before publishing; promotions need an end date after the start and a safe button link; salary ranges must make sense. Every change is in the activity history.
- Field definitions live in `src/lib/content/entities.ts`: adding a field there adds it to the form, validation and save.

## What's in Phase 4

- **Website assistant** ("Ask us", every public page). Understands questions about jobs, study, visas, fees, documents, applying, tracking and contact details, and answers only from published FIRST FLIGHT data and fixed explanations: it never invents visa rules or prices. "Talk to a consultant" turns the chat into an enquiry with the conversation attached. No AI service or API key is needed.
- **WhatsApp picker.** Visitors choose the right desk; WhatsApp opens with a message naming the page they were on. Contacts are managed under Content → WhatsApp contacts.
- **Permanent document storage.** Set `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_REGION`, default `auto`) to keep uploads in Cloudflare R2 / AWS S3; otherwise they go to `UPLOAD_DIR` (use a Render disk at `/var/data`). Uploads are checked by their real content, not just their name.
- **Hardening.** Wrong-password throttling (8 tries per account and address, then 15 minutes), enquiry and assistant limits, security headers, `robots.txt` and `sitemap.xml`.
- **Launch checks** (`/staff/launch`, admin). Re-checks accounts, demo data, email, storage, the public address and content every time it is opened, with how to fix each item.

## What's in Phase 5

- **Private service fees** (`/staff/finance/fees`, Finance and Admin). A fee per service, optionally narrowed to a country, job, university, program or visa purpose, paid in one to three instalments (percentages adding to 100, due a set number of days after the plan is applied). On an application, Finance applies the most specific matching fee: one invoice per instalment is issued and the agreed plan is copied onto the application, so later fee changes never alter it. Fee changes are recorded with before/after values. Visitors never see fees; clients see only their own plan (total, paid, remaining, each instalment); consultants see only whether each instalment is cleared.
- **Refunds in two steps** (`/staff/finance/refunds`). The client asks for a refund of a paid invoice → Finance/Admin approve (the refund form opens for the client) or decline → the client gives the amount (up to what was paid) and mobile money or bank details → Finance records the payout reference. Refunds appear in the monthly report with net totals.
- **Change requests.** Clients ask to change their listing, details or dates; the assigned consultant (or an admin) approves or declines with a message that is posted to the application.
- **Flight bookings** (`/flights`). Route (country and city), one-way or return dates, passengers and class become a flight enquiry for consultants; the assistant points flight questions there.
- **Phone and tablet testing.** Every public page, the help panels, the client portal and the staff dashboard are checked on a phone (Pixel 7) and a tablet (iPad Mini) as well as desktop. The full menu shows from 1280px wide; below that, the compact menu is used.

The roadmap is in `docs/ROADMAP.md`.

## Run locally

Requirements: Node 20.9+ and PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL and SEED_PASSWORD
npm install
npm run db:migrate              # create tables
npm run db:seed                 # sample data for TESTING only (wipes the database)
npm run dev                     # http://localhost:3000
```

Sample accounts (password = `SEED_PASSWORD`):

| Account | Role |
|---|---|
| admin@firstflight.test | Administrator |
| consultant@firstflight.test, consultant2@firstflight.test | Consultant |
| finance@firstflight.test | Finance |
| content@firstflight.test | Content manager |
| client@firstflight.test | Client (has one demo application) |

Never run `db:seed` against production: it deletes all data.

## Tests

```bash
npm test                                              # unit tests: permissions, visa matching, formatting
npm run db:seed && npm run build && npm run start     # in one terminal
CHROME_PATH=/usr/bin/google-chrome npm run test:e2e   # in another: launch paths in a real browser
```

## Deploy on Render

Current setup (demo): a free web service, with FIRST FLIGHT's **own database** on the existing `visaboard-db` server.

- **Build command:** `npm ci --include=dev && npm run render-build`
  - Creates the `firstflight` database if it's missing, runs the migrations, loads sample data only into an empty database (when `SEED_ON_EMPTY=true`), then builds.
- **Start command:** `npm run start`
- **Environment variables:**
  - `DATABASE_URL`: the server's *Internal Database URL* with the database name at the end changed to `/firstflight`
  - `SEED_PASSWORD`: password for the demo accounts
  - `SEED_ON_EMPTY=true`: demo only; remove it for production
  - `NEXT_PUBLIC_SAMPLE_DATA=true`: shows the "sample data" notice
  - `UPLOAD_DIR=./storage/uploads`
  - `RESEND_API_KEY` and `EMAIL_FROM` (optional): switch on email. `EMAIL_FROM` must use a domain verified in Resend, e.g. `FIRST FLIGHT <notifications@yourdomain.com>`
  - `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (optional): permanent document storage in Cloudflare R2 or S3
  - `APP_URL` (optional): the public address used in email links; Render's own address is used if it's not set

**Before real clients use it:**
1. Move to a paid database and a paid web service with a **Disk** at `/var/data`.
2. Set `UPLOAD_DIR=/var/data/uploads`.
3. Remove `SEED_ON_EMPTY` and `NEXT_PUBLIC_SAMPLE_DATA`.
4. Create the real administrator from the Render Shell:
   ```bash
   npx tsx scripts/create-admin.ts "Full Name" admin@yourdomain.com 'a-strong-password'
   ```

Free web services sleep after inactivity: the first visit after a quiet period takes up to about a minute. Free services also have no disk, so uploaded documents are lost when the service restarts.

## Project structure

```
src/db/schema.ts        one shared database: 26 linked tables (people, catalogue, applications, finance, content)
src/db/seed.ts          test-environment sample data
drizzle/                SQL migrations
src/lib/permissions.ts  who may see and do what (unit-tested)
src/lib/visa-match.ts   visa guidance matching (unit-tested)
src/lib/queries.ts      published-content reads for the public site
src/app/                pages, server actions and API routes
tests/                  unit (Vitest) and end-to-end (Playwright) tests
```
