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

import type { Activity, ActivityStats } from '@/lib/types';

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function formatDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE, d MMMM');
}

export function formatFullDisplayDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE, d MMMM yyyy');
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
  // Return accurate current date
  return new Date();
}

export function getLogicalYesterday(): Date {
  return subDays(getLogicalToday(), 1);
}

export function isDateModifiable(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const today = getLogicalToday();
  const yesterday = subDays(today, 1);
  return isSameDay(d, today) || isSameDay(d, yesterday);
}

export function getDaysBetween(startDate: Date | string, endDate: Date | string = new Date()): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  const utc1 = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const utc2 = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export function getActivityStats(
  activity: Activity,
  completionDates: string[],
  today: Date = new Date()
): ActivityStats {
  const todayStr = formatDate(today);
  const totalCompleted = completionDates.length;

  if (activity.frequency === 'daily' || activity.frequency === 'short_term') {
    const startStr = activity.start_date || formatDate(activity.created_at) || todayStr;
    const daysElapsed = getDaysBetween(startStr, today) + 1;
    const totalExpected = Math.max(daysElapsed, totalCompleted);
    const percentage = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;
    return {
      completed: totalCompleted,
      total: totalExpected,
      percentage: Math.min(100, Math.max(0, percentage)),
      label: `${totalCompleted} / ${totalExpected} days`,
    };
  }

  if (activity.frequency === 'weekly') {
    const target = Math.max(1, activity.target_count || 1);
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const thisWeekCount = completionDates.filter(
      (d) => d >= startStr && d <= endStr
    ).length;
    const percentage = Math.round((thisWeekCount / target) * 100);
    return {
      completed: thisWeekCount,
      total: target,
      percentage: Math.min(100, Math.max(0, percentage)),
      label: `${thisWeekCount} / ${target} this week`,
    };
  }

  if (activity.frequency === 'monthly') {
    const target = Math.max(1, activity.target_count || 1);
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    const startStr = formatDate(start);
    const endStr = formatDate(end);
    const thisMonthCount = completionDates.filter(
      (d) => d >= startStr && d <= endStr
    ).length;
    const percentage = Math.round((thisMonthCount / target) * 100);
    return {
      completed: thisMonthCount,
      total: target,
      percentage: Math.min(100, Math.max(0, percentage)),
      label: `${thisMonthCount} / ${target} this month`,
    };
  }

  return {
    completed: totalCompleted,
    total: Math.max(1, totalCompleted),
    percentage: 100,
    label: `${totalCompleted} done`,
  };
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
