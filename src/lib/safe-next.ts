/** Only allow same-site relative redirects after sign-in (blocks open redirects like //evil.com). */
export const safeNext = (n: unknown) => (typeof n === "string" && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : null);
