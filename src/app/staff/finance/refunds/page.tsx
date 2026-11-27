import { redirect } from "next/navigation";

// Refunds moved to /staff/refunds when consultants joined the workflow.
export default function OldRefunds() { redirect("/staff/refunds"); }
