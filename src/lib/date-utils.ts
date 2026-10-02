import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isSameDay,
  subDays,
  addDays,
  getDay,
  getDaysInMonth,
  parseISO,
  subHours,
} from 'date-fns';

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE, d MMMM');
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM');
}

export function formatMonthYear(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MMMM yyyy');
}

export function getLogicalToday(): Date {
  // If the time is before 4 AM, logical today is actually yesterday.
  return subHours(new Date(), 4);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 4) return 'Late Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function getWeekDays(date: Date = new Date()): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getMonthDays(date: Date = new Date()): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  return eachDayOfInterval({ start, end });
}

export function getCalendarDays(date: Date = new Date()): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

export function getWeekRange(date: Date = new Date()) {
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export function getMonthRange(date: Date = new Date()) {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date),
  };
}

export function calculateStreak(
  completionDates: string[],
  today: Date = new Date()
): number {
  if (completionDates.length === 0) return 0;

  const sortedDates = [...completionDates].sort().reverse();
  let streak = 0;
  let checkDate = today;

  // Check if today is completed, if not check yesterday
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(subDays(today, 1));

  if (!sortedDates.includes(todayStr)) {
    if (!sortedDates.includes(yesterdayStr)) {
      return 0;
    }
    checkDate = subDays(today, 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(subDays(checkDate, i));
    if (sortedDates.includes(dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export { isToday, isSameDay, subDays, addDays, getDay, getDaysInMonth, parseISO, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subHours };
