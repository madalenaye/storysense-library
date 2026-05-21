/**
 * Primitive: network
 *
 * Free-form force-directed layout — one node per participant, spread globally
 * across the canvas with no time axis. Links are built from all interactions
 * across every event.
 *
 * Node radius scales with narrative importance (event presence ratio).
 * Repulsion force scales with connection degree to prevent dense clumping.
 * Nodes are draggable.
 *
 * Needs:    —
 * Provides: charPos    fn(participantId) → {x, y}  (live, updated each tick)
 *           charRadius fn(participantId) → number   (per-participant radius)
 *
 * Options:
 *   r         base radius in px (default 18); actual radius scales with importance
 *   color     fn(participant) → string — default: categorical palette from data
 *   icons     show avatar icons (default true)
 *   iconStyle DiceBear style slug, e.g. 'notionists', 'lorelei' (default 'notionists')
 *   iconUrl   fn(participant) → URL — fully overrides iconStyle when provided
 *   labels    show name labels (hidden until hover, default true)
 *   charge    forceManyBody base strength (default -300; more negative = further apart)
 *   linkDist  base link distance in px (default 100)
 *   onClick   fn(participant)
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { appendIcon, dicebearUrl } from '../icons.js';

export function network(opts = {}) {
  const {
    r        = 18,
    color    = null,   // null → use data.colorOf
    icons    = true,
    iconStyle = 'notionists',
    iconUrl  = null,   // fn(participant) → URL; overrides iconStyle
    labels   = true,
    charge   = -300,
    linkDist = 100,
    onClick  = null,
  } = opts;

  return {
    id:       'network',
    needs:    [],
    provides: ['charPos', 'charRadius'],

    render(ctx) {
      const { data }          = ctx;
      const { width, height } = ctx.opts;
      const layer             = ctx.get('layer')('nodes');

      const resolvedColor  = color  ?? (p => data.colorOf(p.id));
      const resolvedIconFn = icons
        ? (iconUrl ?? (p => dicebearUrl(p, { style: iconStyle })))
        : null;

      const tickListeners = [];
      ctx.set('tickListeners', tickListeners);

      const appearanceCount = new Map();
      data.events.forEach(event => {
        event.participantIds.forEach(pid => {
          appearanceCount.set(pid, (appearanceCount.get(pid) ?? 0) + 1);
        });
      });
      const eventCount = data.events.length || 1;

      const nodeRadius = new Map();
      data.participants.forEach(p => {
        const importance = (appearanceCount.get(p.id) ?? 0) / eventCount;
        nodeRadius.set(p.id, r * (0.65 + 0.7 * importance));
      });

      ctx.set('charRadius', pid => nodeRadius.get(pid) ?? r);

      // Circular initial positions for deterministic first frame
      const circleR = Math.min(width, height) * 0.32;
      const cx = width / 2, cy = height / 2;

      const nodes = data.participants.map((p, i) => {
        const angle = (i / data.participants.length) * 2 * Math.PI - Math.PI / 2;
        const nr    = nodeRadius.get(p.id) ?? r;
        return {
          id:         p.id,
          participant: p,
          r:          nr,
          importance: (appearanceCount.get(p.id) ?? 0) / eventCount,
          x: cx + circleR * Math.cos(angle),
          y: cy + circleR * Math.sin(angle),
          vx: 0, vy: 0,
        };
      });

      const seenLinks   = new Set();
      const links       = [];
      const nodeDegrees = {};
      data.events.forEach(event => {
        event.interactions.forEach(ix => {
          const fromId = ix.fromParticipant.id;
          const toId   = ix.toParticipant.id;
          const key    = [fromId, toId].sort().join('|');
          if (seenLinks.has(key)) return;
          seenLinks.add(key);
          links.push({ source: fromId, target: toId });
          nodeDegrees[fromId] = (nodeDegrees[fromId] ?? 0) + 1;
          nodeDegrees[toId]   = (nodeDegrees[toId]   ?? 0) + 1;
        });
      });

      const posById = {};
      nodes.forEach(n => { posById[n.id] = { x: n.x, y: n.y }; });
      ctx.set('charPos', pid => posById[pid] ?? null);

      const margin = r * 1.8 + 16;

      const sim = d3.forceSimulation(nodes)
        .randomSource(d3.randomLcg(42))
        .force('charge',
          d3.forceManyBody()
            .strength(d => charge / Math.sqrt(Math.max(1, nodeDegrees[d.id] ?? 0)))
            .distanceMax(Math.min(width, height) * 0.65)
        )
        .force('center',    d3.forceCenter(cx, cy).strength(0.08))
        .force('x',         d3.forceX(cx).strength(0.04))
        .force('y',         d3.forceY(cy).strength(0.04))
        .force('collision', d3.forceCollide(d => d.r + 8).strength(0.85))
        .force('link',
          d3.forceLink(links).id(d => d.id)
            .distance(d => {
              const s = typeof d.source === 'string' ? nodes.find(n => n.id === d.source) : d.source;
              const t = typeof d.target === 'string' ? nodes.find(n => n.id === d.target) : d.target;
              return Math.min(linkDist + ((s?.r ?? r) + (t?.r ?? r)) * 0.9, Math.min(width, height) * 0.4);
            })
            .strength(0.35)
        )
        .alphaDecay(0.022)
        .velocityDecay(0.4)
        .stop();

      const activeSims = ctx.get('activeSimulations') ?? [];
      activeSims.push(sim);
      ctx.set('activeSimulations', activeSims);

      const svg     = ctx.get('svg');
      const svgNode = svg.node();
      const defs    = svg.select('defs').empty()
        ? svg.insert('defs', ':first-child')
        : svg.select('defs');

      const nodeGroups = layer.selectAll('g.ss-net-node').data(nodes, d => d.id)
        .join('g')
        .attr('class', 'ss-net-node')
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .style('cursor', 'grab');

      nodeGroups.append('circle')
        .attr('r', d => d.r)
        .attr('fill', d => resolvedColor(d.participant))
        .attr('stroke', '#fff').attr('stroke-width', 2)
        .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))');

      if (resolvedIconFn) {
        nodeGroups.each(function(d) {
          appendIcon(d3.select(this), d.participant, d.r, defs, resolvedIconFn);
        });
      }

      let labelSels = null;
      if (labels) {
        const lblLayer = ctx.get('layer')('labels');
        labelSels = lblLayer.selectAll('text.ss-net-label').data(nodes, d => d.id)
          .join('text')
          .attr('class', 'ss-net-label')
          .attr('x', d => d.x)
          .attr('y', d => d.y + d.r + 14)
          .attr('text-anchor', 'middle')
          .attr('font-size', '11px').attr('font-weight', '700')
          .attr('fill', '#111827')
          .attr('stroke', '#fff').attr('stroke-width', 3)
          .attr('paint-order', 'stroke')
          .attr('pointer-events', 'none')
          .style('opacity', 0)
          .text(d => d.participant.name);
      }

      const interactionCounts = {};
      data.events.forEach(event => {
        event.interactions.forEach(ix => {
          const fromId = ix.fromParticipant.id;
          const toId   = ix.toParticipant.id;
          interactionCounts[fromId] = (interactionCounts[fromId] ?? 0) + 1;
          interactionCounts[toId]   = (interactionCounts[toId]   ?? 0) + 1;
        });
      });

      nodeGroups
        .on('mouseover', function(_, d) {
          d3.select(this).select('circle')
            .transition().duration(120)
            .attr('stroke-width', 3)
            .style('filter', 'drop-shadow(0 0 10px rgba(23,37,84,0.35))');
          if (labelSels) {
            labelSels.filter(ld => ld === d).transition().duration(120).style('opacity', 1);
          }
          const tt = ctx.get('tooltip');
          if (!tt) return;
          const rect    = svgNode.parentElement.getBoundingClientRect();
          const n       = interactionCounts[d.id] ?? 0;
          const pct     = Math.round(d.importance * 100);
          tt.show(
            _.clientX - rect.left,
            _.clientY - rect.top,
            `<strong>${d.participant.name}</strong>` +
            `<br><span style="color:#6b7280">${pct}% of events · ${n} interaction${n !== 1 ? 's' : ''}</span>`
          );
        })
        .on('mouseleave', function(_, d) {
          d3.select(this).select('circle')
            .transition().duration(120)
            .attr('stroke-width', 2)
            .style('filter', 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))');
          if (labelSels) {
            labelSels.filter(ld => ld === d).transition().duration(120).style('opacity', 0);
          }
          ctx.get('tooltip')?.hide();
        });

      if (onClick) {
        nodeGroups.on('click', (_, d) => onClick(d.participant));
      }

      const drag = d3.drag()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
          d3.select(event.currentTarget).style('cursor', 'grabbing');
        })
        .on('drag', (event, d) => {
          d.fx = Math.max(margin, Math.min(width  - margin, event.x));
          d.fy = Math.max(margin, Math.min(height - margin, event.y));
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
          d3.select(event.currentTarget).style('cursor', 'grab');
        });

      nodeGroups.call(drag);

      sim.on('tick', () => {
        nodes.forEach(n => {
          if (n.fx == null) {
            n.x = Math.max(margin, Math.min(width  - margin, n.x));
            n.y = Math.max(margin, Math.min(height - margin, n.y));
          }
          posById[n.id] = { x: n.x, y: n.y };
        });
        nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
        labelSels?.attr('x', d => d.x).attr('y', d => d.y + d.r + 14);
        tickListeners.forEach(fn => fn());
      });

      // Pre-settle for a stable first paint
      for (let i = 0; i < 300; i++) sim.tick();
      nodes.forEach(n => {
        n.x = Math.max(margin, Math.min(width  - margin, n.x));
        n.y = Math.max(margin, Math.min(height - margin, n.y));
        posById[n.id] = { x: n.x, y: n.y };
      });
      nodeGroups.attr('transform', d => `translate(${d.x},${d.y})`);
      labelSels?.attr('x', d => d.x).attr('y', d => d.y + d.r + 14);
      tickListeners.forEach(fn => fn());

      sim.restart();
    },
  };
}
