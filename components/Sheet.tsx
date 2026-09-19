'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from '@/components/icons';

/** Bottom sheet chrome, shared by the roster and rounds panels. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-line bg-ground px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
      >
        <div className="mx-auto w-full max-w-lg">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="disp text-xl font-bold tracking-[-0.02em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-faint"
              aria-label="Close"
            >
              <X />
            </button>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
