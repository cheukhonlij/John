// Local-time date helpers. All operational dates are stored as 'YYYY-MM-DD'
// strings, which sort and compare correctly as plain strings.

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const todayISO = (): string => toISODate(new Date());

export const addDays = (iso: string, days: number): string => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
};

/** Adds calendar months, clamping to the last day of a shorter month (31 Jan + 1 → 28/29 Feb). */
export const addMonths = (iso: string, months: number): string => {
  const d = parseISODate(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return toISODate(target);
};

export const weekdayOf = (iso: string): number => parseISODate(iso).getDay();

/** Monday of the week containing `iso`. */
export const startOfWeek = (iso: string): string => {
  const wd = weekdayOf(iso);
  return addDays(iso, wd === 0 ? -6 : 1 - wd);
};

/** Inclusive list of dates; capped so a mistyped year can't spin forever. */
export const dateRange = (start: string, end: string, maxDays = 800): string[] => {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < maxDays; d = addDays(d, 1)) out.push(d);
  return out;
};

export const formatDateZh = (iso: string, withWeekday = true): string => {
  if (!iso) return '';
  const d = parseISODate(iso);
  const base = `${d.getMonth() + 1}月${d.getDate()}日`;
  return withWeekday ? `${base}（${WEEKDAY_LABELS[d.getDay()]}）` : base;
};

export const formatFullDateZh = (iso: string): string => {
  const d = parseISODate(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAY_LABELS[d.getDay()]}`;
};

export const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Paid hours of a shift; an end time at or before the start is treated as overnight. */
export const shiftHours = (start: string, end: string, breakMinutes = 0): number => {
  let mins = timeToMinutes(end) - timeToMinutes(start);
  if (mins <= 0) mins += 24 * 60;
  return Math.max(0, mins - breakMinutes) / 60;
};

export const formatNumber = (n: number, maxDecimals = 2): string =>
  String(parseFloat(n.toFixed(maxDecimals)));

export const formatHours = (h: number): string => `${formatNumber(h, 1)}h`;
