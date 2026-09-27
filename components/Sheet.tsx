'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from '@/components/icons';

/**
 * Bottom sheet chrome, shared by every panel that slides up over a screen.
 *
 * The redesign's sheet: a white card with 28px top corners and a grabber, a
 * 22px title, an optional sentence under it, then the content. The close X is
 * optional — a sheet that ends in "Not yet" does not need a second way out.
 */
export function Sheet({
  title,
  description,
  onClose,
  children,
  showClose = true,
  hideTitle = false,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  showClose?: boolean;
  /** Keep the title for screen readers but let the content draw its own head. */
  hideTitle?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col justify-end bg-[var(--rp-scrim)]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="rp-rise max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-surface px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_40px_rgba(0,0,0,.2)]"
      >
        <div className="mx-auto w-full max-w-lg">
          <div aria-hidden className="mx-auto mb-5 h-[5px] w-9 rounded-[3px] bg-line" />
          {hideTitle ? (
            <h2 className="sr-only">{title}</h2>
          ) : (
            <header className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[22px] font-semibold tracking-[-0.01em]">{title}</h2>
                {description ? (
                  <div className="mt-1.5 text-pretty text-[15px] leading-normal text-ink-dim">
                    {description}
                  </div>
                ) : null}
              </div>
              {showClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1 -mt-1 inline-flex h-11 w-11 flex-none items-center justify-center"
                  aria-label="Close"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-ink-dim">
                    <X size="sm" />
                  </span>
                </button>
              ) : null}
            </header>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
