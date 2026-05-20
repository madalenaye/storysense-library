/**
 * Primitive: edges
 *
 * Draws curved interaction paths between participants.
 * Single edges are straight lines; multiple edges between the same pair within
 * one event fan out as parallel quadratic bezier curves with a perpendicular
 * control-point offset.
 *
 * Needs:    charPos
 * Provides: —
 *
 * Options:
 *   stroke      colour string (default '#666')
 *   strokeWidth line width in px (default 2)
 *   opacity     line opacity (default 0.6)
 *   arrow       show direction arrowhead (default true)
 *   curvature   perpendicular offset in px per parallel-edge unit (default 30)
 *               Increase for more pronounced curves when edges overlap.
 *   nodeRadius  override arrowhead pull-back distance. 0 = auto-read from charRadius. (default 0)
 *   dedupe      draw only one edge per unique participant pair (default false)
 *   filter      fn(interaction, event) → bool — include only matching interactions
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Quadratic bezier path. offsetIndex=0 → straight line.
function edgePath(x1, y1, x2, y2, offsetIndex, curvature) {
  const offset = offsetIndex * curvature;
  if (Math.abs(offset) < 0.5) return `M${x1},${y1}L${x2},${y2}`;
  const dx = x2 - x1, dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return `M${x1},${y1}L${x2},${y2}`;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const nx = -dy / dist, ny = dx / dist;
  return `M${x1},${y1}Q${mx + nx * offset},${my + ny * offset} ${x2},${y2}`;
}

// Pull endpoints back from node surfaces so the arrowhead lands cleanly.
function pullback(src, tgt, nrSrc, nrTgt) {
  const dx = tgt.x - src.x, dy = tgt.y - src.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < nrSrc + nrTgt + 1 || (nrSrc === 0 && nrTgt === 0)) {
    return { x1: src.x, y1: src.y, x2: tgt.x, y2: tgt.y };
  }
  const ux = dx / dist, uy = dy / dist;
  return {
    x1: src.x + ux * nrSrc,
    y1: src.y + uy * nrSrc,
    x2: tgt.x - ux * (nrTgt + 2),
    y2: tgt.y - uy * (nrTgt + 2),
  };
}

export function edges(opts = {}) {
  const {
    stroke      = '#666',
    strokeWidth = 2,
    opacity     = 0.6,
    arrow       = true,
    curvature   = 30,
    nodeRadius  = 0,
    dedupe      = false,
    filter      = null,
  } = opts;

  return {
    id:       'edges',
    needs:    ['charPos'],
    provides: [],

    render(ctx) {
      const charPos       = ctx.get('charPos');
      const charRadiusCtx = ctx.get('charRadius');
      const layer         = ctx.get('layer')('edges');
      const svg           = ctx.get('svg');
      const { data }      = ctx;
      const svgNode       = svg.node();

      const getRadius = pid => {
        if (nodeRadius > 0) return nodeRadius;
        if (typeof charRadiusCtx === 'function') return charRadiusCtx(pid);
        return charRadiusCtx ?? 0;
      };

      // Arrow marker
      if (arrow) {
        let defs = svg.select('defs');
        if (defs.empty()) defs = svg.insert('defs', ':first-child');
        if (defs.select('#ss-edge-arrow').empty()) {
          defs.append('marker')
            .attr('id', 'ss-edge-arrow')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 8).attr('refY', 0)
            .attr('markerWidth', 5).attr('markerHeight', 5)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-4L8,0L0,4')
            .attr('fill', stroke)
            .attr('stroke', stroke)
            .attr('stroke-width', 0.5);
        }
      }

      const seen   = new Set();
      const lines  = [];
      const byDir  = {};   // `fromId|toId|ei` → lines in that direction

      data.events.forEach((event, ei) => {
        event.interactions.forEach(ix => {
          if (filter && !filter(ix, event)) return;

          const fromId = ix.fromParticipant.id;
          const toId   = ix.toParticipant.id;
          const srcPos = charPos(fromId, ei);
          const tgtPos = charPos(toId,   ei);
          if (!srcPos || !tgtPos) return;

          const pairKey = [fromId, toId].sort().join('|');
          if (dedupe && seen.has(pairKey)) return;
          seen.add(pairKey);

          const nrSrc = getRadius(fromId);
          const nrTgt = getRadius(toId);
          const { x1, y1, x2, y2 } = pullback(srcPos, tgtPos, nrSrc, nrTgt);

          const line = { x1, y1, x2, y2, offsetIndex: 0, ix, event, ei, fromId, toId, nrSrc, nrTgt };
          lines.push(line);
          (byDir[`${fromId}|${toId}|${ei}`] ??= []).push(line);
        });
      });

      // Direction-aware offset assignment.
      // When A→B and B→A both exist, each curves to its own side (their left normals
      // point in opposite directions, so the arcs naturally bow apart from each other).
      lines.forEach(line => {
        const sameDir     = byDir[`${line.fromId}|${line.toId}|${line.ei}`] ?? [];
        const opposDir    = byDir[`${line.toId}|${line.fromId}|${line.ei}`] ?? [];
        const hasOpposing = opposDir.length > 0;
        const idx         = sameDir.indexOf(line);
        const total       = sameDir.length;

        if (total === 1 && !hasOpposing) {
          line.offsetIndex = 0;                                   // single edge → straight
        } else if (total === 1 && hasOpposing) {
          line.offsetIndex = 1;                                   // opposing pair → each curves away
        } else {
          const midpoint = (total - 1) / 2;
          line.offsetIndex = (hasOpposing ? 1 : 0) + (idx - midpoint);
        }
      });

      const dFn = d => edgePath(d.x1, d.y1, d.x2, d.y2, d.offsetIndex, curvature);

      const visuals = layer.append('g');
      const edgeEls = visuals.selectAll('path')
        .data(lines)
        .join('path')
        .attr('d', dFn)
        .attr('fill', 'none')
        .attr('stroke', stroke)
        .attr('stroke-width', strokeWidth)
        .attr('stroke-opacity', opacity)
        .attr('stroke-linecap', 'round');

      if (arrow) edgeEls.attr('marker-end', 'url(#ss-edge-arrow)');

      // Wide transparent hit targets for easier hover
      layer.append('g').selectAll('path')
        .data(lines)
        .join('path')
        .attr('d', dFn)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 14)
        .style('cursor', 'pointer')
        .on('mouseover', function(domEvent, d) {
          edgeEls.filter(ld => ld === d)
            .attr('stroke', '#333')
            .attr('stroke-width', strokeWidth * 1.6)
            .attr('stroke-opacity', 0.9);

          const tt = ctx.get('tooltip');
          if (!tt) return;
          const rect = svgNode.parentElement.getBoundingClientRect();
          tt.show(
            domEvent.clientX - rect.left,
            domEvent.clientY - rect.top,
            `<strong>${d.ix.fromParticipant.name} → ${d.ix.toParticipant.name}</strong>` +
            (d.ix.action      ? `<br><span style="color:#6b7280">${d.ix.action}</span>` : '') +
            (d.ix.description ? `<br><span style="color:#9ca3af;font-size:11px">${d.ix.description}</span>` : '') +
            (d.event.title    ? `<br><span style="color:#c4b5fd;font-size:10px">${d.event.title}</span>` : '')
          );
        })
        .on('mouseout', function(_, d) {
          edgeEls.filter(ld => ld === d)
            .attr('stroke', stroke)
            .attr('stroke-width', strokeWidth)
            .attr('stroke-opacity', opacity);
          ctx.get('tooltip')?.hide();
        });

      // Live tick updates (force/drag mode)
      const tickListeners = ctx.get('tickListeners');
      if (tickListeners) {
        const updatePaths = sel => {
          sel.each(function(d) {
            const srcPos = charPos(d.ix.fromParticipant.id, d.ei);
            const tgtPos = charPos(d.ix.toParticipant.id,   d.ei);
            if (!srcPos || !tgtPos) return;
            const { x1, y1, x2, y2 } = pullback(srcPos, tgtPos, d.nrSrc, d.nrTgt);
            d.x1 = x1; d.y1 = y1; d.x2 = x2; d.y2 = y2;
            d3.select(this).attr('d', edgePath(x1, y1, x2, y2, d.offsetIndex, curvature));
          });
        };

        tickListeners.push(() => {
          updatePaths(edgeEls);
          updatePaths(layer.selectAll('g:last-child path'));
        });
      }
    },
  };
}
