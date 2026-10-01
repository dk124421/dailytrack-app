'use client';

import { ClipboardList, Calendar, BarChart2 } from 'lucide-react';

interface EmptyStateProps {
  type?: 'activities' | 'calendar' | 'statistics';
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

const defaults = {
  activities: {
    icon: ClipboardList,
    title: 'No activities yet',
    message: 'Start building your daily routine by adding your first activity.',
  },
  calendar: {
    icon: Calendar,
    title: 'No activity recorded',
    message: 'No activity was recorded for this day.',
  },
  statistics: {
    icon: BarChart2,
    title: 'Not enough data',
    message: 'Complete a few activities to see your statistics here.',
  },
};

export default function EmptyState({ type = 'activities', title, message, action }: EmptyStateProps) {
  const config = defaults[type];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-primary-400" />
      </div>
      <h3 className="text-base font-bold text-neutral-700 mb-1">{title ?? config.title}</h3>
      <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">{message ?? config.message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
