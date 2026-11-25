export const SERVICE_PREFIX = { WORK: "FF-WA", STUDY: "FF-SA", VISA: "FF-VP" } as const;
export const formatRef = (prefix: string, year: number, n: number) => `${prefix}-${year}-${String(n).padStart(4, "0")}`;
