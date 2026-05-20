/**
 * Primitive: lifelines
 *
 * Draws a continuous coloured line per participant across all events.
 * Segments where the participant is absent at either endpoint are dashed.
 *
 * When a live force simulation is running (tickListeners in context), lifelines
 * register a position-update callback so they redraw on every tick.
 *
 * Needs:    charPos
 * Provides: —
 *
 * Options:
 *   stroke      colour string or fn(participant) → string
 *               Default: uses the narrative's categorical colour for each participant.
 *   strokeWidth line width in px (default 1.5)
 *   opacity     line opacity (default 0.4)
 *   dash        SVG stroke-dasharray for absent segments (default '4,4')
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

export function lifelines(opts = {}) {
  const {
    stroke      = null,   // null → use data.colorOf per participant
    strokeWidth = 1.5,
    opacity     = 0.4,
    dash        = '4,4',
  } = opts;

  return {
    id:       'lifelines',
    needs:    ['charPos'],
    provides: [],

    render(ctx) {
      const charPos  = ctx.get('charPos');
      const layer    = ctx.get('layer')('paths');
      const { data } = ctx;

      // Build O(1) presence lookup: participantId → Set of eventIndices
      const present = new Map();
      data.events.forEach((event, ei) => {
        event.participantIds.forEach(pid => {
          if (!present.has(pid)) present.set(pid, new Set());
          present.get(pid).add(ei);
        });
      });

      const segments = []; // for live tick updates

      data.participants.forEach(participant => {
        const col = stroke
          ? (typeof stroke === 'function' ? stroke(participant) : stroke)
          : data.colorOf(participant.id);

        const className = `ss-lifeline-${participant.id}`;

        data.events.forEach((_, ei) => {
          if (ei === 0) return;
          const from = charPos(participant.id, ei - 1);
          const to   = charPos(participant.id, ei);
          if (!from || !to) return;

          const pres       = present.get(participant.id);
          const isDashed   = !pres?.has(ei - 1) || !pres?.has(ei);

          const seg = layer.append('line')
            .attr('class', `ss-lifeline ${className}`)
            .attr('x1', from.x).attr('y1', from.y)
            .attr('x2', to.x).attr('y2', to.y)
            .attr('stroke', col)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-linecap', 'round')
            .attr('opacity', opacity);

          if (isDashed) seg.attr('stroke-dasharray', dash);

          segments.push({ pid: participant.id, fromEi: ei - 1, toEi: ei, el: seg });
        });

        // Highlight the whole lifeline on hover
        layer.selectAll(`.${className}`)
          .on('mouseover', function() {
            d3.selectAll(`.${className}`)
              .attr('stroke-width', strokeWidth * 1.8)
              .attr('opacity', Math.min(opacity * 2, 1));
          })
          .on('mouseout', function() {
            d3.selectAll(`.${className}`)
              .attr('stroke-width', strokeWidth)
              .attr('opacity', opacity);
          });
      });

      const tickListeners = ctx.get('tickListeners');
      if (tickListeners) {
        tickListeners.push(() => {
          segments.forEach(({ pid, fromEi, toEi, el }) => {
            const from = charPos(pid, fromEi);
            const to   = charPos(pid, toEi);
            if (!from || !to) return;
            el.attr('x1', from.x).attr('y1', from.y)
              .attr('x2', to.x).attr('y2', to.y);
          });
        });
      }
    },
  };
}
