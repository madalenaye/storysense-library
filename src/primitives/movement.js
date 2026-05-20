/**
 * Primitive: movement
 *
 * Draws bezier arcs between locations following narrative event order.
 * Cross-location transitions use cubic beziers; same-location transitions
 * use small arcs below the dot tray with alternating depths to avoid stacking.
 *
 * When locations() drag fires, all paths are recomputed instantly.
 *
 * Needs:    locPos
 * Provides: —
 *
 * Options:
 *   stroke      colour string (default '#999')
 *   strokeWidth path width in px (default 2)
 *   opacity     path opacity (default 0.7)
 *   arrow       show direction chevron at arc midpoint (default true)
 *   curvature   max perpendicular offset in px for cross-location arcs (default 25)
 */
export function movement(opts = {}) {
  const {
    stroke      = '#999',
    strokeWidth = 2,
    opacity     = 0.7,
    arrow       = true,
    curvature   = 25,
  } = opts;

  const HIGHLIGHT = '#e0b97a';

  return {
    id:       'movement',
    needs:    ['locPos'],
    provides: [],

    render(ctx) {
      const locPos    = ctx.get('locPos');
      const locDotPos = ctx.has('locDotPos') ? ctx.get('locDotPos') : null;
      const layer     = ctx.get('layer')('overlay');
      const { data }  = ctx;
      const svgNode   = ctx.get('svg').node();

      // Collect (eventIndex, locationId) pairs in narrative order
      const visits = data.events
        .map((event, ei) => ({ ei, locId: event.location?.id ?? null }))
        .filter(v => v.locId);

      const segments   = [];
      const pairCount  = {};

      visits.forEach((a, i) => {
        if (i >= visits.length - 1) return;
        const b = visits[i + 1];

        const pairKey  = [a.locId, b.locId].sort().join('→');
        const visitIdx = pairCount[pairKey] ?? 0;
        pairCount[pairKey] = visitIdx + 1;

        const isSameLoc = a.locId === b.locId;

        const pathEl = layer.append('path')
          .attr('fill', 'none')
          .attr('stroke', stroke)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-linecap', 'round')
          .attr('opacity', opacity);

        let arrowGroup = null;
        if (arrow) {
          arrowGroup = layer.append('g');
          arrowGroup.append('path')
            .attr('d', 'M-2,-2L2,0L-2,2')
            .attr('fill', 'none')
            .attr('stroke', stroke)
            .attr('stroke-width', 1.5)
            .attr('stroke-linecap', 'round')
            .attr('stroke-linejoin', 'round')
            .attr('opacity', opacity);
        }

        const hitEl = layer.append('path')
          .attr('fill', 'none')
          .attr('stroke', 'transparent')
          .attr('stroke-width', 12)
          .style('cursor', 'pointer');

        const fromEvent = data.events[a.ei];
        const toEvent   = data.events[b.ei];
        const fromLoc   = data.locationById.get(a.locId);
        const toLoc     = data.locationById.get(b.locId);

        hitEl
          .on('mouseover', function(domEvent) {
            pathEl.attr('stroke', HIGHLIGHT).attr('stroke-width', strokeWidth + 1).attr('opacity', 1);
            if (arrowGroup) arrowGroup.select('path').attr('stroke', HIGHLIGHT).attr('opacity', 1);
            const tt = ctx.get('tooltip');
            if (!tt) return;
            const rect = svgNode.parentElement.getBoundingClientRect();
            const locLabel = isSameLoc
              ? `<span style="color:#6b7280">${fromLoc?.name ?? a.locId}</span>`
              : `<span style="color:#6b7280">${fromLoc?.name ?? a.locId} → ${toLoc?.name ?? b.locId}</span>`;
            tt.show(
              domEvent.clientX - rect.left,
              domEvent.clientY - rect.top,
              `${locLabel}<br><strong>${fromEvent?.title ?? `Event ${a.ei}`}</strong> → <strong>${toEvent?.title ?? `Event ${b.ei}`}</strong>`
            );
          })
          .on('mouseout', function() {
            pathEl.attr('stroke', stroke).attr('stroke-width', strokeWidth).attr('opacity', opacity);
            if (arrowGroup) arrowGroup.select('path').attr('stroke', stroke).attr('opacity', opacity);
            ctx.get('tooltip')?.hide();
          });

        segments.push({ a, b, i, visitIdx, isSameLoc, pathEl, arrowGroup, hitEl });
      });

      function computeAndApply() {
        segments.forEach(({ a, b, i, visitIdx, isSameLoc, pathEl, arrowGroup, hitEl }) => {
          const fromPt = locDotPos ? locDotPos(a.ei) : locPos(a.locId);
          const toPt   = locDotPos ? locDotPos(b.ei) : locPos(b.locId);
          if (!fromPt || !toPt) return;

          let pathD, midX, midY, arrowAngle;

          if (isSameLoc) {
            const dip = 10 + (visitIdx % 3) * 6;
            const qcx = (fromPt.x + toPt.x) / 2;
            const qcy = fromPt.y + dip;
            pathD = `M ${fromPt.x} ${fromPt.y} Q ${qcx} ${qcy} ${toPt.x} ${toPt.y}`;
            const t = 0.5, mt = 1 - t;
            midX = mt*mt*fromPt.x + 2*mt*t*qcx + t*t*toPt.x;
            midY = mt*mt*fromPt.y + 2*mt*t*qcy + t*t*toPt.y;
            arrowAngle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x) * 180 / Math.PI;
          } else {
            const dx   = toPt.x - fromPt.x;
            const dy   = toPt.y - fromPt.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 1) return;

            const perpX    = -dy / dist;
            const perpY    =  dx / dist;
            const sideSign = visitIdx % 2 === 0 ? 1 : -1;
            const sc       = (curvature / 25) * sideSign;
            const v1 = (Math.sin(i * 2.3) * 15 + Math.cos(i * 1.7) * 10) * sc;
            const v2 = (Math.sin(i * 3.1) * 12 + Math.cos(i * 2.9) *  8) * sc;

            const c1x = fromPt.x + dx * 0.3 + perpX * v1;
            const c1y = fromPt.y + dy * 0.3 + perpY * v1;
            const c2x = fromPt.x + dx * 0.7 + perpX * v2;
            const c2y = fromPt.y + dy * 0.7 + perpY * v2;
            pathD = `M ${fromPt.x} ${fromPt.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toPt.x} ${toPt.y}`;

            const t = 0.5, mt = 1 - t;
            midX = mt*mt*mt*fromPt.x + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*toPt.x;
            midY = mt*mt*mt*fromPt.y + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*toPt.y;
            const tx = 3*mt*mt*(c1x-fromPt.x) + 6*mt*t*(c2x-c1x) + 3*t*t*(toPt.x-c2x);
            const ty = 3*mt*mt*(c1y-fromPt.y) + 6*mt*t*(c2y-c1y) + 3*t*t*(toPt.y-c2y);
            arrowAngle = Math.atan2(ty, tx) * 180 / Math.PI;
          }

          pathEl.attr('d', pathD);
          hitEl.attr('d', pathD);
          if (arrowGroup) {
            arrowGroup.attr('transform', `translate(${midX},${midY}) rotate(${arrowAngle})`);
          }
        });
      }

      computeAndApply();

      const tickListeners = ctx.get('tickListeners');
      if (tickListeners) tickListeners.push(computeAndApply);
    },
  };
}
