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

The roadmap for later phases is in `docs/ROADMAP.md`.

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

1. **Database.** Create a Render **PostgreSQL** database and copy its *Internal Database URL*.
2. **Web service.** Create a Render **Web Service** from this GitHub repository:
   - **Build command:** `npm ci --include=dev && npm run db:migrate && npm run build`
   - **Start command:** `npm run start`
   - **Environment variables:**
     - `DATABASE_URL`: the database URL
     - `UPLOAD_DIR`: `/var/data/uploads`
     - `NODE_ENV`: `production`
3. **Disk.** Add a **Disk** mounted at `/var/data`. Client documents are stored there and survive deploys. (Render disks need a paid instance. Phase 4 can move uploads to object storage instead.)
4. **First admin.** Create the first real administrator once from the Render **Shell**:
   ```bash
   npx tsx scripts/create-admin.ts "Full Name" admin@yourdomain.com 'a-strong-password'
   ```
5. **Real content.** Add it through the Content Manager in Phase 3, or ask us to import FIRST FLIGHT's real listings.

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
