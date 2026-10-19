import type { JadwalKegiatan } from '../types';
import { getWeekdayForDate } from './date';

/**
 * Jadwal lama tanpa hari pelaksanaan tetap berlaku setiap hari.
 */
export function isScheduleApplicableOnDate(
  jadwal: JadwalKegiatan,
  dateString: string,
): boolean {
  const days = jadwal.hariPelaksanaan;
  if (!Array.isArray(days) || days.length === 0) return true;

  const weekday = getWeekdayForDate(dateString);
  if (weekday < 0) return false;

  return days.some(
    (day) => Number.isInteger(day) && day === weekday,
  );
}
