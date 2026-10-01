export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: Frequency;
  category_id: string | null;
  target_count: number;
  start_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  category?: Category | null;
}

export interface ActivityCompletion {
  id: string;
  activity_id: string;
  user_id: string;
  completion_date: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ActivityWithCompletion extends Activity {
  completed: boolean;
  streak: number;
  completionCount: number;
}

export interface DayStatus {
  date: string;
  total: number;
  completed: number;
  percentage: number;
  status: 'all' | 'partial' | 'missed' | 'none';
}
