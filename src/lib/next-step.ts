// The "Next step" line on an application, worded for the client or for staff.
type A = {
  stage: string; status: string;
  checklist: { state: string; mandatory: boolean }[];
  invoices: { status: string; description: string; dueDate: Date | null }[];
  scheduleConfirmed?: boolean; offerLetter?: boolean; visa?: boolean;
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
    if (app.stage === "DOCUMENT_SIGNING") return "Waiting for the client to sign the contract online, or upload the paper copy they signed.";
    if (unpaid) return `Waiting for payment: ${unpaid.description}.`;
    if (app.stage === "INITIAL_PAYMENT" && !app.scheduleConfirmed) return "Finance confirms the instalment schedule and issues the first invoice.";
    if (app.stage === "GETTING_OFFER") return app.offerLetter ? "Offer letter uploaded. Move to Visa processing when its payment conditions allow." : "Upload the client's offer letter when it arrives.";
    if (app.stage === "VISA_PROCESSING") return app.visa ? "Visa recorded. Move to Final collection when its payment conditions allow." : "Record the client's visa when it's issued.";
    return "Move the application to its next stage when this one is done.";
  }
  if (missing) return `Upload ${missing} required document${missing === 1 ? "" : "s"}.`;
  if (app.stage === "SUBMITTED") return "A consultant is being assigned and will review your eligibility.";
  if (app.stage === "ELIGIBILITY_REVIEW") return "Your consultant is reviewing your eligibility. We'll tell you here as soon as it's done.";
  if (app.stage === "DOCUMENT_SIGNING") return "Sign your service contract online below, or sign a paper copy at the FIRST FLIGHT office.";
  if (unpaid) return `Pay ${unpaid.description}${unpaid.dueDate ? ` by ${unpaid.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}, then keep your receipt.`;
  if (app.stage === "INITIAL_PAYMENT") return "Finance is confirming your payment schedule and will send the invoice for your first instalment.";
  if (app.stage === "PROCESSING") return "Your file is being processed. We'll post every update here.";
  if (app.stage === "GETTING_OFFER") return app.offerLetter ? "Your offer letter is ready: open it below." : "We're waiting for your offer letter. You'll be notified as soon as it arrives.";
  if (app.stage === "VISA_PROCESSING") return "Your visa application is in progress. We'll tell you here as soon as there's news.";
  if (app.stage === "FINAL_COLLECTION") return "Your final documents are ready to collect at the FIRST FLIGHT office.";
  return undefined;
}
