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
  const storageKey = `timer_${activity.id}`;

  useEffect(() => {
    if (isShortTerm) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { endTime } = JSON.parse(saved);
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        if (remaining > 0) {
          setTimeLeft(remaining);
          setIsRunning(true);
        } else {
          setTimeLeft(0);
        }
      }
    }
  }, [isShortTerm, storageKey]);

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
      timer = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timer);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      localStorage.removeItem(storageKey);
      onToggle(activity.id, true);
      
      // Notify
      const showNotification = () => {
        const title = 'Time is up! ⏳';
        const options = { body: `Task "${activity.title}" is complete.`, icon: '/icons/icon-192x192.png' };
        
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, options);
          }).catch(() => {
            new Notification(title, options);
          });
        } else if ('Notification' in window) {
          new Notification(title, options);
        }
      };

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          showNotification();
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              showNotification();
            }
          });
        }
      }
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, activity.id, activity.title, onToggle, storageKey]);

  const toggleTimer = () => {
    if (!isRunning) {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      const endTime = Date.now() + (timeLeft === 0 ? durationSecs : timeLeft) * 1000;
      localStorage.setItem(storageKey, JSON.stringify({ endTime }));
      if (timeLeft === 0) setTimeLeft(durationSecs);
      setIsRunning(true);
    } else {
      localStorage.removeItem(storageKey);
      setIsRunning(false);
    }
  };

  const formatTime = (secs: number) => {
    const d = Math.floor(secs / (24 * 3600));
    const h = Math.floor((secs % (24 * 3600)) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
          className={`w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-xl font-bold text-xs transition-colors ${
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
