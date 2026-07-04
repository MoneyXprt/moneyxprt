'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const DESKTOP_W = 280;
const MOBILE_W  = 240;

interface PopoverPos {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  arrowLeft: number;
  showAbove: boolean;
}

export function Tooltip({ content }: { content: string }) {
  const [open, setOpen]       = useState(false);
  const [pos, setPos]         = useState<PopoverPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Only render portal after client hydration
  useEffect(() => { setMounted(true); }, []);

  function openPopover() {
    if (!btnRef.current) return;
    const rect     = btnRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;
    const pw       = isMobile ? MOBILE_W : DESKTOP_W;
    const btnCx    = rect.left + rect.width / 2;
    const rawLeft  = btnCx - pw / 2;
    const left     = Math.max(8, Math.min(rawLeft, window.innerWidth - pw - 8));
    // Arrow points at the center of the ⓘ button
    const arrowLeft = Math.max(8, Math.min(btnCx - left - 6, pw - 20));
    const showAbove = window.innerHeight - rect.bottom < 180 && rect.top > 180;

    setPos({
      ...(showAbove
        ? { bottom: window.innerHeight - rect.top + 10 }
        : { top: rect.bottom + 10 }),
      left,
      width: pw,
      arrowLeft,
      showAbove,
    });
    setOpen(true);
  }

  // Dismiss on click / tap outside
  useEffect(() => {
    if (!open) return;
    function dismiss(e: MouseEvent | TouchEvent) {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('touchstart', dismiss, { passive: true });
    return () => {
      document.removeEventListener('mousedown', dismiss);
      document.removeEventListener('touchstart', dismiss);
    };
  }, [open]);

  // ── Popover node — rendered into document.body via portal ──────────────────
  const popover = open && pos ? (
    <div
      ref={popRef}
      role="tooltip"
      style={{
        position:        'fixed',
        top:             pos.top,
        bottom:          pos.bottom,
        left:            pos.left,
        width:           pos.width,
        maxWidth:        pos.width,
        zIndex:          9999,
        backgroundColor: '#111827',
        color:           '#ffffff',
        borderRadius:    '8px',
        padding:         '12px 16px',
        boxShadow:       '0 4px 12px rgba(0,0,0,0.35)',
        fontSize:        '14px',
        lineHeight:      '1.625',
      }}
    >
      {/* Arrow triangle */}
      <span
        aria-hidden="true"
        style={{
          position:    'absolute',
          left:        pos.arrowLeft,
          width:       0,
          height:      0,
          borderLeft:  '6px solid transparent',
          borderRight: '6px solid transparent',
          ...(pos.showAbove
            ? { bottom: -6, borderTop:    '6px solid #111827' }
            : { top:    -6, borderBottom: '6px solid #111827' }),
        }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <p style={{ flex: 1, margin: 0, color: '#ffffff' }}>{content}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close tooltip"
          style={{
            background:  'none',
            border:      'none',
            color:       'rgba(255,255,255,0.5)',
            cursor:      'pointer',
            padding:     0,
            flexShrink:  0,
            marginTop:   '2px',
            lineHeight:  1,
            fontSize:    '14px',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  ) : null;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => open ? setOpen(false) : openPopover()}
        aria-label="More info"
        className="w-4 h-4 inline-flex items-center justify-center text-gray-400 hover:text-gray-600 transition shrink-0"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {mounted && createPortal(popover, document.body)}
    </span>
  );
}
