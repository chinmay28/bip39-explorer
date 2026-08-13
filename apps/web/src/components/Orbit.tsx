import { useMemo } from 'react';
import type { Edge, Graph } from '../lib/graph';
import { childrenOf, groupsFor, strongNeighbours } from '../lib/graph';
import { familyOf } from '../lib/relations';
import { relationLabel, relationRank, sourceName } from '../lib/index-data';
import { padIndex, toBits } from '../lib/bits';

/**
 * The map: one word at the centre, its relations on spokes, and any spoke
 * node openable into a fan of its own.
 *
 * Laid out by hand rather than by a force simulation. A force layout would
 * settle somewhere different on every visit and put labels wherever they
 * landed; here a spoke's angle is a function of how many spokes there are, so
 * the same word always draws the same picture and every caption has a place.
 */

const SPOKE_ANGLES: Record<number, number[]> = {
  1: [0],
  2: [-32, 148],
  3: [-90, 30, 150],
  4: [-42, 42, 138, 222],
  5: [-90, -20, 52, 128, 200],
  6: [-90, -34, 34, 90, 146, 214],
};

interface Metrics {
  minWidth: number;
  rx: number;
  ry: number;
  spokes: number;
  perSpoke: number;
  font: number;
  centre: number;
  label: number;
  charWidth: number;
  pad: number;
  pillHeight: number;
  rowHeight: number;
  hit: number;
}

/**
 * A phone is portrait and a third the width, so it gets a portrait frame,
 * tighter rings and four spokes rather than six — not the desktop layout
 * scaled down until the words are unreadable.
 */
export function metricsFor(narrow: boolean): Metrics {
  return narrow
    ? { minWidth: 340, rx: 104, ry: 152, spokes: 4, perSpoke: 3, font: 12.5,
        centre: 18, label: 9.4, charWidth: 7.55, pad: 9, pillHeight: 26, rowHeight: 29, hit: 16 }
    : { minWidth: 560, rx: 176, ry: 126, spokes: 6, perSpoke: 4, font: 12.5,
        centre: 21, label: 8.6, charWidth: 7.55, pad: 10, pillHeight: 23, rowHeight: 24, hit: 13 };
}

/**
 * The frame is measured from what actually got drawn, not fixed in advance:
 * opening a node pushes its fan outward, and a word with two relations should
 * not be framed as if it had six.
 */
class Frame {
  private minX = Infinity;
  private minY = Infinity;
  private maxX = -Infinity;
  private maxY = -Infinity;

  add(x: number, y: number): void {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  viewBox(padding: number, minWidth: number): string {
    let width = this.maxX - this.minX + padding * 2;
    const height = this.maxY - this.minY + padding * 2;
    let x = this.minX - padding;
    const y = this.minY - padding;
    if (width < minWidth) {
      x -= (minWidth - width) / 2;
      width = minWidth;
    }
    return [x, y, width, height].map((n) => n.toFixed(1)).join(' ');
  }
}

export interface OrbitProps {
  graph: Graph;
  words: readonly string[];
  index: number;
  narrow: boolean;
  opened: ReadonlySet<number>;
  coherent: boolean;
  onSelect: (index: number) => void;
  onToggleOpen: (index: number) => void;
}

interface Pill {
  key: string;
  word: string;
  index: number;
  x: number;
  y: number;
  half: number;
  height: number;
  family: string;
  opacity: number;
  title: string;
  /** Children are outlined and dashed — a different rank of thing. */
  child: boolean;
}

interface Spoke {
  key: string;
  label: string;
  family: string;
  labelX: number;
  labelY: number;
  line: { x1: number; y1: number; x2: number; y2: number };
}

interface Toggle {
  index: number;
  word: string;
  x: number;
  y: number;
  family: string;
  open: boolean;
  radius: number;
  hit: number;
}

export function Orbit({
  graph, words, index, narrow, opened, coherent, onSelect, onToggleOpen,
}: OrbitProps) {
  const m = metricsFor(narrow);

  const scene = useMemo(() => {
    const frame = new Frame();
    const pills: Pill[] = [];
    const spokes: Spoke[] = [];
    const toggles: Toggle[] = [];
    const links: { key: string; x1: number; y1: number; x2: number; y2: number; family: string }[] = [];

    const word = words[index];
    const allGroups = groupsFor(graph, index, m.perSpoke, relationRank);
    const groups = allGroups.slice(0, m.spokes);
    const rootSet = strongNeighbours(graph, index);

    const claimed = new Set<number>([index]);
    for (const group of groups) for (const edge of group.shown) claimed.add(edge.to);

    const halfW = Math.max(70, (word.length * m.centre * 0.62) / 2 + 24);
    frame.add(-halfW, -31);
    frame.add(halfW, 31);

    const angles = SPOKE_ANGLES[groups.length] ?? [];
    groups.forEach((group, i) => {
      const radians = (angles[i] * Math.PI) / 180;
      const cx = Math.cos(radians) * m.rx;
      const cy = Math.sin(radians) * m.ry;
      const family = familyOf(group.relation);
      const spread = ((group.shown.length - 1) * m.rowHeight) / 2;
      const hidden = group.edges.length - group.shown.length;
      const label = relationLabel(group.relation) + (hidden > 0 ? ` +${hidden}` : '');

      spokes.push({
        key: group.relation,
        label,
        family,
        labelX: cx,
        labelY: cy - spread - 19,
        line: {
          x1: Math.cos(radians) * halfW * 0.95,
          y1: Math.sin(radians) * 38,
          x2: cx * 0.78,
          y2: cy * 0.78,
        },
      });
      const labelHalf = (label.length * m.label * 0.72) / 2;
      frame.add(cx - labelHalf, cy - spread - 26);
      frame.add(cx + labelHalf, cy - spread - 26);

      group.shown.forEach((edge: Edge, k: number) => {
        const y = cy - spread + k * m.rowHeight;
        const child = words[edge.to];
        const half = (child.length * m.charWidth) / 2 + m.pad;
        const isOpen = opened.has(edge.to);

        if (isOpen) {
          // The fan stays inside this spoke's sector, and far enough out to
          // clear the spoke's own caption — otherwise the first child is
          // written straight through it. One branch at a time is the point:
          // the map never becomes a hairball.
          const kids = childrenOf(graph, edge.to, 2, claimed, coherent ? rootSet : null).slice(0, 3);
          kids.forEach((kid, j) => {
            claimed.add(kid.to);
            const offset = ((j - (kids.length - 1) / 2) * 15 * Math.PI) / 180;
            const kx = Math.cos(radians + offset) * m.rx * 2.05;
            const ky = Math.sin(radians + offset) * m.ry * 1.95;
            const kidWord = words[kid.to];
            const kidHalf = (kidWord.length * m.charWidth * 0.9) / 2 + m.pad - 2;
            const kidFamily = familyOf(kid.relation);
            links.push({ key: `${edge.to}-${kid.to}`, x1: cx, y1: y, x2: kx, y2: ky, family: kidFamily });
            pills.push({
              key: `kid-${edge.to}-${kid.to}`,
              word: kidWord,
              index: kid.to,
              x: kx, y: ky, half: kidHalf, height: 22,
              family: kidFamily,
              opacity: 1,
              title: `${kidWord} — ${relationLabel(kid.relation)} ${child} — ${kid.score}/100`,
              child: true,
            });
            frame.add(kx - kidHalf, ky - 11);
            frame.add(kx + kidHalf, ky + 11);
          });
        }

        pills.push({
          key: `pill-${edge.to}`,
          word: child,
          index: edge.to,
          x: cx, y, half, height: m.pillHeight,
          family,
          // A 98 is a fact and a 26 is a hunch; the map should not present
          // them identically.
          opacity: 0.42 + 0.58 * (edge.score / 100),
          title: `${child} — ${relationLabel(group.relation)} — ${edge.score}/100 — ${sourceName(edge.mask)}`,
          child: false,
        });
        toggles.push({
          index: edge.to, word: child, x: cx + half + 10, y, family,
          open: isOpen, radius: 9, hit: m.hit,
        });
        frame.add(cx - half, y - m.pillHeight / 2);
        frame.add(cx + half + 10 + m.hit, y + m.pillHeight / 2);
      });
    });

    if (groups.length === 0) frame.add(-150, -70);

    return {
      pills, spokes, toggles, links, halfW,
      empty: groups.length === 0,
      shownGroups: groups.length,
      totalGroups: allGroups.length,
      viewBox: frame.viewBox(16, m.minWidth),
    };
  }, [graph, words, index, m, opened, coherent]);

  const word = words[index];

  return (
    <div className="panel">
      <div className="panel__bar">
        <span className="panel__title">Map</span>
        <span className="muted-line">
          {scene.totalGroups > scene.shownGroups
            ? `${scene.shownGroups} of ${scene.totalGroups} relations — Tree shows every one`
            : 'tap + to open a word’s own links'}
        </span>
      </div>
      <div className="map">
        <svg className="orbit" viewBox={scene.viewBox} role="img" aria-label={`Relation map for ${word}`}>
          {scene.spokes.map((spoke) => (
            <line
              key={`line-${spoke.key}`}
              x1={spoke.line.x1} y1={spoke.line.y1} x2={spoke.line.x2} y2={spoke.line.y2}
              stroke={`var(--fam-${spoke.family})`} strokeWidth={1.25} strokeDasharray="3 3" opacity={0.6}
            />
          ))}
          {scene.links.map((link) => (
            <line
              key={`kidline-${link.key}`}
              x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2}
              stroke={`var(--fam-${link.family})`} strokeWidth={1} strokeDasharray="2 3" opacity={0.45}
            />
          ))}

          <g>
            <rect
              x={-scene.halfW} y={-31} width={scene.halfW * 2} height={62} rx={15}
              fill="var(--fam-identity-bg)" stroke="var(--fam-identity)" strokeWidth={1.6}
            />
            <text
              className="orbit__center" x={0} y={-2} textAnchor="middle"
              style={{ fontSize: `${m.centre}px` }} fill="var(--fam-identity)"
            >
              {word}
            </text>
            <text
              x={0} y={17} textAnchor="middle" fill="var(--muted)"
              style={{ fontFamily: 'var(--mono)', fontSize: '9.5px' }}
            >
              {`#${padIndex(index)} · ${toBits(index)}`}
            </text>
          </g>

          {scene.empty && (
            <text className="orbit__empty" x={0} y={-58} textAnchor="middle" style={{ fontSize: '12px' }}>
              No semantic neighbours — see the letters below.
            </text>
          )}

          {scene.spokes.map((spoke) => (
            <text
              key={`label-${spoke.key}`}
              className="orbit__label" x={spoke.labelX} y={spoke.labelY} textAnchor="middle"
              style={{ fontSize: `${m.label}px` }} fill={`var(--fam-${spoke.family})`}
            >
              {spoke.label}
            </text>
          ))}

          {scene.pills.map((pill) => (
            <g
              key={pill.key}
              className="orbit__pill"
              tabIndex={0}
              role="button"
              aria-label={pill.title}
              onClick={() => onSelect(pill.index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(pill.index);
                }
              }}
            >
              <title>{pill.title}</title>
              <rect
                x={pill.x - pill.half} y={pill.y - pill.height / 2}
                width={pill.half * 2} height={pill.height} rx={pill.height / 2}
                fill={pill.child ? 'var(--surface)' : `var(--fam-${pill.family}-bg)`}
                stroke={`var(--fam-${pill.family})`} strokeWidth={1}
                strokeDasharray={pill.child ? '3 2' : undefined}
                opacity={pill.opacity}
              />
              <text
                className="orbit__word" x={pill.x} y={pill.y + (pill.child ? 3.8 : 4)} textAnchor="middle"
                style={{ fontSize: `${pill.child ? m.font * 0.9 : m.font}px` }}
                fill={`var(--fam-${pill.family})`}
              >
                {pill.word}
              </text>
            </g>
          ))}

          {scene.toggles.map((toggle) => (
            <g
              key={`toggle-${toggle.index}`}
              className="orbit__more"
              tabIndex={0}
              role="button"
              aria-pressed={toggle.open}
              aria-label={`${toggle.open ? 'Close' : 'Open'} ${toggle.word}’s own links`}
              onClick={() => onToggleOpen(toggle.index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onToggleOpen(toggle.index);
                }
              }}
            >
              <title>{`${toggle.open ? 'Close' : 'Open'} ${toggle.word}’s own links`}</title>
              {/* An invisible disc twice the drawn size, so the control is a
                  real target for a fingertip. */}
              <circle cx={toggle.x} cy={toggle.y} r={toggle.hit} fill="transparent" />
              <circle
                cx={toggle.x} cy={toggle.y} r={toggle.radius}
                fill="var(--surface)" stroke={`var(--fam-${toggle.family})`} strokeWidth={1}
              />
              <text
                x={toggle.x} y={toggle.y + 3.8} textAnchor="middle"
                style={{ fontSize: '12px' }} fill={`var(--fam-${toggle.family})`}
              >
                {toggle.open ? '−' : '+'}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
