'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, AlertCircle, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import BottomNavigation from '@/components/BottomNavigation';
import ActivityCard from '@/components/ActivityCard';
import ActivityForm, { type ActivityFormData } from '@/components/ActivityForm';
import DeleteConfirm from '@/components/DeleteConfirm';
import ProgressRing from '@/components/ProgressRing';
import { SkeletonList } from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import {
  getActivities,
  getCategories,
  getDayCompletions,
  toggleCompletion,
  createActivity,
  updateActivity,
  deleteActivity,
  createCategory,
  getActivityCompletionDates,
} from '@/lib/api';
import {
  formatDate,
  formatDisplayDate,
  formatShortDate,
  getGreeting,
  calculateStreak,
  getLogicalToday,
  getLogicalYesterday,
  getActivityStats,
} from '@/lib/date-utils';
import type { Activity, Category } from '@/lib/types';

export default function DashboardPage() {
  const [selectedDay, setSelectedDay] = useState<'today' | 'yesterday'>('today');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todayCompletedIds, setTodayCompletedIds] = useState<Set<string>>(new Set());
  const [yesterdayCompletedIds, setYesterdayCompletedIds] = useState<Set<string>>(new Set());
  const [completionDatesMap, setCompletionDatesMap] = useState<Record<string, string[]>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const { showToast, ToastComponent } = useToast();

  const today = getLogicalToday();
  const yesterday = getLogicalYesterday();
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);

  // Live real-time clock with seconds (Main screen only)
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .single();
        setUserName(profile.data?.name || user.email?.split('@')[0] || 'there');
      }

      const [acts, cats, todayComps, yesterdayComps, datesMap] = await Promise.all([
        getActivities(),
        getCategories(),
        getDayCompletions(todayStr),
        getDayCompletions(yesterdayStr),
        getActivityCompletionDates(),
      ]);

      setActivities(acts);
      setCategories(cats);
      setTodayCompletedIds(new Set(todayComps.map((c) => c.activity_id)));
      setYesterdayCompletedIds(new Set(yesterdayComps.map((c) => c.activity_id)));
      setCompletionDatesMap(datesMap);

      // Load streaks
      const streakMap: Record<string, number> = {};
      acts.forEach((act) => {
        if (act.frequency === 'daily') {
          const dates = datesMap[act.id] || [];
          streakMap[act.id] = calculateStreak(dates, today);
        }
      });
      setStreaks(streakMap);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [todayStr, yesterdayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggle(activityId: string, completed: boolean) {
    const isToday = selectedDay === 'today';
    const targetDateStr = isToday ? todayStr : yesterdayStr;
    const prevToday = new Set(todayCompletedIds);
    const prevYesterday = new Set(yesterdayCompletedIds);
    const prevDatesMap = { ...completionDatesMap };

    // Optimistic state updates
    if (isToday) {
      setTodayCompletedIds((s) => {
        const n = new Set(s);
        if (completed) n.add(activityId); else n.delete(activityId);
        return n;
      });
    } else {
      setYesterdayCompletedIds((s) => {
        const n = new Set(s);
        if (completed) n.add(activityId); else n.delete(activityId);
        return n;
      });
    }

    // Optimistically update completion dates map
    setCompletionDatesMap((prev) => {
      const currentDates = prev[activityId] || [];
      if (completed) {
        return {
          ...prev,
          [activityId]: Array.from(new Set([...currentDates, targetDateStr])),
        };
      } else {
        return {
          ...prev,
          [activityId]: currentDates.filter((d) => d !== targetDateStr),
        };
      }
    });

    const ok = await toggleCompletion(activityId, targetDateStr, completed);
    if (!ok) {
      if (isToday) setTodayCompletedIds(prevToday);
      else setYesterdayCompletedIds(prevYesterday);
      setCompletionDatesMap(prevDatesMap);
      showToast('Failed to update', 'error');
    } else {
      showToast(
        !isToday
          ? (completed ? "Yesterday's task completed! 🎉" : "Yesterday's task marked incomplete")
          : (completed ? 'Activity completed! 🎉' : 'Marked incomplete'),
        completed ? 'success' : 'info'
      );

      // Re-calculate streak
      const act = activities.find((a) => a.id === activityId);
      if (act && act.frequency === 'daily') {
        const updatedDates = completed
          ? Array.from(new Set([...(completionDatesMap[activityId] || []), targetDateStr]))
          : (completionDatesMap[activityId] || []).filter((d) => d !== targetDateStr);
        setStreaks((s) => ({
          ...s,
          [activityId]: calculateStreak(updatedDates, today),
        }));
      }
    }
  }

  async function handleSaveActivity(data: ActivityFormData) {
    if (editingActivity) {
      const updated = await updateActivity(editingActivity.id, {
        title: data.title,
        description: data.description,
        frequency: data.frequency,
        category_id: data.category_id || undefined,
        target_count: data.target_count,
        start_date: data.start_date,
      });
      if (updated) {
        setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        showToast('Activity updated', 'success');
      }
    } else {
      const created = await createActivity({
        title: data.title,
        description: data.description,
        frequency: data.frequency,
        category_id: data.category_id,
        target_count: data.target_count,
        start_date: data.start_date,
      });
      if (created) {
        setActivities((prev) => [created, ...prev]);
        showToast('Activity created! 🚀', 'success');
      }
    }
    setShowForm(false);
    setEditingActivity(null);
  }

  async function handleDelete() {
    if (!deletingActivity) return;
    setDeleteLoading(true);
    const ok = await deleteActivity(deletingActivity.id);
    if (ok) {
      setActivities((prev) => prev.filter((a) => a.id !== deletingActivity.id));
      showToast('Activity deleted', 'info');
    } else {
      showToast('Failed to delete', 'error');
    }
    setDeleteLoading(false);
    setDeletingActivity(null);
  }

  async function handleAddCategory(name: string) {
    return await createCategory(name);
  }

  const activeCompletedIds = selectedDay === 'today' ? todayCompletedIds : yesterdayCompletedIds;
  const activeDate = selectedDay === 'today' ? today : yesterday;

  // Daily activities for today/yesterday view
  const todayActivities = activities.filter((a) => a.frequency === 'daily');
  const otherActivities = activities.filter((a) => a.frequency !== 'daily');

  const completedCount = todayActivities.filter((a) => activeCompletedIds.has(a.id)).length;
  const totalCount = todayActivities.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Calculate yesterday's missed tasks
  const yesterdayCompletedCount = todayActivities.filter((a) => yesterdayCompletedIds.has(a.id)).length;
  const yesterdayMissedCount = Math.max(0, todayActivities.length - yesterdayCompletedCount);

  // Time formatting for live clock
  const now = currentTime || new Date();
  const accurateDateStr = format(now, 'EEEE, d MMMM yyyy');
  const hours = format(now, 'hh');
  const minutes = format(now, 'mm');
  const seconds = format(now, 'ss');
  const ampm = format(now, 'a');

  return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-10 pb-5 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-neutral-800">
              {userName ? `Hey, ${userName}!` : 'DailyTrack'}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">Stay consistent every single day</p>
          </div>
          <button
            onClick={loadData}
            aria-label="Refresh data"
            className="p-2.5 rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Live Clock & Accurate Date Display Widget (Main Screen Only) */}
        <div className="mt-4 relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-indigo-950 to-neutral-900 p-4 sm:p-5 text-white shadow-lg shadow-indigo-950/20 border border-neutral-800 animate-fade-in">
          {/* Ambient lighting effects */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-primary-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Greeting & Accurate Full Date */}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
                <span className="text-xs text-neutral-300 font-medium">
                  {getGreeting()} 👋
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Calendar size={16} className="text-primary-400 flex-shrink-0" />
                <p className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {accurateDateStr}
                </p>
              </div>
            </div>

            {/* Right: Digital Clock with Live Seconds */}
            <div className="flex items-center gap-1 self-start sm:self-auto bg-black/40 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shadow-inner">
              <Clock size={18} className="text-primary-400 mr-1 flex-shrink-0" />
              <div className="flex items-baseline font-mono font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
                <span>{hours}</span>
                <span className="text-primary-400 mx-0.5 animate-pulse">:</span>
                <span>{minutes}</span>
                <span className="text-primary-400 mx-0.5 animate-pulse">:</span>
                <span className="text-primary-300 bg-primary-500/20 px-1.5 py-0.5 rounded-md border border-primary-500/30 text-xl sm:text-2xl font-mono">
                  {seconds}
                </span>
              </div>
              <span className="text-[10px] font-bold text-neutral-400 ml-1.5 uppercase tracking-wider self-end mb-1">
                {ampm}
              </span>
            </div>
          </div>
        </div>

        {/* Day Selector Pill (Today vs Yesterday) */}
        <div className="flex p-1 bg-neutral-100 rounded-xl mt-4">
          <button
            onClick={() => setSelectedDay('today')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              selectedDay === 'today'
                ? 'bg-white text-neutral-800 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>☀️ Today</span>
            <span className="text-[10px] opacity-70 font-normal">({formatShortDate(today)})</span>
          </button>
          <button
            onClick={() => setSelectedDay('yesterday')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              selectedDay === 'yesterday'
                ? 'bg-white text-neutral-800 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>⏳ Yesterday</span>
            <span className="text-[10px] opacity-70 font-normal">({formatShortDate(yesterday)})</span>
            {yesterdayMissedCount > 0 && selectedDay !== 'yesterday' && (
              <span
                className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                title={`${yesterdayMissedCount} missed tasks yesterday`}
              />
            )}
          </button>
        </div>

        {/* Progress Card */}
        {!loading && totalCount > 0 && (
          <div
            className={`mt-4 rounded-2xl p-5 flex items-center gap-5 animate-fade-in text-white ${
              selectedDay === 'today'
                ? 'bg-gradient-to-r from-primary-500 to-indigo-500'
                : 'bg-gradient-to-r from-amber-500 to-orange-500'
            }`}
          >
            <ProgressRing percentage={percentage} size={90} strokeWidth={8} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-white/80 text-sm font-medium">
                  {selectedDay === 'today' ? "Today's Progress" : "Yesterday's Progress"}
                </p>
                {selectedDay === 'yesterday' && (
                  <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-semibold">
                    Catch-up
                  </span>
                )}
              </div>
              <p className="text-white text-2xl font-bold mt-0.5">
                {completedCount} / {totalCount}
              </p>
              <p className="text-white/70 text-xs mt-1">activities completed</p>
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/80 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Yesterday Catch-up Reminder Banner (when viewing Today) */}
        {selectedDay === 'today' && !loading && yesterdayMissedCount > 0 && (
          <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-amber-900 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl flex-shrink-0">⚠️</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-900 leading-tight">
                  Missed {yesterdayMissedCount} {yesterdayMissedCount === 1 ? 'task' : 'tasks'} yesterday?
                </p>
                <p className="text-[11px] text-amber-700/90 truncate mt-0.5">
                  You can modify yesterday&apos;s tasks if you forgot to tick them!
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDay('yesterday')}
              className="flex-shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              Tick Yesterday
            </button>
          </div>
        )}

        {/* Yesterday Mode Notice */}
        {selectedDay === 'yesterday' && (
          <div className="bg-blue-50 border border-blue-200/90 rounded-2xl p-3 flex items-center gap-2.5 text-blue-900 animate-fade-in shadow-sm">
            <Clock size={18} className="text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-800 font-medium leading-relaxed">
              <strong>Catch-up Mode ({formatDisplayDate(yesterday)}):</strong> You can tick or untick tasks from yesterday only. Older dates cannot be changed.
            </p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
            {/* Daily Activities */}
            {todayActivities.length > 0 && (
              <section>
                <div className="flex items-center justify-between px-1 mb-2">
                  <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                    {selectedDay === 'today' ? "Today's Activities" : "Yesterday's Activities"}
                  </h2>
                  <span className="text-xs text-neutral-400 font-medium">
                    {completedCount} of {totalCount} completed
                  </span>
                </div>
                <div className="space-y-2">
                  {todayActivities.map((activity) => {
                    const stats = getActivityStats(
                      activity,
                      completionDatesMap[activity.id] || [],
                      activeDate
                    );
                    return (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        completed={activeCompletedIds.has(activity.id)}
                        streak={streaks[activity.id] ?? 0}
                        stats={stats}
                        onToggle={handleToggle}
                        onEdit={(a) => {
                          setEditingActivity(a);
                          setShowForm(true);
                        }}
                        onDelete={setDeletingActivity}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Weekly/Monthly Activities */}
            {otherActivities.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-2">
                  Weekly & Monthly
                </h2>
                <div className="space-y-2">
                  {otherActivities.map((activity) => {
                    const stats = getActivityStats(
                      activity,
                      completionDatesMap[activity.id] || [],
                      activeDate
                    );
                    return (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        completed={activeCompletedIds.has(activity.id)}
                        streak={streaks[activity.id] ?? 0}
                        stats={stats}
                        onToggle={handleToggle}
                        onEdit={(a) => {
                          setEditingActivity(a);
                          setShowForm(true);
                        }}
                        onDelete={setDeletingActivity}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {activities.length === 0 && (
              <EmptyState
                type="activities"
                action={
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center gap-2 px-5 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm"
                  >
                    <Plus size={16} />
                    Add Activity
                  </button>
                }
              />
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setEditingActivity(null);
          setShowForm(true);
        }}
        id="add-activity-fab"
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-200 flex items-center justify-center transition-all duration-200 active:scale-90 z-30"
      >
        <Plus size={24} />
      </button>

      <BottomNavigation />

      {/* Modals */}
      {showForm && (
        <ActivityForm
          activity={editingActivity}
          categories={categories}
          onSave={handleSaveActivity}
          onClose={() => {
            setShowForm(false);
            setEditingActivity(null);
          }}
          onAddCategory={handleAddCategory}
        />
      )}

      {deletingActivity && (
        <DeleteConfirm
          title={`Delete "${deletingActivity.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeletingActivity(null)}
          loading={deleteLoading}
        />
      )}

      {ToastComponent}
    </div>
  );
}
