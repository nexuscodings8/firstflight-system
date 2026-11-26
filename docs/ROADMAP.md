# Roadmap

## Phase 1: foundation (done)
- **Database:** shared schema for every phase.
- **Accounts:** logins, roles and server-side permissions.
- **Public site:** all three browsing paths and the visa checker.
- **Applications:** the apply flow with snapshots, the client portal with secure uploads, consultant assignment.
- **Records:** activity log, notifications.
- **Tests:** unit and end-to-end.

## Phase 2: staff workflows (done)
- **Consultant:**
  - verify or reject documents
  - request missing documents, which updates the client's checklist and notifies them
  - move applications through stages
  - post client updates and internal notes
  - handle enquiries
- **Finance:**
  - issue invoices on an application
  - record payments; duplicate references are blocked
  - issue receipts
  - update balances, which shows in the client portal
- **Admin:** user and role management, reassignment, a cross-department activity view.
- **Email:** notifications by email (Resend); switches on when `RESEND_API_KEY` and `EMAIL_FROM` are set.
- **Accounts:** change password for everyone; temporary passwords must be replaced at first sign-in.

## Phase 3: Content Manager (done)
- **Catalogue:** countries and continents, job offers, universities and programs, with document checklists.
- **Visa guidance:** guidance entries with source, last-checked date and review queue.
- **Website content:** promotions (with expiry), portfolio, testimonials (consent required), news.
- **Publishing:** draft → published → archived, with a preview of draft pages for content staff; only unused drafts can be deleted.

## Phase 4 (done): chatbot, WhatsApp and launch
- **Chatbot:** answers from published FIRST FLIGHT content, with a hand-off to staff as an enquiry.
- **WhatsApp:** a "Chat on WhatsApp" picker with admin-managed names, departments and numbers, and a prefilled message based on the page.
- **Storage:** object storage for uploads.
- **Live location data:** optional switch to a live provider.
- **Launch:** checks, real content import and deployment.

## Phase 5 (done): fees, refunds, changes, flights and device testing
- **Fees:** private service fee rules with one to three instalments; fee plans applied per application as invoices, with the agreed price kept; audit of fee changes; clearance-only view for consultants.
- **Refunds:** request → approval → refund form → payout, in the monthly report.
- **Amendments:** client change requests decided by the consultant or admin.
- **Flights:** flight booking requests as enquiries.
- **Testing:** layout and navigation on phone and tablet sizes.

## Still open
- Replace sample content with FIRST FLIGHT's real listings, accounts and contacts (see Launch checks).
- A separate test copy of the site, so sample data never sits on the live system.
- Optional: a live country/city data provider instead of the built-in list.
