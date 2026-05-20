/**
 * Primitive: timeline
 *
 * Draws the time axis — a single line with one tick per event — and
 * renders the time label for each event beneath its tick.
 *
 * This primitive has exactly one job: establish the spatial coordinate system
 * and render the temporal axis. Event markers (dots, pins) belong in events().
 * Participant nodes belong in characters(). Keep them separate.
 *
 * Needs:    —
 * Provides: sceneX     fn(eventIndex) → x pixel
 *           sceneY     fn(eventIndex) → y pixel
 *           direction  'x' | 'y'
 *
 * Options:
 *   direction   'x' (horizontal, default) | 'y' (vertical)
 *   margin      px from edge to first/last tick (default 80)
 *   stroke      axis line and tick colour (default '#d1d5db')
 *   tickRadius  tick dot radius (default 2)
 *   times       show the time label for each event (default true)
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

export function timeline(opts = {}) {
  const {
    direction  = 'x',
    margin     = 80,
    stroke     = '#d1d5db',
    tickRadius = 2,
    times      = true,
  } = opts;

  return {
    id:       'timeline',
    needs:    [],
    provides: ['sceneX', 'sceneY', 'direction'],

    render(ctx) {
      const { width, height, padding, axisRatio = 0.5 } = ctx.opts;
      const { data } = ctx;
      const n        = data.events.length;
      const bgLayer  = ctx.get('layer')('background');
      const lblLayer = ctx.get('layer')('labels');

      if (direction === 'x') {
        const x0    = padding.left  + margin;
        const x1    = width  - padding.right  - margin;
        const axisY = height * axisRatio;
        const scale = d3.scaleLinear().domain([0, Math.max(n - 1, 1)]).range([x0, x1]);

        ctx.set('sceneX',    i  => scale(i));
        ctx.set('sceneY',    () => axisY);
        ctx.set('direction', 'x');

        // Axis line
        bgLayer.append('line')
          .attr('x1', x0).attr('y1', axisY)
          .attr('x2', x1).attr('y2', axisY)
          .attr('stroke', stroke).attr('stroke-width', 1.5)
          .attr('stroke-linecap', 'round');

        data.events.forEach((event, i) => {
          const cx = scale(i);

          // Tick dot
          bgLayer.append('circle')
            .attr('cx', cx).attr('cy', axisY)
            .attr('r', tickRadius)
            .attr('fill', stroke);

          // Time label — alternating depth so adjacent labels never collide
          if (times && event.time) {
            const labelY = axisY + (i % 2 === 0 ? 14 : 26);
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
