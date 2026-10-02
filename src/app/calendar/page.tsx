'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import ActivityCheckbox from '@/components/ActivityCheckbox';
import { PageLoader } from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { toggleCompletion } from '@/lib/api';
import {
  formatDate,
  formatMonthYear,
  getCalendarDays,
  isToday,
  isSameDay,
  startOfMonth,
  endOfMonth,
  parseISO,
  format,
  addDays,
  subDays,
  getLogicalToday,
} from '@/lib/date-utils';
import { addMonths, subMonths } from 'date-fns';
import type { Activity, ActivityCompletion, DayStatus } from '@/lib/types';

const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayColor(status: DayStatus['status']) {
  switch (status) {
    case 'all': return 'bg-green-500 text-white';
    case 'partial': return 'bg-amber-400 text-white';
    case 'missed': return 'bg-red-400 text-white';
    default: return 'bg-neutral-100 text-neutral-400';
  }
}

function getDayDotColor(status: DayStatus['status']) {
  switch (status) {
    case 'all': return 'bg-green-500';
    case 'partial': return 'bg-amber-400';
    case 'missed': return 'bg-red-400';
    default: return 'bg-neutral-200';
  }
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(getLogicalToday());
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completions, setCompletions] = useState<ActivityCompletion[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayActivities, setDayActivities] = useState<{ activity: Activity; completed: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const monthStart = formatDate(startOfMonth(currentMonth));
    const monthEnd = formatDate(endOfMonth(currentMonth));

    const [actsRes, compRes] = await Promise.all([
      supabase
        .from('activities')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .eq('is_active', true),
      supabase
        .from('activity_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('completion_date', monthStart)
        .lte('completion_date', monthEnd),
    ]);

    setActivities(actsRes.data || []);
    setCompletions(compRes.data || []);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getDayStatus(date: Date): DayStatus {
    const dateStr = formatDate(date);
    const today = getLogicalToday();

    // Only show status for past and today
    if (date > today && !isSameDay(date, today)) {
      return { date: dateStr, total: 0, completed: 0, percentage: 0, status: 'none' };
    }

    const dailyActs = activities.filter((a) => a.frequency === 'daily');
    if (dailyActs.length === 0) {
      return { date: dateStr, total: 0, completed: 0, percentage: 0, status: 'none' };
    }

    const dayCompletions = completions.filter((c) => c.completion_date === dateStr);
    const completedCount = dayCompletions.length;
    const total = dailyActs.length;
    const percentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    let status: DayStatus['status'] = 'none';
    if (total === 0) status = 'none';
    else if (completedCount === 0) status = 'missed';
    else if (completedCount === total) status = 'all';
    else status = 'partial';

    return { date: dateStr, total, completed: completedCount, percentage, status };
  }

  async function handleDayTap(date: Date) {
    setSelectedDate(date);
    setDayLoading(true);

    const supabase = createClient();
    const dateStr = formatDate(date);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDayLoading(false); return; }

    const { data: dayComps } = await supabase
      .from('activity_completions')
      .select('*')
      .eq('user_id', user.id)
      .eq('completion_date', dateStr)
      .eq('completed', true);

    const completedActIds = new Set((dayComps || []).map((c: ActivityCompletion) => c.activity_id));
    const dailyActs = activities.filter((a) => a.frequency === 'daily');
    setDayActivities(dailyActs.map((a) => ({ activity: a, completed: completedActIds.has(a.id) })));
    setDayLoading(false);
  }

  async function handleToggleDayActivity(activityId: string, completed: boolean) {
    if (!selectedDate) return;
    const dateStr = formatDate(selectedDate);
    await toggleCompletion(activityId, dateStr, completed);
    setDayActivities((prev) =>
      prev.map((da) =>
        da.activity.id === activityId ? { ...da, completed } : da
      )
    );
    // Refresh completions for the month indicator
    await loadData();
  }

  const calendarDays = getCalendarDays(currentMonth);
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-800">Calendar</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth((d) => subMonths(d, 1))}
              className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-semibold text-neutral-700 min-w-[110px] text-center">
              {formatMonthYear(currentMonth)}
            </span>
            <button
              onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
              className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {[
            { label: 'All done', color: 'bg-green-500' },
            { label: 'Partial', color: 'bg-amber-400' },
            { label: 'Missed', color: 'bg-red-400' },
            { label: 'No activity', color: 'bg-neutral-200' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-xs text-neutral-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <PageLoader />
        ) : (
          <div className="card p-4 animate-fade-in">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {dayHeaders.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-neutral-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const isCurrentMonth = date >= monthStart && date <= monthEnd;
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                const isCurrentDay = isToday(date);
                const status = isCurrentMonth ? getDayStatus(date) : null;

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => isCurrentMonth && handleDayTap(date)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 ${
                      !isCurrentMonth ? 'opacity-20 cursor-default' : 'cursor-pointer active:scale-90'
                    } ${isSelected ? 'ring-2 ring-primary-400 ring-offset-1' : ''}`}
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                        isCurrentDay
                          ? 'bg-primary-500 text-white'
                          : isCurrentMonth && status && status.status !== 'none'
                            ? `${getDayColor(status.status)}`
                            : 'text-neutral-600'
                      }`}
                    >
                      {format(date, 'd')}
                    </span>
                    {isCurrentMonth && status && status.status !== 'none' && !isCurrentDay && (
                      <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${getDayDotColor(status.status)}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Day Detail Panel */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={(e) => e.target === e.currentTarget && setSelectedDate(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedDate(null)} />
          <div className="relative bg-white rounded-t-3xl w-full max-w-[600px] max-h-[70vh] overflow-y-auto animate-slide-up z-10">
            <div className="flex items-center justify-between p-5 border-b border-neutral-100">
              <div>
                <h3 className="text-base font-bold text-neutral-800">
                  {format(selectedDate, 'EEEE, d MMMM')}
                </h3>
                {dayActivities.length > 0 && (
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {dayActivities.filter((d) => d.completed).length} / {dayActivities.length} completed
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              {dayLoading ? (
                <PageLoader />
              ) : dayActivities.length === 0 ? (
                <EmptyState type="calendar" />
              ) : (
                <div className="space-y-2">
                  {dayActivities.map(({ activity, completed }) => (
                    <div key={activity.id} className="card p-4 flex items-center gap-3">
                      <ActivityCheckbox
                        checked={completed}
                        onToggle={() => handleToggleDayActivity(activity.id, !completed)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-[15px] truncate ${completed ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>
                          {activity.title}
                        </p>
                        {activity.category && (
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {activity.category.icon} {activity.category.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNavigation />
    </div>
  );
}
