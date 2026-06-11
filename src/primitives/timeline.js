/**
 * Primitive: timeline
 *
 * Draws the time axis — a single line with one tick per event — and
 * renders the time label for each event beneath its tick.
 *
 * This primitive has exactly one job: establish the spatial coordinate system
 * and render the temporal axis. Event markers (dots, pins) belong in events().
 * Participant nodes belong in participants(). Keep them separate.
 *
 * Needs:    —
 * Provides: sceneX     fn(eventIndex) → x pixel
 *           sceneY     fn(eventIndex) → y pixel
 *           direction  'x' | 'y'
 *
 * Options:
 *   direction      'x' (horizontal, default) | 'y' (vertical)
 *   margin         px from edge to first/last tick (default 80)
 *   stroke         axis line and tick colour (default '#d1d5db')
 *   tickRadius     tick dot radius (default 2)
 *   times          show the time label for each event (default true)
 *   showLocations  colour-code axis segments by event location and label each run (default false)
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const LOC_PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
];

export function timeline(opts = {}) {
  const {
    direction     = 'x',
    margin        = 80,
    stroke        = '#d1d5db',
    tickRadius    = 2,
    times         = true,
    labelSide     = 'below',
    showLocations = false,
  } = opts;

  return {
    id:         'timeline',
    _direction: direction,
    needs:    [],
    provides: ['sceneX', 'sceneY', 'direction'],

    render(ctx) {
      const { width, height, padding, axisRatio = 0.5 } = ctx.opts;
      const { data } = ctx;
      const n        = data.events.length;
      const bgLayer  = ctx.get('layer')('background');
      const lblLayer = ctx.get('layer')('labels');

      let locColor = null;
      let locRuns  = [];
      if (showLocations && data.events.some(e => e.location)) {
        const locOrder = new Map();
        data.locations.forEach((l, i) => locOrder.set(l.id, i));
        locColor = locId => LOC_PALETTE[locOrder.get(locId) % LOC_PALETTE.length] ?? '#999';

        data.events.forEach((event, i) => {
          const locId = event.location?.id ?? null;
          if (locRuns.length && locRuns[locRuns.length - 1].locId === locId) {
            locRuns[locRuns.length - 1].end = i;
          } else {
            locRuns.push({ locId, loc: event.location ?? null, start: i, end: i });
          }
        });
        locRuns = locRuns.filter(r => r.locId);
      }

      if (direction === 'x') {
        const x0    = padding.left  + margin;
        const x1    = width  - padding.right  - margin;
        const axisY = height * axisRatio;
        const scale = d3.scaleLinear().domain([0, Math.max(n - 1, 1)]).range([x0, x1]);

        ctx.set('sceneX',    i  => scale(i));
        ctx.set('sceneY',    () => axisY);
        ctx.set('direction', 'x');

        bgLayer.append('line')
          .attr('x1', x0).attr('y1', axisY)
          .attr('x2', x1).attr('y2', axisY)
          .attr('stroke', stroke).attr('stroke-width', 1.5)
          .attr('stroke-linecap', 'round');

        if (showLocations) {
          locRuns.forEach(({ locId, start, end }) => {
            const bx0 = scale(start);
            const bx1 = scale(end);
            bgLayer.append('line')
              .attr('x1', bx0).attr('y1', axisY)
              .attr('x2', bx1).attr('y2', axisY)
              .attr('stroke', locColor(locId))
              .attr('stroke-width', 4)
              .attr('opacity', 0.5)
              .attr('stroke-linecap', 'round');
          });

          const lineHeight = 11;
          const maxPerLine = 12;
          const rowBaseY = labelSide === 'above'
            ? [axisY + 12, axisY + 23, axisY + 34]
            : [axisY - 12, axisY - 23, axisY - 34];
          const rowRight = []; 

          const entries = [...locRuns]
            .map(run => {
              const midX  = (scale(run.start) + scale(run.end)) / 2;
              const name  = run.loc?.name ?? run.locId;
              const words = name.split(' ');
              const lines = [];
              let cur = '';
              for (const w of words) {
                const next = cur ? cur + ' ' + w : w;
                if (next.length > maxPerLine && cur) { lines.push(cur); cur = w; }
                else cur = next;
              }
              if (cur) lines.push(cur);
              const halfW = Math.max(...lines.map(l => l.length)) * 5.5;
              return { run, midX, lines, halfW };
            })
            .sort((a, b) => a.midX - b.midX);

          entries.forEach(({ run, midX, lines, halfW }) => {
            let rowIdx = -1;
            for (let r = 0; r < rowBaseY.length; r++) {
              if ((rowRight[r] ?? -Infinity) < midX - halfW - 4) { rowIdx = r; break; }
            }
            if (rowIdx === -1) return; 
            rowRight[rowIdx] = midX + halfW;

            const col  = locColor(run.locId);
            const base = rowBaseY[rowIdx];
            const topY = labelSide === 'above'
              ? base
              : base - (lines.length - 1) * lineHeight;

            const textEl = lblLayer.append('text')
              .attr('text-anchor', 'middle')
              .attr('font-size', '9px').attr('font-weight', '600')
              .attr('fill', col);
            lines.forEach((line, i) => {
              textEl.append('tspan')
                .attr('x', midX)
                .attr('y', topY + i * lineHeight)
                .text(line);
            });
          });
        }

        data.events.forEach((event, i) => {
          const cx = scale(i);

          bgLayer.append('circle')
            .attr('cx', cx).attr('cy', axisY)
            .attr('r', tickRadius)
            .attr('fill', stroke);

          if (times && event.time) {
            const offset = i % 2 === 0 ? 14 : 26;
            const labelY = labelSide === 'above' ? axisY - offset : axisY + offset;
            lblLayer.append('text')
              .attr('x', cx).attr('y', labelY)
              .attr('text-anchor', 'middle')
              .attr('font-size', '9px')
              .attr('fill', '#9ca3af')
              .text(event.time.value);
          }
        });

      } else {
        const y0    = padding.top    + margin;
        const y1    = height - padding.bottom - margin;
        const axisX = width  * axisRatio;
        const scale = d3.scaleLinear().domain([0, Math.max(n - 1, 1)]).range([y0, y1]);

        ctx.set('sceneX',    () => axisX);
        ctx.set('sceneY',    i  => scale(i));
        ctx.set('direction', 'y');

        bgLayer.append('line')
          .attr('x1', axisX).attr('y1', y0)
          .attr('x2', axisX).attr('y2', y1)
          .attr('stroke', stroke).attr('stroke-width', 1.5)
          .attr('stroke-linecap', 'round');

        if (showLocations) {
          locRuns.forEach(({ locId, start, end }) => {
            bgLayer.append('line')
              .attr('x1', axisX).attr('y1', scale(start))
              .attr('x2', axisX).attr('y2', scale(end))
              .attr('stroke', locColor(locId))
              .attr('stroke-width', 4)
              .attr('opacity', 0.5)
              .attr('stroke-linecap', 'round');
          });


          locRuns.forEach(({ locId, loc, start, end }) => {
            const by0 = scale(start);
            const by1 = scale(end);
            if (by1 - by0 < 1 && start !== end) return;
            const midY = (by0 + by1) / 2;
            lblLayer.append('text')
              .attr('x', axisX + 10).attr('y', midY)
              .attr('text-anchor', 'start')
              .attr('dominant-baseline', 'middle')
              .attr('font-size', '9px').attr('font-weight', '600')
              .attr('fill', locColor(locId))
              .text(loc?.name ?? locId);
          });
        }

        data.events.forEach((event, i) => {
          const cy = scale(i);

          bgLayer.append('circle')
            .attr('cx', axisX).attr('cy', cy)
            .attr('r', tickRadius)
            .attr('fill', stroke);

          if (times && event.time) {
            lblLayer.append('text')
              .attr('x', axisX - 10).attr('y', cy + 4)
              .attr('text-anchor', 'end')
              .attr('font-size', '9px')
              .attr('fill', '#9ca3af')
              .text(event.time.value);
          }
        });
      }
    },
  };
}
