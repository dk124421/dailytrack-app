'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
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
  getCompletionsForActivity,
} from '@/lib/api';
import {
  formatDate,
  formatDisplayDate,
  getGreeting,
  calculateStreak,
  getLogicalToday,
} from '@/lib/date-utils';
import type { Activity, Category } from '@/lib/types';

export default function DashboardPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState<Activity | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const { showToast, ToastComponent } = useToast();

  const today = getLogicalToday();
  const todayStr = formatDate(today);

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

      const [acts, cats, completions] = await Promise.all([
        getActivities(),
        getCategories(),
        getDayCompletions(todayStr),
      ]);

      setActivities(acts);
      setCategories(cats);
      setCompletedIds(new Set(completions.map((c) => c.activity_id)));

      // Load streaks
      const streakMap: Record<string, number> = {};
      await Promise.all(
        acts.map(async (act) => {
          if (act.frequency === 'daily') {
            const completionHistory = await getCompletionsForActivity(act.id, 365);
            const dates = completionHistory.map((c) => c.completion_date);
            streakMap[act.id] = calculateStreak(dates, today);
          }
        })
      );
      setStreaks(streakMap);
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggle(activityId: string, completed: boolean) {
    const prev = new Set(completedIds);
    // Optimistic update
    if (completed) {
      setCompletedIds((s) => new Set([...s, activityId]));
    } else {
      setCompletedIds((s) => { const n = new Set(s); n.delete(activityId); return n; });
    }

    const ok = await toggleCompletion(activityId, todayStr, completed);
    if (!ok) {
      setCompletedIds(prev);
      showToast('Failed to update', 'error');
    } else {
      showToast(completed ? 'Activity completed! 🎉' : 'Marked incomplete', completed ? 'success' : 'info');
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

  // Daily activities for today's view
  const todayActivities = activities.filter((a) => a.frequency === 'daily');
  const otherActivities = activities.filter((a) => a.frequency !== 'daily');

  const completedCount = todayActivities.filter((a) => completedIds.has(a.id)).length;
  const totalCount = todayActivities.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-neutral-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500 font-medium">{getGreeting()} 👋</p>
            <h1 className="text-xl font-bold text-neutral-800 mt-0.5">
              {userName ? `Hey, ${userName}!` : 'Dashboard'}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">{formatDisplayDate(today)}</p>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-400 transition-colors"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Today's Progress */}
        {!loading && totalCount > 0 && (
          <div className="mt-5 bg-gradient-to-r from-primary-500 to-indigo-500 rounded-2xl p-5 flex items-center gap-5 animate-fade-in">
            <ProgressRing percentage={percentage} size={90} strokeWidth={8} />
            <div className="flex-1">
              <p className="text-white/80 text-sm font-medium">Today&apos;s Progress</p>
              <p className="text-white text-2xl font-bold mt-0.5">{completedCount} / {totalCount}</p>
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
        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
            {/* Daily Activities */}
            {todayActivities.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-2">
                  Today&apos;s Activities
                </h2>
                <div className="space-y-2">
                  {todayActivities.map((activity) => (
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

            {/* Weekly/Monthly */}
            {otherActivities.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider px-1 mb-2">
                  Weekly & Monthly
                </h2>
                <div className="space-y-2">
                  {otherActivities.map((activity) => (
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

      {/* FAB */}
      <button
        onClick={() => { setEditingActivity(null); setShowForm(true); }}
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
          onClose={() => { setShowForm(false); setEditingActivity(null); }}
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
