import { formatInTimeZone } from "date-fns-tz";

export function formatUTCDate(dateStr: string, fmt: string): string {
  return formatInTimeZone(new Date(dateStr), "UTC", fmt);
}

export function toUTCDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}

export function utcNow(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
}
