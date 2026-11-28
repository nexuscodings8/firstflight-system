import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { planConfirmed, type FeePlan } from "./fees";

/** Full application with everything the portals show; callers must check permissions first. */
export const loadApplication = (id: string) =>
  db.query.applications.findFirst({
    where: eq(s.applications.id, id),
    with: {
      client: { columns: { id: true, name: true, email: true, phone: true } },
      consultant: { columns: { id: true, name: true, email: true, phone: true } },
      checklist: { orderBy: [asc(s.checklistItems.sortOrder)], with: { reviewedBy: { columns: { name: true } }, documents: { orderBy: [desc(s.documents.createdAt)] } } },
      updates: { orderBy: [desc(s.applicationUpdates.createdAt)], with: { author: { columns: { name: true, role: true } } } },
      invoices: { orderBy: [asc(s.invoices.createdAt)], with: { payments: { orderBy: [asc(s.payments.paidAt)] } } },
      refunds: { orderBy: [asc(s.refundRequests.createdAt)], with: { invoice: { columns: { number: true } } } },
      amendments: { orderBy: [asc(s.amendmentRequests.createdAt)] },
      paymentSubmissions: { orderBy: [asc(s.paymentSubmissions.createdAt)] },
      contracts: { orderBy: [asc(s.contracts.createdAt)], with: { uploadedBy: { columns: { name: true } } } },
      appointments: { orderBy: [asc(s.appointments.startsAt)], with: { consultant: { columns: { name: true, email: true, phone: true } } } },
      caseFiles: { orderBy: [asc(s.caseFiles.createdAt)], with: { uploadedBy: { columns: { name: true } } } },
      visaEstimates: { orderBy: [desc(s.visaEstimates.createdAt)], with: { setBy: { columns: { name: true } } } },
      historicalPayments: { orderBy: [asc(s.historicalPayments.paidAt)] },
      loanRequests: { orderBy: [asc(s.loanRequests.createdAt)] },
    },
  });

/** Facts the "next step" line needs beyond the application row. */
export const stepFacts = (a: { feePlan: unknown; caseFiles?: { kind: string }[] }) => ({
  scheduleConfirmed: planConfirmed(a.feePlan as FeePlan | null),
  offerLetter: !!a.caseFiles?.some((f) => f.kind === "OFFER_LETTER"), visa: !!a.caseFiles?.some((f) => f.kind === "VISA"),
});
export type FullApplication = NonNullable<Awaited<ReturnType<typeof loadApplication>>>;
