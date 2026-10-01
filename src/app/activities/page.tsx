'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, SlidersHorizontal } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import ActivityCard from '@/components/ActivityCard';
import ActivityForm, { type ActivityFormData } from '@/components/ActivityForm';
import DeleteConfirm from '@/components/DeleteConfirm';
import { SkeletonList } from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { useToast } from '@/components/Toast';
import {
  getActivities,
  getAllActivities,
  getCategories,
  getDayCompletions,
  toggleCompletion,
  createActivity,
  updateActivity,
  deleteActivity,
  createCategory,
  getCompletionsForActivity,
} from '@/lib/api';
import { formatDate, calculateStreak } from '@/lib/date-utils';
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
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

  const todayStr = formatDate(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    const [acts, cats, completions] = await Promise.all([
      getAllActivities(),
      getCategories(),
      getDayCompletions(todayStr),
    ]);
    setActivities(acts);
    setCategories(cats);
    setCompletedIds(new Set(completions.map((c) => c.activity_id)));

    const streakMap: Record<string, number> = {};
    const today = new Date();
    await Promise.all(
      acts
        .filter((a) => a.frequency === 'daily')
        .map(async (act) => {
          const history = await getCompletionsForActivity(act.id, 365);
          streakMap[act.id] = calculateStreak(history.map((c) => c.completion_date), today);
        })
    );
    setStreaks(streakMap);
    setLoading(false);
  }, [todayStr]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleToggle(activityId: string, completed: boolean) {
    const prev = new Set(completedIds);
    if (completed) setCompletedIds((s) => new Set([...s, activityId]));
    else setCompletedIds((s) => { const n = new Set(s); n.delete(activityId); return n; });
    const ok = await toggleCompletion(activityId, todayStr, completed);
    if (!ok) { setCompletedIds(prev); showToast('Failed to update', 'error'); }
  }

  async function handleSave(data: ActivityFormData) {
    if (editingActivity) {
      const updated = await updateActivity(editingActivity.id, {
        title: data.title, description: data.description,
        frequency: data.frequency, category_id: data.category_id || undefined,
        target_count: data.target_count, start_date: data.start_date,
      });
      if (updated) {
        setActivities((prev) => prev.map((a) => a.id === updated.id ? updated : a));
        showToast('Activity updated', 'success');
      }
    } else {
      const created = await createActivity({
        title: data.title, description: data.description,
        frequency: data.frequency, category_id: data.category_id,
        target_count: data.target_count, start_date: data.start_date,
      });
      if (created) { setActivities((prev) => [created, ...prev]); showToast('Activity created!', 'success'); }
    }
    setShowForm(false); setEditingActivity(null);
  }

  async function handleDelete() {
    if (!deletingActivity) return;
    setDeleteLoading(true);
    const ok = await deleteActivity(deletingActivity.id);
    if (ok) { setActivities((prev) => prev.filter((a) => a.id !== deletingActivity.id)); showToast('Deleted', 'info'); }
    else showToast('Failed to delete', 'error');
    setDeleteLoading(false); setDeletingActivity(null);
  }

  const filtered = activities.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'daily') return a.frequency === 'daily';
    if (filter === 'weekly') return a.frequency === 'weekly';
    if (filter === 'monthly') return a.frequency === 'monthly';
    if (filter === 'completed') return completedIds.has(a.id);
    if (filter === 'pending') return !completedIds.has(a.id);
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
          <h1 className="text-xl font-bold text-neutral-800">Activities</h1>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 transition-colors"
          >
            <Search size={20} />
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
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 bg-neutral-50"
            />
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === f.value
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-5">
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
                    {acts.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        completed={completedIds.has(activity.id)}
                        streak={streaks[activity.id] ?? 0}
                        onToggle={handleToggle}
                        onEdit={(a) => { setEditingActivity(a); setShowForm(true); }}
                        onDelete={setDeletingActivity}
                      />
                    ))}
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
                  {uncategorized.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      completed={completedIds.has(activity.id)}
                      streak={streaks[activity.id] ?? 0}
                      onToggle={handleToggle}
                      onEdit={(a) => { setEditingActivity(a); setShowForm(true); }}
                      onDelete={setDeletingActivity}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditingActivity(null); setShowForm(true); }}
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
          onClose={() => { setShowForm(false); setEditingActivity(null); }}
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
