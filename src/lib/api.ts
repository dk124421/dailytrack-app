import { createClient } from '@/lib/supabase/client';
import type { Activity, ActivityCompletion, Category, Profile, Frequency } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';

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
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
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
      category_id: activity.category_id || null,
      target_count: activity.target_count || 1,
      start_date: activity.start_date || formatDate(new Date()),
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
