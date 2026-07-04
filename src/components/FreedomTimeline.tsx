'use client';

import { useEffect, useRef, useState } from 'react';
import type { Milestone } from '@/app/lib/milestoneCalculator';

const GOLD   = '#C9A84C';
const FOREST = '#1B3A2D';

const PALETTE: Record<string, { bg: string }> = {
  amber:   { bg: '#F59E0B' },
  emerald: { bg: '#10B981' },
  blue:    { bg: '#3B82F6' },
  purple:  { bg: '#8B5CF6' },
  forest:  { bg: FOREST },
  gray:    { bg: '#6B7280' },
};

// Bug 6 — consistent node radii by category
function nodeRadius(m: Milestone): number {
  if (m.id === 'full_freedom') return 26;
  if (m.category === 'stability' || m.category === 'strategy') return 18;
  return 20;
}

interface Props {
  milestones:      Milestone[];
  currentYear:     number;
  freedomYear:     number;
  isRecalculating: boolean;
}

// ─── Desktop SVG ─────────────────────────────────────────────────────────────

function DesktopTimeline({
  milestones, currentYear, freedomYear, width, isRecalculating,
}: Props & { width: number }) {
  // Bug 5 — line at 50% of height, room for staggered labels above and below
  const H      = 260;
  const LINE_Y = 130;
  const MX     = 72;
  const endYear = Math.max(freedomYear + 2, currentYear + 6);

  const toX = (year: number, month = 6) =>
    MX + ((year + month / 12 - currentYear) / (endYear - currentYear)) * (width - MX * 2);

  const todayMonth = new Date().getMonth();
  const todayX = toX(currentYear, todayMonth);

  const ticks: number[] = [];
  for (let y = currentYear; y <= endYear; y += 2) ticks.push(y);

  return (
    <svg width={width} height={H} style={{ overflow: 'visible' }}>
      {/* Recalculating shimmer */}
      {isRecalculating && (
        <rect x={MX} y={LINE_Y - 2} width={width - MX * 2} height={4} rx={2} fill={GOLD}>
          <animate attributeName="opacity" values="0.15;0.5;0.15" dur="1.1s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Base line */}
      <line x1={MX} y1={LINE_Y} x2={width - MX} y2={LINE_Y}
        stroke="#E5E7EB" strokeWidth={3} strokeLinecap="round" />

      {/* Gold progress to today */}
      <line x1={MX} y1={LINE_Y} x2={Math.min(todayX, width - MX)} y2={LINE_Y}
        stroke={GOLD} strokeWidth={3} strokeLinecap="round" />

      {/* Today dashed marker */}
      <line x1={todayX} y1={LINE_Y - 28} x2={todayX} y2={LINE_Y + 12}
        stroke={GOLD} strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={todayX} y={LINE_Y - 34} textAnchor="middle" fontSize={9}
        fill={GOLD} fontWeight="700" letterSpacing="0.03em">TODAY</text>

      {/* Year ticks */}
      {ticks.map(y => {
        const x = toX(y, 0);
        return (
          <g key={y}>
            <line x1={x} y1={LINE_Y - 4} x2={x} y2={LINE_Y + 4} stroke="#D1D5DB" strokeWidth={1} />
            <text x={x} y={LINE_Y + 16} textAnchor="middle" fontSize={9} fill="#9CA3AF">{y}</text>
          </g>
        );
      })}

      {/* Milestones */}
      {milestones.map((m, idx) => {
        const x      = toX(m.year, m.month);
        const isFree = m.id === 'full_freedom';
        const r      = nodeRadius(m);
        const col    = (PALETTE[m.color] ?? PALETTE.gray).bg;

        // Bug 4 — stagger: even idx labels above, odd labels below
        const isAbove = idx % 2 === 0;
        const labelY  = isAbove ? LINE_Y - r - 84 : LINE_Y + r + 8;
        const yearY   = isAbove ? LINE_Y + r + 16  : LINE_Y - r - 10;

        return (
          <g key={m.id}
            style={{ transform: `translateX(${x}px)`, transition: 'transform 600ms ease-out' }}>

            {/* Circle — Bug 6 sizes applied via nodeRadius() */}
            <circle cx={0} cy={LINE_Y} r={r} fill={col}
              stroke={isFree ? GOLD : 'none'} strokeWidth={isFree ? 2.5 : 0}
              style={isFree ? { filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.55))' } : undefined} />

            {/* Completed dimmer */}
            {m.completed && <circle cx={0} cy={LINE_Y} r={r} fill="rgba(0,0,0,0.28)" />}

            {/* Icon */}
            <text x={0} y={LINE_Y} textAnchor="middle" dominantBaseline="central"
              fontSize={isFree ? 16 : 12}>
              {m.completed ? '✓' : m.icon}
            </text>

            {/* Bug 4 — foreignObject labels: no truncation, word-wraps freely, 100px wide */}
            <foreignObject x={-50} y={labelY} width={100} height={80}>
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, color: '#111827',
                  lineHeight: 1.3, margin: 0, wordBreak: 'break-word', whiteSpace: 'normal',
                }}>{m.label}</p>
                <p style={{
                  fontSize: 10, color: '#9CA3AF',
                  lineHeight: 1.3, margin: '2px 0 0', wordBreak: 'break-word', whiteSpace: 'normal',
                }}>{m.sublabel}</p>
              </div>
            </foreignObject>

            {/* Year — above circle for below-staggered labels, below for above-staggered */}
            <text x={0} y={yearY} textAnchor="middle"
              fontSize={9} fill="#6B7280" fontWeight={isFree ? '700' : '400'}>
              {m.year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Mobile vertical list ─────────────────────────────────────────────────────

// SPINE_X: where the spine line and circle centers sit, measured from container left.
// Must be >= largest circle radius (26px for freedom node) so no circle clips.
const SPINE_X = 28;

function MobileTimeline({ milestones, currentYear, isRecalculating }: Props) {
  return (
    <div className="relative">
      {/* Vertical spine — light gray, sits behind circles */}
      <div style={{
        position: 'absolute', left: SPINE_X - 1, top: 0, bottom: 0,
        width: 2, background: '#E5E7EB', zIndex: 0,
      }} />
      {/* Gold today segment */}
      <div style={{
        position: 'absolute', left: SPINE_X - 1, top: 0,
        height: 40, width: 2, background: GOLD, zIndex: 0,
      }} />

      {isRecalculating && (
        <div style={{ paddingLeft: SPINE_X + 30, paddingBottom: 8 }}
          className="text-[10px] text-amber-500 font-semibold animate-pulse">
          Recalculating…
        </div>
      )}

      {milestones.map(m => {
        const col     = (PALETTE[m.color] ?? PALETTE.gray).bg;
        const isFree  = m.id === 'full_freedom';
        const isSmall = m.category === 'stability' || m.category === 'strategy';
        const sz      = isFree ? 52 : isSmall ? 36 : 40;
        // Push circle so its CENTER lands on SPINE_X — always >= 0 so never clips
        const circleMarginLeft = SPINE_X - sz / 2;

        return (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'flex-start',
            minHeight: 80, paddingTop: 8, paddingBottom: 8,
          }}>
            {/* Circle — in-flow, center aligned to SPINE_X */}
            <div style={{
              flexShrink: 0,
              marginLeft: circleMarginLeft,
              width: sz, height: sz,
              position: 'relative', zIndex: 10,
              borderRadius: '50%',
              background: col,
              border: isFree ? `2.5px solid ${GOLD}` : 'none',
              boxShadow: isFree
                ? `0 0 12px rgba(201,168,76,0.45)`
                : '0 1px 4px rgba(0,0,0,0.14)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: isFree ? 24 : 16,
            }}>
              {m.completed
                ? <span style={{ color: '#fff', fontWeight: 700 }}>✓</span>
                : <span>{m.icon}</span>}
            </div>

            {/* 16px gap between circle right edge and text */}
            <div style={{ width: 16, flexShrink: 0 }} />

            {/* Label — full remaining width, no truncation */}
            <div style={{ flex: 1, minWidth: 0, paddingRight: 16, paddingTop: 2 }}>
              <p style={{
                fontSize: 14, fontWeight: isFree ? 700 : 500,
                color: isFree ? '#92400E' : '#1F2937',
                lineHeight: 1.35, margin: 0,
                whiteSpace: 'normal', overflow: 'visible', wordBreak: 'break-word',
              }}>{m.label}</p>
              <p style={{
                fontSize: 12, color: '#6B7280',
                lineHeight: 1.35, margin: '3px 0 0',
                whiteSpace: 'normal', overflow: 'visible', wordBreak: 'break-word',
              }}>{m.sublabel}</p>
              <p style={{
                fontSize: 12, fontWeight: 700,
                color: isFree ? GOLD : '#059669',
                margin: '5px 0 0',
              }}>
                {m.year}
                {m.year < currentYear && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · past</span>}
                {m.year === currentYear && <span style={{ color: '#9CA3AF', fontWeight: 400 }}> · this year</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Exported component (responsive) ─────────────────────────────────────────

export function FreedomTimeline({ milestones, currentYear, freedomYear, isRecalculating }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]     = useState(700);
  const [isMobile, setMobile] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setWidth(w);
      setMobile(w < 640); // Bug 7 — was 560
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      {isMobile
        ? <MobileTimeline milestones={milestones} currentYear={currentYear} freedomYear={freedomYear} isRecalculating={isRecalculating} />
        : <DesktopTimeline milestones={milestones} currentYear={currentYear} freedomYear={freedomYear} width={width} isRecalculating={isRecalculating} />
      }
    </div>
  );
}
