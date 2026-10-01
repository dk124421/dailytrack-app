'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import ActivityCheckbox from './ActivityCheckbox';
import type { Activity } from '@/lib/types';

interface ActivityCardProps {
  activity: Activity;
  completed: boolean;
  streak: number;
  onToggle: (activityId: string, completed: boolean) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activity: Activity) => void;
}

const frequencyLabel = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function ActivityCard({
  activity,
  completed,
  streak,
  onToggle,
  onEdit,
  onDelete,
}: ActivityCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Timer state
  const isShortTerm = activity.frequency === 'short_term';
  const durationSecs = (activity.duration_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(durationSecs);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      onToggle(activity.id, true);
      
      // Notify
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Time is up! ⏳', { body: `Task "${activity.title}" is complete.` });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification('Time is up! ⏳', { body: `Task "${activity.title}" is complete.` });
            }
          });
        }
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, activity.id, activity.title, onToggle]);

  const toggleTimer = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setIsRunning(!isRunning);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div
      className={`card p-4 flex items-center gap-3 animate-fade-in transition-all duration-300 ${
        completed ? 'opacity-80' : ''
      }`}
    >
      {!isShortTerm ? (
        <ActivityCheckbox
          checked={completed}
          onToggle={() => onToggle(activity.id, !completed)}
        />
      ) : (
        <button
          onClick={completed ? undefined : toggleTimer}
          className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl font-bold text-xs transition-colors ${
            completed 
              ? 'bg-green-100 text-green-600'
              : isRunning 
                ? 'bg-red-100 text-red-500 animate-pulse'
                : 'bg-primary-100 text-primary-600'
          }`}
        >
          {completed ? 'Done' : formatTime(timeLeft)}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <p
          className={`font-semibold text-[15px] leading-tight truncate transition-all duration-200 ${
            completed ? 'text-neutral-400 line-through' : 'text-neutral-800'
          }`}
        >
          {activity.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-neutral-400 font-medium">
            {isShortTerm ? 'Timer' : frequencyLabel[activity.frequency as keyof typeof frequencyLabel]}
          </span>
          {activity.category && (
            <>
              <span className="text-neutral-200">•</span>
              <span className="text-xs text-neutral-400">
                {activity.category.icon} {activity.category.name}
              </span>
            </>
          )}
          {streak > 0 && !isShortTerm && (
            <>
              <span className="text-neutral-200">•</span>
              <span className="text-xs font-semibold text-orange-500">
                🔥 {streak} day{streak !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-all duration-150 -mr-1"
          aria-label="Activity options"
        >
          <MoreVertical size={18} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-neutral-100 py-1 z-20 w-36 animate-scale-in">
            <button
              onClick={() => { onEdit(activity); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <Edit size={15} />
              Edit
            </button>
            <button
              onClick={() => { onDelete(activity); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
