/**
 * Menghasilkan tanggal kalender berdasarkan zona waktu WIB.
 * Format: YYYY-MM-DD.
 */
export function getBusinessDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Gagal menentukan tanggal WIB.");
  }

  return `${year}-${month}-${day}`;
}


/**
 * Menghasilkan menit sejak tengah malam berdasarkan zona waktu WIB.
 */
export function getBusinessTimeMinutes(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("Gagal menentukan waktu WIB.");
  }

  return hour * 60 + minute;
}


/** Hari kalender: Minggu=0, Senin=1, ..., Sabtu=6. */
export function getWeekdayForDate(dateString: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return -1;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return -1;

  return date.getUTCDay();
}
