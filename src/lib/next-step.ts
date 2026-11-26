// The "Next step" line on an application, worded for the client or for staff.
type A = {
  stage: string; status: string;
  checklist: { state: string; mandatory: boolean }[];
  invoices: { status: string; description: string; dueDate: Date | null }[];
};

export function nextStep(app: A, who: "client" | "staff"): string | undefined {
  if (app.status === "COMPLETED") return who === "client" ? "Your application is complete. Thank you for travelling with FIRST FLIGHT." : undefined;
  if (app.status !== "ACTIVE") return who === "client" ? "This application is closed. Contact your consultant if you have questions." : undefined;
  const missing = app.checklist.filter((c) => c.mandatory && ["PENDING", "REQUESTED", "REJECTED"].includes(c.state)).length;
  const toCheck = app.checklist.filter((c) => c.state === "UPLOADED").length;
  const unpaid = app.invoices.filter((i) => i.status === "ISSUED" || i.status === "PARTIALLY_PAID").sort((a, b) => +(a.dueDate ?? 0) - +(b.dueDate ?? 0))[0];
  if (who === "staff") {
    if (toCheck) return `Check ${toCheck} uploaded document${toCheck === 1 ? "" : "s"}.`;
    if (missing) return `Waiting for the client to upload ${missing} required document${missing === 1 ? "" : "s"}.`;
    if (app.stage === "SUBMITTED") return "Assign a consultant and start the eligibility review.";
    if (app.stage === "ELIGIBILITY_REVIEW") return "Decide eligibility and move the application on, or close it with a message to the client.";
    if (unpaid) return `Waiting for payment: ${unpaid.description}.`;
    return "Move the application to its next stage when this one is done.";
  }
  if (missing) return `Upload ${missing} required document${missing === 1 ? "" : "s"}.`;
  if (app.stage === "SUBMITTED") return "A consultant is being assigned and will review your eligibility.";
  if (app.stage === "ELIGIBILITY_REVIEW") return "Your consultant is reviewing your eligibility. We'll tell you here as soon as it's done.";
  if (unpaid) return `Pay ${unpaid.description}${unpaid.dueDate ? ` by ${unpaid.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}, then keep your receipt.`;
  if (app.stage === "INITIAL_PAYMENT") return "Finance will send your invoice for the first instalment.";
  if (app.stage === "DOCUMENT_SIGNING") return "Visit the FIRST FLIGHT office to sign your working documents.";
  if (app.stage === "PROCESSING") return "Your file is being processed. We'll post every update here.";
  if (app.stage === "FINAL_COLLECTION") return "Your final documents are ready to collect at the FIRST FLIGHT office.";
  return undefined;
}
