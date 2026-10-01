'use client';

import { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import type { Activity, Category, Frequency } from '@/lib/types';
import { formatDate } from '@/lib/date-utils';

interface ActivityFormProps {
  activity?: Activity | null;
  categories: Category[];
  onSave: (data: ActivityFormData) => Promise<void>;
  onClose: () => void;
  onAddCategory?: (name: string) => Promise<Category | null>;
}

export interface ActivityFormData {
  title: string;
  description: string;
  frequency: Frequency;
  duration_minutes?: number;
  category_id: string;
  target_count: number;
  start_date: string;
}

const frequencies: { value: Frequency; label: string; desc: string }[] = [
  { value: 'daily', label: 'Daily', desc: 'Every day' },
  { value: 'weekly', label: 'Weekly', desc: 'This week' },
  { value: 'monthly', label: 'Monthly', desc: 'This month' },
  { value: 'short_term', label: 'Timer', desc: 'Short task' },
];

export default function ActivityForm({
  activity,
  categories,
  onSave,
  onClose,
  onAddCategory,
}: ActivityFormProps) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [frequency, setFrequency] = useState<Frequency>(activity?.frequency ?? 'daily');
  const [durationMinutes, setDurationMinutes] = useState(activity?.duration_minutes ?? 15);
  const [categoryId, setCategoryId] = useState(activity?.category_id ?? '');
  const [targetCount, setTargetCount] = useState(activity?.target_count ?? 1);
  const [startDate, setStartDate] = useState(activity?.start_date ?? formatDate(new Date()));
  const [loading, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);

  const isEditing = !!activity;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        frequency,
        duration_minutes: frequency === 'short_term' ? durationMinutes : undefined,
        category_id: categoryId,
        target_count: targetCount,
        start_date: startDate,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim() || !onAddCategory) return;
    const cat = await onAddCategory(newCatName.trim());
    if (cat) {
      setCategoryId(cat.id);
      setShowNewCat(false);
      setNewCatName('');
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100">
          <h2 className="text-lg font-bold text-neutral-800">
            {isEditing ? 'Edit Activity' : 'New Activity'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Activity Name *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Study Python"
              required
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all text-[15px]"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {frequencies.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFrequency(f.value)}
                  className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all duration-150 ${
                    frequency === f.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration for short term */}
          {frequency === 'short_term' && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Timer Duration (minutes)
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDurationMinutes(Math.max(1, durationMinutes - 5))}
                  className="w-10 h-10 rounded-full border-2 border-neutral-200 flex items-center justify-center text-lg font-bold text-neutral-600 hover:border-primary-300 transition-colors"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-neutral-800 w-12 text-center">
                  {durationMinutes}
                </span>
                <button
                  type="button"
                  onClick={() => setDurationMinutes(Math.min(120, durationMinutes + 5))}
                  className="w-10 h-10 rounded-full border-2 border-neutral-200 flex items-center justify-center text-lg font-bold text-neutral-600 hover:border-primary-300 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Target count for weekly/monthly */}
          {(frequency === 'weekly' || frequency === 'monthly') && (
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Target ({frequency === 'weekly' ? 'times per week' : 'times per month'})
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTargetCount(Math.max(1, targetCount - 1))}
                  className="w-10 h-10 rounded-full border-2 border-neutral-200 flex items-center justify-center text-lg font-bold text-neutral-600 hover:border-primary-300 transition-colors"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-neutral-800 w-10 text-center">
                  {targetCount}
                </span>
                <button
                  type="button"
                  onClick={() => setTargetCount(Math.min(frequency === 'weekly' ? 7 : 31, targetCount + 1))}
                  className="w-10 h-10 rounded-full border-2 border-neutral-200 flex items-center justify-center text-lg font-bold text-neutral-600 hover:border-primary-300 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCategoryId('')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  !categoryId
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                }`}
              >
                None
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    categoryId === cat.id
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowNewCat(true)}
                className="px-3 py-1.5 rounded-full text-sm font-medium border border-dashed border-neutral-300 text-neutral-400 hover:border-primary-300 hover:text-primary-500 transition-all"
              >
                + New
              </button>
            </div>
            {showNewCat && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a note about this activity..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all text-[15px] resize-none"
            />
          </div>

          {/* Start date */}
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
              Start Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 transition-all text-[15px]"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !title.trim()}
            className="w-full py-3.5 bg-primary-500 hover:bg-primary-600 disabled:bg-neutral-300 text-white font-semibold rounded-xl transition-all duration-200 text-[15px] active:scale-95"
          >
            {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Activity'}
          </button>
        </form>
      </div>
    </div>
  );
}
