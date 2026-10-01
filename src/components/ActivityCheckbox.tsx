'use client';

import { Check } from 'lucide-react';

interface ActivityCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: number;
}

export default function ActivityCheckbox({
  checked,
  onToggle,
  disabled = false,
  size = 28,
}: ActivityCheckboxProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-all duration-200 active:scale-90 ${
        checked
          ? 'bg-primary-500 border-primary-500'
          : 'border-neutral-300 bg-white hover:border-primary-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ width: size, height: size, minWidth: size }}
      aria-label={checked ? 'Mark incomplete' : 'Mark complete'}
    >
      {checked && (
        <Check
          size={size * 0.6}
          strokeWidth={3}
          className="text-white animate-checkmark"
        />
      )}
    </button>
  );
}
