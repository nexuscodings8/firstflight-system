// Role-based access rules. Pure functions so they can be unit-tested and reused by pages,
// server actions and route handlers. Every check runs on the server.
export type Role = "CLIENT" | "CONSULTANT" | "FINANCE" | "ADMIN" | "CONTENT_MANAGER";
export type Actor = { id: string; role: Role; services?: string[] };
export type AppAccess = { clientId: string; consultantId: string | null; service?: string };

/** A consultant may only act on services an admin granted them; losing a service takes effect on the next request. */
export const hasService = (a: Actor, service?: string) => a.role !== "CONSULTANT" || !service || !a.services || a.services.includes(service);

export const STAFF_ROLES: Role[] = ["CONSULTANT", "FINANCE", "ADMIN", "CONTENT_MANAGER"];
export const isStaff = (r: Role) => STAFF_ROLES.includes(r);

/** Who may open an application and its client-visible parts. */
export function canViewApplication(a: Actor, app: AppAccess) {
  if (a.role === "ADMIN" || a.role === "FINANCE") return true;
  if (a.role === "CONSULTANT") return app.consultantId === a.id && hasService(a, app.service);
  if (a.role === "CLIENT") return app.clientId === a.id;
  return false;
}

/** Uploaded documents: the client, the assigned consultant and administrators. Finance does not need them. */
export function canViewDocuments(a: Actor, app: AppAccess) {
  if (a.role === "ADMIN") return true;
  if (a.role === "CONSULTANT") return app.consultantId === a.id && hasService(a, app.service);
  if (a.role === "CLIENT") return app.clientId === a.id;
  return false;
}

export function canUploadToApplication(a: Actor, app: AppAccess) {
  return canViewDocuments(a, app);
}

/** Day-to-day case work (documents, stages, client updates): the assigned consultant, or an administrator. */
export function canWorkOnCase(a: Actor, app: AppAccess) {
  return a.role === "ADMIN" || (a.role === "CONSULTANT" && app.consultantId === a.id && hasService(a, app.service));
}

/** Invoices and receipts: the client they belong to, Finance and administrators. */
export function canViewInvoice(a: Actor, app: AppAccess) {
  return a.role === "ADMIN" || a.role === "FINANCE" || (a.role === "CLIENT" && app.clientId === a.id);
}

/** Enquiries are answered by consultants and administrators. */
export const canHandleEnquiries = (a: Actor) => a.role === "ADMIN" || a.role === "CONSULTANT";

/** Internal notes never reach clients. */
export const canSeeInternalNotes = (a: Actor) => isStaff(a.role) && a.role !== "CONTENT_MANAGER";
export const canAssign = (a: Actor) => a.role === "ADMIN";
export const canManageFinance = (a: Actor) => a.role === "FINANCE" || a.role === "ADMIN";
export const canManageContent = (a: Actor) => a.role === "CONTENT_MANAGER" || a.role === "ADMIN";
export const canManageUsers = (a: Actor) => a.role === "ADMIN";

/** Where each role lands after signing in. */
export const homeFor = (r: Role) => (r === "CLIENT" ? "/portal" : "/staff");
