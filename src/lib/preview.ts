import "server-only";
import { getCurrentUser } from "./auth";
import { canManageContent } from "./permissions";

/** True when ?preview=1 is asked for by Content Manager or Admin: drafts are then shown with a banner. */
export async function previewMode(sp: Record<string, string | string[] | undefined> | undefined) {
  if (sp?.preview !== "1") return false;
  const u = await getCurrentUser();
  return !!u && !u.mustChangePassword && canManageContent(u);
}
