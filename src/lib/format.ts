const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function formatUtc(date: Date): string {
  return `${dateTime.format(date)} UTC`;
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) {
    return "0%";
  }
  return `${Math.round((part / whole) * 100)}%`;
}
