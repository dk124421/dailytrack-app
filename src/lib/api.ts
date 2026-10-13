import { createClient } from '@/lib/supabase/client';
import type { Activity, ActivityCompletion, Category, Profile, Frequency } from '@/lib/types';
import { formatDate, getLogicalToday, isDateModifiable } from '@/lib/date-utils';

const supabase = createClient();

// ===== Profile =====

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return data;
}

export async function updateProfile(updates: Partial<Profile>): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .upsert({ 
      user_id: user.id,
      email: user.email || '',
      name: user.email?.split('@')[0] || '',
      ...updates, 
      updated_at: new Date().toISOString() 
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  return data;
}

// ===== Categories =====

export async function getCategories(): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('name');

  return data || [];
}

export async function createCategory(name: string, icon?: string): Promise<Category | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('categories')
    .insert({ user_id: user.id, name, icon: icon || null })
    .select()
    .single();

  return data;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  return !error;
}

// ===== Activities =====

export async function getActivities(): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return data || [];
}

export async function getAllActivities(): Promise<Activity[]> {
  const { data } = await supabase
    .from('activities')
    .select('*, category:categories(*)')
    .order('created_at', { ascending: false });

  return data || [];
}

export async function getActivity(id: string): Promise<Activity | null> {
  const { data } = await supabase
    .from('activities')
    .select('*, category:categories(*)')
    .eq('id', id)
    .single();

  return data;
}

export async function createActivity(activity: {
  title: string;
  description?: string;
  frequency: Frequency;
  duration_minutes?: number;
  category_id?: string;
  target_count?: number;
  start_date?: string;
}): Promise<Activity | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('activities')
    .insert({
      user_id: user.id,
      title: activity.title,
      description: activity.description || null,
      frequency: activity.frequency,
      duration_minutes: activity.duration_minutes || null,
      category_id: activity.category_id || null,
      target_count: activity.target_count || 1,
      start_date: activity.start_date || formatDate(getLogicalToday()),
      is_active: true,
    })
    .select('*, category:categories(*)')
    .single();

  return data;
}

export async function updateActivity(
  id: string,
  updates: Partial<Activity>
): Promise<Activity | null> {
  const { data } = await supabase
    .from('activities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, category:categories(*)')
    .single();

  return data;
}

export async function deleteActivity(id: string): Promise<boolean> {
  // First delete completions
  await supabase
    .from('activity_completions')
    .delete()
    .eq('activity_id', id);

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  return !error;
}

// ===== Completions =====

export async function getCompletions(
  startDate: string,
  endDate: string
): Promise<ActivityCompletion[]> {
  const { data } = await supabase
    .from('activity_completions')
    .select('*')
    .gte('completion_date', startDate)
    .lte('completion_date', endDate)
    .eq('completed', true);

  return data || [];
}

export async function getCompletionsForActivity(
  activityId: string,
  limit: number = 30
): Promise<ActivityCompletion[]> {
  const { data } = await supabase
    .from('activity_completions')
    .select('*')
    .eq('activity_id', activityId)
    .eq('completed', true)
    .order('completion_date', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function toggleCompletion(
  activityId: string,
  date: string,
  completed: boolean
): Promise<boolean> {
  // Enforce rule: only today and yesterday can be modified
  if (!isDateModifiable(date)) {
    console.warn(`Date ${date} cannot be modified. Only today and yesterday are allowed.`);
    return false;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (completed) {
    // Upsert completion
    const { error } = await supabase
      .from('activity_completions')
      .upsert(
        {
          activity_id: activityId,
          user_id: user.id,
          completion_date: date,
          completed: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'activity_id,completion_date',
        }
      );

    return !error;
  } else {
    // Delete or mark as not completed
    const { error } = await supabase
      .from('activity_completions')
      .delete()
      .eq('activity_id', activityId)
      .eq('completion_date', date);

    return !error;
  }
}

export async function getDayCompletions(date: string): Promise<ActivityCompletion[]> {
  const { data } = await supabase
    .from('activity_completions')
    .select('*')
    .eq('completion_date', date)
    .eq('completed', true);

  return data || [];
}

export async function getActivityCompletionCounts(): Promise<Record<string, number>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from('activity_completions')
    .select('activity_id')
    .eq('user_id', user.id)
    .eq('completed', true);

  const counts: Record<string, number> = {};
  (data || []).forEach((c: { activity_id: string }) => {
    counts[c.activity_id] = (counts[c.activity_id] || 0) + 1;
  });

  return counts;
}

export async function getActivityCompletionDates(): Promise<Record<string, string[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from('activity_completions')
    .select('activity_id, completion_date')
    .eq('user_id', user.id)
    .eq('completed', true);

  const map: Record<string, string[]> = {};
  (data || []).forEach((c: { activity_id: string; completion_date: string }) => {
    if (!map[c.activity_id]) {
      map[c.activity_id] = [];
    }
    map[c.activity_id].push(c.completion_date);
  });

  return map;
}
