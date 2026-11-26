import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Full application with everything the portals show; callers must check permissions first. */
export const loadApplication = (id: string) =>
  db.query.applications.findFirst({
    where: eq(s.applications.id, id),
    with: {
      client: { columns: { id: true, name: true, email: true, phone: true } },
      consultant: { columns: { id: true, name: true, email: true } },
      checklist: { orderBy: [asc(s.checklistItems.sortOrder)], with: { documents: { orderBy: [desc(s.documents.createdAt)] } } },
      updates: { orderBy: [desc(s.applicationUpdates.createdAt)], with: { author: { columns: { name: true, role: true } } } },
      invoices: { orderBy: [asc(s.invoices.createdAt)], with: { payments: { orderBy: [asc(s.payments.paidAt)] } } },
      refunds: { orderBy: [asc(s.refundRequests.createdAt)], with: { invoice: { columns: { number: true } } } },
      amendments: { orderBy: [asc(s.amendmentRequests.createdAt)] },
    },
  });
export type FullApplication = NonNullable<Awaited<ReturnType<typeof loadApplication>>>;
