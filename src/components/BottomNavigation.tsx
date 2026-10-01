'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, CheckSquare, BarChart2, Settings } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { href: '/activities', icon: CheckSquare, label: 'Activities' },
  { href: '/statistics', icon: BarChart2, label: 'Stats' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] z-40 safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 min-w-[60px] py-1 px-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'text-primary-600'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <div className={`relative p-1.5 rounded-xl transition-all duration-200 ${
                isActive ? 'bg-primary-50' : ''
              }`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {isActive && (
                  <span className="absolute inset-0 bg-primary-100 rounded-xl opacity-50" />
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none ${
                isActive ? 'text-primary-600' : 'text-neutral-400'
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
