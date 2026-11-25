import { listCities } from "@/lib/locations";

// GET /api/locations/cities?country=GB -> ["Aberdeen", ...]
export function GET(req: Request) {
  const iso = new URL(req.url).searchParams.get("country")?.toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(iso)) return Response.json({ error: "country must be an ISO alpha-2 code" }, { status: 400 });
  return Response.json(listCities(iso), { headers: { "Cache-Control": "public, max-age=86400" } });
}
