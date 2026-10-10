import { Employee, Holiday, LeaveRecord, LeaveStatus, LeaveType, RosterShift } from '../types';
import { addDays, addMonths, dateRange, parseISODate, shiftHours, weekdayOf } from './dates';

// Rules follow the Hong Kong Employment Ordinance as of 2026. They are a
// planning aid only — the Labour Department's guidance is authoritative.

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'annual', label: '年假' },
  { value: 'sick', label: '病假' },
  { value: 'statutory', label: '法定假日' },
  { value: 'compensation', label: '補假' },
  { value: 'no_pay', label: '無薪假' },
  { value: 'maternity', label: '產假' },
  { value: 'paternity', label: '侍產假' },
  { value: 'other', label: '其他' },
];

export const LEAVE_TYPE_LABELS = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.value, t.label])
) as Record<LeaveType, string>;

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: '待批',
  approved: '已批',
  rejected: '已拒',
};

/** The '468' continuous-contract threshold (effective 18 Jan 2026): 68 hours in 4 weeks. */
export const CONTINUOUS_CONTRACT_HOURS = 68;
export const MAX_SICK_DAYS = 120;

export const completedMonths = (joinDate: string, asOf: string): number => {
  if (!joinDate || asOf < joinDate) return 0;
  const a = parseISODate(asOf);
  const j = parseISODate(joinDate);
  let months = (a.getFullYear() - j.getFullYear()) * 12 + (a.getMonth() - j.getMonth());
  if (addMonths(joinDate, months) > asOf) months -= 1;
  return Math.max(0, months);
};

export const completedYears = (joinDate: string, asOf: string): number =>
  Math.floor(completedMonths(joinDate, asOf) / 12);

/** Paid annual leave earned on completing `years` of service: 7 days for years 1–2, +1 a year up to 14. */
export const statutoryAnnualLeave = (years: number): number => {
  if (years < 1) return 0;
  if (years <= 2) return 7;
  return Math.min(14, years + 5);
};

/** Working days a leave request uses: weekly rest days and statutory holidays don't count. */
export const countLeaveDays = (
  start: string,
  end: string,
  restDays: number[],
  holidays: Holiday[]
): number => {
  const holidaySet = new Set(holidays.map((h) => h.date));
  return dateRange(start, end).filter(
    (d) => !restDays.includes(weekdayOf(d)) && !holidaySet.has(d)
  ).length;
};

export const leaveCoversDate = (leave: LeaveRecord, date: string) =>
  leave.startDate <= date && leave.endDate >= date;

export interface AnnualLeaveSummary {
  serviceYears: number;
  leaveYearStart: string;
  leaveYearEnd: string; // exclusive: the next work anniversary
  statutory: number;
  extra: number;
  entitlement: number;
  used: number;
  pending: number;
  balance: number;
  proRataAccrued: number; // first-year staff: leave building up toward their first 7 days
}

/**
 * Annual leave for the current leave year, which runs from the last work
 * anniversary to the next. Leave earned on completing year N is taken during
 * year N+1, so the entitlement shown is for the service already completed.
 */
export const annualLeaveSummary = (
  employee: Employee,
  leaves: LeaveRecord[],
  asOf: string
): AnnualLeaveSummary => {
  const serviceYears = completedYears(employee.joinDate, asOf);
  const leaveYearStart = addMonths(employee.joinDate, serviceYears * 12);
  const leaveYearEnd = addMonths(employee.joinDate, (serviceYears + 1) * 12);
  const statutory = statutoryAnnualLeave(serviceYears);
  const extra = employee.extraAnnualLeave || 0;

  const inYear = leaves.filter(
    (l) =>
      l.employeeId === employee.id &&
      l.type === 'annual' &&
      l.startDate >= leaveYearStart &&
      l.startDate < leaveYearEnd
  );
  const sumDays = (status: LeaveStatus) =>
    inYear.filter((l) => l.status === status).reduce((s, l) => s + l.days, 0);
  const used = sumDays('approved');
  const pending = sumDays('pending');
  const entitlement = statutory + extra;

  const proRataAccrued =
    serviceYears < 1
      ? Math.round(((7 * completedMonths(employee.joinDate, asOf)) / 12) * 10) / 10
      : 0;

  return {
    serviceYears,
    leaveYearStart,
    leaveYearEnd,
    statutory,
    extra,
    entitlement,
    used,
    pending,
    balance: entitlement - used,
    proRataAccrued,
  };
};

export interface SickLeaveSummary {
  accrued: number;
  used: number;
  balance: number;
}

/**
 * Paid sickness days accumulate 2 per completed month in the first year and
 * 4 per month afterwards, with the running balance capped at 120 days.
 */
export const sickLeaveSummary = (
  employee: Employee,
  leaves: LeaveRecord[],
  asOf: string
): SickLeaveSummary => {
  const months = completedMonths(employee.joinDate, asOf);
  const events: { date: string; delta: number }[] = [];
  for (let i = 1; i <= months; i++) {
    events.push({ date: addMonths(employee.joinDate, i), delta: i <= 12 ? 2 : 4 });
  }
  leaves
    .filter(
      (l) =>
        l.employeeId === employee.id &&
        l.type === 'sick' &&
        l.status === 'approved' &&
        l.startDate <= asOf
    )
    .forEach((l) => events.push({ date: l.startDate, delta: -l.days }));
  events.sort((a, b) => a.date.localeCompare(b.date) || b.delta - a.delta);

  let accrued = 0;
  let used = 0;
  let balance = 0;
  for (const e of events) {
    if (e.delta > 0) {
      accrued += e.delta;
      balance = Math.min(MAX_SICK_DAYS, balance + e.delta);
    } else {
      used -= e.delta;
      balance = Math.max(0, balance + e.delta);
    }
  }
  return { accrued, used, balance };
};

export const employeeHoursBetween = (
  employeeId: string,
  shifts: RosterShift[],
  start: string,
  end: string
): number =>
  shifts
    .filter((s) => s.employeeId === employeeId && s.date >= start && s.date <= end)
    .reduce((sum, s) => sum + shiftHours(s.start, s.end, s.breakMinutes), 0);

export interface ContinuousContractCheck {
  weeks: { start: string; hours: number }[];
  total: number;
  qualifies: boolean;
}

/** Rostered hours over the four weeks ending with the week that starts on `weekStart`. */
export const continuousContractCheck = (
  employeeId: string,
  shifts: RosterShift[],
  weekStart: string
): ContinuousContractCheck => {
  const weeks = [3, 2, 1, 0].map((i) => {
    const start = addDays(weekStart, -7 * i);
    return { start, hours: employeeHoursBetween(employeeId, shifts, start, addDays(start, 6)) };
  });
  const total = weeks.reduce((s, w) => s + w.hours, 0);
  return { weeks, total, qualifies: total >= CONTINUOUS_CONTRACT_HOURS };
};
