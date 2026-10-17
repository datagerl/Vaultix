'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '@/components/ThemeProvider';
import type { Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

interface ThemeToggleProps {
  /** `menu` is a compact dropdown for the header; `segmented` is an inline radio group for settings. */
  variant?: 'menu' | 'segmented';
  className?: string;
}

export default function ThemeToggle({ variant = 'menu', className }: ThemeToggleProps) {
  return variant === 'segmented' ? (
    <SegmentedThemeToggle className={className} />
  ) : (
    <MenuThemeToggle className={className} />
  );
}

function MenuThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return;

    const selectedIndex = OPTIONS.findIndex((o) => o.value === theme);
    itemRefs.current[Math.max(selectedIndex, 0)]?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
    // Depends on `open` only: focus the selected item when the menu opens,
    // not on every theme change.
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={twMerge('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Theme: ${current.label}`}
        className="flex min-h-[44px] items-center gap-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
      >
        <CurrentIcon size={20} aria-hidden="true" />
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Theme"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl"
        >
          {OPTIONS.map(({ value, label, icon: Icon }, i) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={-1}
                onClick={() => {
                  setTheme(value);
                  close();
                }}
                className={twMerge(
                  'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
                  selected && 'bg-accent font-medium text-accent-foreground',
                )}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SegmentedThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={twMerge('inline-flex rounded-lg border border-border bg-muted p-1', className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <label
            key={value}
            className={twMerge(
              'flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
              selected && 'bg-background font-medium text-foreground shadow-sm',
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={selected}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon size={16} aria-hidden="true" />
            {label}
          </label>
        );
      })}
    </div>
  );
}
