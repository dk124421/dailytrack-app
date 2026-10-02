'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import BottomNavigation from '@/components/BottomNavigation';
import ProgressRing from '@/components/ProgressRing';
import EmptyState from '@/components/EmptyState';
import { PageLoader } from '@/components/LoadingState';
import { createClient } from '@/lib/supabase/client';
import {
  formatDate, formatMonthYear, getWeekDays, getMonthDays,
  calculateStreak, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, getLogicalToday
} from '@/lib/date-utils';
import type { Activity, ActivityCompletion } from '@/lib/types';

interface StatCard {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color: string;
}

export default function StatisticsPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allCompletions, setAllCompletions] = useState<ActivityCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  const today = getLogicalToday();

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [actsRes, compsRes] = await Promise.all([
      supabase.from('activities').select('*, category:categories(*)').eq('user_id', user.id).eq('is_active', true),
      supabase.from('activity_completions').select('*').eq('user_id', user.id).eq('completed', true),
    ]);

    setActivities(actsRes.data || []);
    setAllCompletions(compsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const dailyActs = activities.filter((a) => a.frequency === 'daily');
  const todayStr = formatDate(today);

  // Today's completion
  const todayCompletions = allCompletions.filter((c) => c.completion_date === todayStr);
  const todayPct = dailyActs.length > 0 ? Math.round((todayCompletions.length / dailyActs.length) * 100) : 0;

  // Weekly
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekDays = getWeekDays(today);
  const weekCompletions = allCompletions.filter((c) => {
    const d = new Date(c.completion_date);
    return d >= weekStart && d <= weekEnd;
  });
  const weekPossible = dailyActs.length * 7;
  const weekPct = weekPossible > 0 ? Math.round((weekCompletions.length / weekPossible) * 100) : 0;

  // Monthly
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const monthDays = getMonthDays(today);
  const daysElapsed = monthDays.filter((d) => d <= today).length;
  const monthCompletions = allCompletions.filter((c) => {
    const d = new Date(c.completion_date);
    return d >= monthStart && d <= monthEnd;
  });
  const monthPossible = dailyActs.length * daysElapsed;
  const monthPct = monthPossible > 0 ? Math.round((monthCompletions.length / monthPossible) * 100) : 0;

  // Overall
  const overallPct = allCompletions.length > 0 && activities.length > 0
    ? Math.min(100, Math.round((allCompletions.length / Math.max(1, activities.length * 30)) * 100))
    : 0;

  // Streaks
  const streakData = dailyActs.map((a) => {
    const dates = allCompletions.filter((c) => c.activity_id === a.id).map((c) => c.completion_date);
    return calculateStreak(dates, today);
  });
  const currentStreak = streakData.length > 0 ? Math.max(...streakData) : 0;
  const bestStreakData = dailyActs.map((a) => {
    const dates = allCompletions
      .filter((c) => c.activity_id === a.id)
      .map((c) => c.completion_date)
      .sort();
    let best = 0, cur = 0;
    for (let i = 0; i < dates.length; i++) {
      if (i === 0) { cur = 1; }
      else {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
        cur = diff === 1 ? cur + 1 : 1;
      }
      best = Math.max(best, cur);
    }
    return best;
  });
  const bestStreak = bestStreakData.length > 0 ? Math.max(...bestStreakData) : 0;

  // Weekly bar chart data
  const weeklyChartData = weekDays.map((day) => {
    const dayStr = formatDate(day);
    const dayComps = allCompletions.filter((c) => c.completion_date === dayStr);
    const pct = dailyActs.length > 0 ? Math.round((dayComps.length / dailyActs.length) * 100) : 0;
    return { day: format(day, 'EEE'), pct, isToday: formatDate(day) === todayStr };
  });

  // Monthly heatmap
  const heatmapData = monthDays.map((day) => {
    const dayStr = formatDate(day);
    const dayComps = allCompletions.filter((c) => c.completion_date === dayStr);
    const pct = dailyActs.length > 0 ? Math.round((dayComps.length / dailyActs.length) * 100) : 0;
    return { day: format(day, 'd'), pct, isFuture: day > today };
  });

  // Category progress
  const categoryGroups = activities.reduce<Record<string, { name: string; icon: string; total: number; completed: number }>>((acc, act) => {
    if (!act.category_id || !act.category) return acc;
    const catId = act.category_id;
    if (!acc[catId]) {
      acc[catId] = { name: act.category.name, icon: act.category.icon || '', total: 0, completed: 0 };
    }
    acc[catId].total++;
    const catComps = allCompletions.filter((c) => c.activity_id === act.id);
    if (catComps.length > 0) acc[catId].completed++;
    return acc;
  }, {});

  const statCards: StatCard[] = [
    { label: 'Today', value: `${todayPct}%`, sub: `${todayCompletions.length}/${dailyActs.length} done`, icon: '📅', color: 'from-blue-500 to-indigo-500' },
    { label: 'This Week', value: `${weekPct}%`, sub: `${weekCompletions.length} completions`, icon: '📈', color: 'from-purple-500 to-pink-500' },
    { label: 'This Month', value: `${monthPct}%`, sub: `${formatMonthYear(today)}`, icon: '🗓️', color: 'from-emerald-500 to-teal-500' },
    { label: 'Current Streak', value: `${currentStreak}d`, sub: `Best: ${bestStreak} days`, icon: '🔥', color: 'from-orange-500 to-red-500' },
  ];

  const getHeatColor = (pct: number, isFuture: boolean) => {
    if (isFuture) return 'bg-neutral-100';
    if (pct === 0) return 'bg-neutral-200';
    if (pct < 50) return 'bg-emerald-200';
    if (pct < 80) return 'bg-emerald-400';
    return 'bg-emerald-600';
  };

  if (loading) return <div className="min-h-dvh bg-neutral-50 pb-28"><div className="pt-24"><PageLoader /></div><BottomNavigation /></div>;

  if (activities.length === 0) return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      <div className="bg-white px-5 pt-12 pb-5 border-b border-neutral-100">
        <h1 className="text-xl font-bold text-neutral-800">Statistics</h1>
      </div>
      <EmptyState type="statistics" />
      <BottomNavigation />
    </div>
  );

  return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-neutral-100">
        <h1 className="text-xl font-bold text-neutral-800">Statistics</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{formatMonthYear(today)}</p>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Overview ring */}
        <div className="card p-5 flex items-center gap-5 animate-fade-in">
          <ProgressRing percentage={monthPct} size={100} strokeWidth={9} />
          <div>
            <h3 className="text-base font-bold text-neutral-800">Monthly Overview</h3>
            <p className="text-sm text-neutral-500 mt-0.5">{monthCompletions.length} completions this month</p>
            <div className="flex gap-3 mt-3">
              <div className="text-center">
                <p className="text-lg font-bold text-green-500">{monthCompletions.length}</p>
                <p className="text-xs text-neutral-400">Done</p>
              </div>
              <div className="w-px bg-neutral-100" />
              <div className="text-center">
                <p className="text-lg font-bold text-orange-500">🔥 {currentStreak}</p>
                <p className="text-xs text-neutral-400">Streak</p>
              </div>
              <div className="w-px bg-neutral-100" />
              <div className="text-center">
                <p className="text-lg font-bold text-purple-500">🏆 {bestStreak}</p>
                <p className="text-xs text-neutral-400">Best</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stat cards 2x2 grid */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((card) => (
            <div key={card.label} className={`rounded-2xl bg-gradient-to-br ${card.color} p-4 text-white`}>
              <span className="text-2xl">{card.icon}</span>
              <p className="text-2xl font-bold mt-2 leading-none">{card.value}</p>
              <p className="text-xs text-white/80 mt-1 font-medium">{card.label}</p>
              {card.sub && <p className="text-xs text-white/60 mt-0.5">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* Weekly Bar Chart */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-neutral-700 mb-4">This Week&apos;s Progress</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={weeklyChartData} barSize={30} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Completion']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '12px' }}
              />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                {weeklyChartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.isToday ? '#6366f1' : '#c7d2fe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Heatmap */}
        <div className="card p-5">
          <h3 className="text-sm font-bold text-neutral-700 mb-3">Monthly Heatmap</h3>
          <div className="flex flex-wrap gap-1.5">
            {heatmapData.map((item) => (
              <div
                key={item.day}
                title={`Day ${item.day}: ${item.pct}%`}
                className={`w-7 h-7 rounded-md flex items-center justify-center ${getHeatColor(item.pct, item.isFuture)}`}
              >
                <span className="text-[9px] font-medium text-white/80">{item.day}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-neutral-400">Less</span>
            {['bg-neutral-200', 'bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600'].map((c) => (
              <div key={c} className={`w-4 h-4 rounded ${c}`} />
            ))}
            <span className="text-xs text-neutral-400">More</span>
          </div>
        </div>

        {/* Category Progress */}
        {Object.keys(categoryGroups).length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-bold text-neutral-700 mb-4">By Category</h3>
            <div className="space-y-3">
              {Object.values(categoryGroups).map((cat) => {
                const pct = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-neutral-700">
                        {cat.icon} {cat.name}
                      </span>
                      <span className="text-xs font-semibold text-neutral-500">{pct}%</span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-400 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNavigation />
    </div>
  );
}
