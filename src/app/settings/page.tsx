'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, LogOut, Trash2, Share2, ChevronRight,
  Bell, Shield, Info, CheckSquare, Plus
} from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import DeleteConfirm from '@/components/DeleteConfirm';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { getCategories, createCategory, deleteCategory } from '@/lib/api';
import type { Category } from '@/lib/types';

export default function SettingsPage() {
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const { signOut } = useAuth();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('name, email').eq('user_id', user.id).single();
        setProfile(data || { name: user.email?.split('@')[0] || '', email: user.email || '' });
      }
      setCategories(await getCategories());
    }
    load();
  }, []);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    const cat = await createCategory(newCatName.trim());
    if (cat) {
      setCategories((prev) => [...prev, cat]);
      setNewCatName('');
      setShowNewCat(false);
      showToast('Category added', 'success');
    }
  }

  async function handleDeleteCategory() {
    if (!deletingCat) return;
    const ok = await deleteCategory(deletingCat.id);
    if (ok) {
      setCategories((prev) => prev.filter((c) => c.id !== deletingCat.id));
      showToast('Category deleted', 'info');
    }
    setDeletingCat(null);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  async function handleShare() {
    const appUrl = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DailyTrack',
          text: 'Track your daily habits with DailyTrack! 🚀',
          url: appUrl,
        });
      } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(appUrl);
      showToast('Link copied to clipboard!', 'success');
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-5 border-b border-neutral-100">
        <h1 className="text-xl font-bold text-neutral-800">Settings</h1>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Profile */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold">
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-bold text-neutral-800 text-base">{profile?.name || 'User'}</p>
              <p className="text-sm text-neutral-400">{profile?.email}</p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-neutral-700 mb-3">Categories</h2>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-neutral-700">{cat.icon} {cat.name}</span>
                <button
                  onClick={() => setDeletingCat(cat)}
                  className="p-1.5 rounded-lg text-neutral-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}

            {showNewCat ? (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <button
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-medium"
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowNewCat(false); setNewCatName(''); }}
                  className="px-3 py-2 bg-neutral-100 rounded-xl text-sm text-neutral-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewCat(true)}
                className="flex items-center gap-2 text-sm text-primary-500 font-medium mt-1"
              >
                <Plus size={16} />
                Add Category
              </button>
            )}
          </div>
        </div>

        {/* App */}
        <div className="card overflow-hidden">
          <button
            onClick={handleShare}
            id="share-app-btn"
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-neutral-50 transition-colors border-b border-neutral-100"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Share2 size={18} className="text-blue-500" />
            </div>
            <span className="flex-1 text-left text-sm font-medium text-neutral-700">Share App</span>
            <ChevronRight size={16} className="text-neutral-300" />
          </button>

          <div className="w-full flex items-center gap-3 px-5 py-4 border-b border-neutral-100 opacity-60">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <Bell size={18} className="text-amber-500" />
            </div>
            <span className="flex-1 text-left text-sm font-medium text-neutral-700">Notifications</span>
            <span className="text-xs text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">Soon</span>
          </div>

          <div className="w-full flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
              <Info size={18} className="text-neutral-500" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm font-medium text-neutral-700">App Version</span>
              <p className="text-xs text-neutral-400">DailyTrack v1.0.0</p>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="card overflow-hidden">
          <button
            onClick={handleSignOut}
            id="sign-out-btn"
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-neutral-50 transition-colors border-b border-neutral-100"
          >
            <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center">
              <LogOut size={18} className="text-neutral-500" />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-neutral-700">Sign Out</span>
          </button>

          <button
            onClick={() => setShowDeleteAccount(true)}
            className="w-full flex items-center gap-3 px-5 py-4 hover:bg-red-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Trash2 size={18} className="text-red-400" />
            </div>
            <span className="flex-1 text-left text-sm font-semibold text-red-500">Delete Account</span>
          </button>
        </div>
      </div>

      <BottomNavigation />

      {deletingCat && (
        <DeleteConfirm
          title={`Delete category "${deletingCat.name}"?`}
          message="Activities in this category will remain but lose their category assignment."
          onConfirm={handleDeleteCategory}
          onCancel={() => setDeletingCat(null)}
        />
      )}

      {showDeleteAccount && (
        <DeleteConfirm
          title="Delete Account?"
          message="This will permanently delete your account and all your tracking data. This cannot be undone."
          onConfirm={async () => {
            showToast('Please contact support to delete your account', 'info');
            setShowDeleteAccount(false);
          }}
          onCancel={() => setShowDeleteAccount(false)}
        />
      )}

      {ToastComponent}
    </div>
  );
}
