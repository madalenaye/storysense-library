/**
 * Primitive: locations
 *
 * Places one node per location that is visited by at least one event.
 * Nodes are arranged in a circle by default and are draggable — dragging
 * updates locPos/locDotPos live so movement() redraws its paths instantly.
 *
 * Needs:    —
 * Provides: locPos    fn(locationId) → {x, y}      (live, updates on drag)
 *           locDotPos fn(eventIndex) → {x, y}       (live, updates on drag)
 *
 * Options:
 *   positions  { [locationId]: {x, y} } — override automatic circle layout
 *   r          node radius in px (default 28)
 *   fill       node background colour (default '#fef9ee')
 *   stroke     node border colour (default '#e0b97a')
 *   labels     show location name above each node (default true)
 *   margin     edge margin for the auto circle layout (default 80)
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

export function locations(opts = {}) {
  const {
    positions = null,
    r         = 28,
    fill      = '#fef9ee',
    stroke    = '#e0b97a',
    labels    = true,
    margin    = 80,
  } = opts;

  return {
    id:       'locations',
    needs:    [],
    provides: ['locPos', 'locDotPos'],

    render(ctx) {
      const { data }          = ctx;
      const { width, height } = ctx.opts;
      const layer             = ctx.get('layer')('nodes');
      const lblLayer          = ctx.get('layer')('labels');
      const svg               = ctx.get('svg');

      // Only include locations that are actually referenced by events
      const visitedIds = new Set(data.events.map(e => e.location?.id).filter(Boolean));
      const locs = data.locations.filter(l => visitedIds.has(l.id));

      // Mutable position store — locPos and locDotPos always read from this live
      const pos = {};
      locs.forEach((loc, i) => {
        if (positions?.[loc.id]) {
          pos[loc.id] = { ...positions[loc.id] };
        } else {
          const n     = locs.length;
          const lcx   = width  / 2;
          const lcy   = height / 2;
          const rad   = Math.min(width, height) / 2 - margin;
          const angle = n === 1 ? 0 : (i / n) * 2 * Math.PI - Math.PI / 2;
          pos[loc.id] = {
            x: n === 1 ? lcx : lcx + rad * Math.cos(angle),
            y: n === 1 ? lcy : lcy + rad * Math.sin(angle),
          };
        }
      });

      ctx.set('locPos', locId => pos[locId] ?? null);

      // Which events visit each location, in narrative order
      const eventsByLoc = {};
      data.events.forEach((event, ei) => {
        const locId = event.location?.id;
        if (locId) (eventsByLoc[locId] ??= []).push(ei);
      });

      const dotR    = 4;
      const spacing = dotR * 2 + 6;
      const dotY    = r + 22;

      ctx.set('locDotPos', ei => {
        const locId = data.events[ei]?.location?.id;
        if (!locId) return null;
        const p = pos[locId];
        if (!p) return null;
        const locEvents = eventsByLoc[locId] ?? [];
        const di = locEvents.indexOf(ei);
        if (di === -1) return null;
        const totalW = (locEvents.length - 1) * spacing;
        const startX = -totalW / 2;
        const dotCx  = locEvents.length === 1 ? 0 : startX + di * spacing;
        return { x: p.x + dotCx, y: p.y + dotY };
      });

      // Tick-listener registry for movement()
      const tickListeners = [];
      ctx.set('tickListeners', tickListeners);

      const maxEi = data.events.length - 1;

      // ── Draw nodes ────────────────────────────────────────────────────────────
      locs.forEach(loc => {
        const { x, y }    = pos[loc.id];
        const locEvents   = eventsByLoc[loc.id] ?? [];
        const totalW      = (locEvents.length - 1) * spacing;
        const startX      = -totalW / 2;

        const g = layer.append('g')
          .datum(loc)
          .attr('transform', `translate(${x},${y})`)
          .style('cursor', 'grab');

        g.append('circle')
          .attr('r', r)
          .attr('fill', fill)
          .attr('stroke', stroke)
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))');

        if (labels) {
          lblLayer.append('text')
            .attr('class', `ss-loc-label ss-loc-label-${loc.id}`)
            .attr('x', x).attr('y', y - r - 8)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#374151')
            .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
            .text(loc.name ?? loc.id);
        }

        // Visit dot tray
        if (locEvents.length) {
          g.append('rect')
            .attr('x', startX - dotR - 4).attr('y', dotY - dotR - 3)
            .attr('width', totalW + dotR * 2 + 8).attr('height', dotR * 2 + 6)
            .attr('rx', 4)
            .attr('fill', '#f9fafb').attr('stroke', '#e5e7eb').attr('stroke-width', 1);

          locEvents.forEach((ei, di) => {
            const dotColor = ei === 0      ? '#10b981'
                           : ei === maxEi  ? '#ef4444'
                           :                 '#e0b97a';
            const dotCx = locEvents.length === 1 ? 0 : startX + di * spacing;
            g.append('circle')
              .attr('cx', dotCx).attr('cy', dotY)
              .attr('r', dotR)
              .attr('fill', dotColor)
              .attr('stroke', '#fff').attr('stroke-width', 1.5);
          });
        }
      });

      // ── Drag ─────────────────────────────────────────────────────────────────
      const locGroups = layer.selectAll('g').filter(d => d && d.id && pos[d.id]);

      const drag = d3.drag()
        .on('start', function() {
          d3.select(this).style('cursor', 'grabbing').raise();
        })
        .on('drag', function(event, d) {
          pos[d.id].x = event.x;
          pos[d.id].y = event.y;
          d3.select(this).attr('transform', `translate(${event.x},${event.y})`);
          if (labels) {
            svg.select(`.ss-loc-label-${d.id}`)
              .attr('x', event.x).attr('y', event.y - r - 8);
          }
          tickListeners.forEach(fn => fn());
        })
        .on('end', function() {
          d3.select(this).style('cursor', 'grab');
        });

      locGroups.call(drag);
    },
  };
}
