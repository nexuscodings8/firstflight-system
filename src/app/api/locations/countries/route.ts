import { listCountries } from "@/lib/locations";

// GET /api/locations/countries -> [{ iso, name }]
export function GET() {
  return Response.json(listCountries(), { headers: { "Cache-Control": "public, max-age=86400" } });
}
