'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Clock } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import ActivityCard from '@/components/ActivityCard';
import ActivityForm, { type ActivityFormData } from '@/components/ActivityForm';
import DeleteConfirm from '@/components/DeleteConfirm';
import { SkeletonList } from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import {
  getAllActivities,
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
  formatShortDate,
  formatDisplayDate,
  calculateStreak,
  getLogicalToday,
  getLogicalYesterday,
  getActivityStats,
} from '@/lib/date-utils';
import type { Activity, Category } from '@/lib/types';

type FilterType = 'all' | 'daily' | 'weekly' | 'monthly' | 'completed' | 'pending';

const filters: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'completed', label: 'Done' },
  { value: 'pending', label: 'Pending' },
];

export default function ActivitiesPage() {
  const [selectedDay, setSelectedDay] = useState<'today' | 'yesterday'>('today');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [todayCompletedIds, setTodayCompletedIds] = useState<Set<string>>(new Set());
  const [yesterdayCompletedIds, setYesterdayCompletedIds] = useState<Set<string>>(new Set());
  const [completionDatesMap, setCompletionDatesMap] = useState<Record<string, string[]>>({});
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const today = getLogicalToday();
  const yesterday = getLogicalYesterday();
  const todayStr = formatDate(today);
  const yesterdayStr = formatDate(yesterday);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [acts, cats, todayComps, yesterdayComps, datesMap] = await Promise.all([
      getAllActivities(),
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

    const streakMap: Record<string, number> = {};
    acts.forEach((act) => {
      if (act.frequency === 'daily') {
        const history = datesMap[act.id] || [];
        streakMap[act.id] = calculateStreak(history, today);
      }
    });
    setStreaks(streakMap);
    setLoading(false);
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
    }
  }

  async function handleSave(data: ActivityFormData) {
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
        showToast('Activity created!', 'success');
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
      showToast('Deleted', 'info');
    } else {
      showToast('Failed to delete', 'error');
    }
    setDeleteLoading(false);
    setDeletingActivity(null);
  }

  const activeCompletedIds = selectedDay === 'today' ? todayCompletedIds : yesterdayCompletedIds;
  const activeDate = selectedDay === 'today' ? today : yesterday;

  const filtered = activities.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'daily') return a.frequency === 'daily';
    if (filter === 'weekly') return a.frequency === 'weekly';
    if (filter === 'monthly') return a.frequency === 'monthly';
    if (filter === 'completed') return activeCompletedIds.has(a.id);
    if (filter === 'pending') return !activeCompletedIds.has(a.id);
    return true;
  });

  const grouped = categories.reduce<Record<string, Activity[]>>((acc, cat) => {
    const catActs = filtered.filter((a) => a.category_id === cat.id);
    if (catActs.length > 0) acc[cat.name] = catActs;
    return acc;
  }, {});
  const uncategorized = filtered.filter((a) => !a.category_id);

  return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-neutral-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-neutral-800">Activities</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Showing completion for {selectedDay === 'today' ? `Today (${formatShortDate(today)})` : `Yesterday (${formatShortDate(yesterday)})`}
            </p>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            aria-label="Search activities"
            className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors"
          >
            <Search size={20} />
          </button>
        </div>

        {/* Day Selector Pill (Today vs Yesterday) */}
        <div className="flex p-1 bg-neutral-100 rounded-xl mb-3">
          <button
            onClick={() => setSelectedDay('today')}
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
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
            className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              selectedDay === 'yesterday'
                ? 'bg-white text-neutral-800 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>⏳ Yesterday</span>
            <span className="text-[10px] opacity-70 font-normal">({formatShortDate(yesterday)})</span>
          </button>
        </div>

        {showSearch && (
          <div className="relative mb-3 animate-fade-in">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities..."
              autoFocus
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-neutral-50"
            />
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filter === f.value
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
        {selectedDay === 'yesterday' && (
          <div className="bg-blue-50 border border-blue-200/90 rounded-2xl p-3 flex items-center gap-2.5 text-blue-900 animate-fade-in shadow-sm">
            <Clock size={18} className="text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-800 font-medium leading-relaxed">
              <strong>Catch-up Mode ({formatDisplayDate(yesterday)}):</strong> Modifying yesterday&apos;s completions. Only yesterday and today can be edited.
            </p>
          </div>
        )}

        {loading ? (
          <SkeletonList count={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            type="activities"
            title={search ? 'No results found' : 'No activities'}
            message={search ? `No activities match "${search}"` : undefined}
            action={
              !search ? (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm"
                >
                  <Plus size={16} />
                  Add Activity
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Categorized */}
            {Object.entries(grouped).map(([catName, acts]) => {
              const cat = categories.find((c) => c.name === catName);
              return (
                <section key={catName}>
                  <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-2">
                    {cat?.icon} {catName}
                  </h2>
                  <div className="space-y-2">
                    {acts.map((activity) => {
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
              );
            })}

            {/* Uncategorized */}
            {uncategorized.length > 0 && (
              <section>
                {Object.keys(grouped).length > 0 && (
                  <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-2">
                    Other
                  </h2>
                )}
                <div className="space-y-2">
                  {uncategorized.map((activity) => {
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
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setEditingActivity(null);
          setShowForm(true);
        }}
        id="activities-add-btn"
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-200 flex items-center justify-center transition-all duration-200 active:scale-90 z-30"
      >
        <Plus size={24} />
      </button>

      <BottomNavigation />

      {showForm && (
        <ActivityForm
          activity={editingActivity}
          categories={categories}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditingActivity(null);
          }}
          onAddCategory={createCategory}
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
