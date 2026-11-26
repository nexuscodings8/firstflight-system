import { answer } from "@/lib/assistant/answer";
import { clientIp, hit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = await clientIp();
  if (!hit(`assistant:${ip}`, 40, 10 * 60_000).ok) return Response.json({ text: "You've sent a lot of messages. Please wait a few minutes, or contact a consultant directly." }, { status: 429 });
  let message = "";
  try { message = String(((await req.json()) as { message?: unknown }).message ?? "").slice(0, 500); } catch { /* empty body */ }
  if (!message.trim()) return Response.json({ text: "Type a question, for example: nursing jobs in Canada." }, { status: 400 });
  return Response.json(await answer(message), { headers: { "Cache-Control": "no-store" } });
}
