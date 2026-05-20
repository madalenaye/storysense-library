/**
 * Primitive: characters
 *
 * Places one avatar node per participant per event they appear in,
 * relative to the timeline axis.
 *
 * Needs:    sceneX, sceneY, direction
 * Provides: charPos    fn(participantId, eventIndex) → {x, y} | null
 *           charRadius number  (uniform across all nodes in this primitive)
 *
 * Layout modes:
 *   'lane'  — each participant occupies a fixed parallel track. Clean for lifelines.
 *   'force' — participants cluster at their event position via D3 force. Draggable.
 *
 * Options:
 *   layout      'lane' (default) | 'force'
 *   r           node radius in px (default 16)
 *   laneSpacing px between lanes — lane mode only (default 38)
 *   side        'above' (default) | 'below' | 'both'
 *   color       fn(participant) → string — default: categorical palette from data
 *   icons       show avatar icons (default true)
 *   iconStyle   DiceBear style slug, e.g. 'notionists', 'avataaars' (default 'notionists')
 *   iconUrl     fn(participant) → URL — fully overrides iconStyle when provided
 *   labels      show name labels (lane mode only, default true)
 *   onClick     fn(participant, eventIndex)
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { appendIcon, dicebearUrl } from '../icons.js';

export function characters(opts = {}) {
  const {
    layout        = 'lane',
    r             = 16,
    laneSpacing   = 38,
    side          = 'above',
    color         = null,   // null → use data.colorOf
    icons         = true,
    iconStyle     = 'notionists',
    iconUrl       = null,   // fn(participant) → URL; overrides iconStyle
    labels        = true,
    onClick       = null,
    perpDistance  = 70,    // force mode: how far nodes target above/below axis
    axisStrength  = 0.9,   // force mode: how tightly nodes snap to event x
  } = opts;

  return {
    id:       'characters',
    needs:    ['sceneX', 'sceneY', 'direction'],
    provides: ['charPos', 'charRadius'],

    render(ctx) {
      const sceneX    = ctx.get('sceneX');
      const sceneY    = ctx.get('sceneY');
      const direction = ctx.get('direction');
      const layer     = ctx.get('layer')('nodes');
      const { data }  = ctx;

      const resolvedColor  = color   ?? (p => data.colorOf(p.id));
      const resolvedIconFn = icons
        ? (iconUrl ?? (p => dicebearUrl(p, { style: iconStyle })))
        : null;

      ctx.set('charRadius', r);

      // Build presence lookup: participantId → Set of eventIndices
      const present = new Map();
      data.events.forEach((event, ei) => {
        event.participantIds.forEach(pid => {
          if (!present.has(pid)) present.set(pid, new Set());
          present.get(pid).add(ei);
        });
      });

      const posMap = {};
      let forceNodeMap  = null;
      let forceSim      = null;
      let tickListeners = null;

      // ── Lane layout ─────────────────────────────────────────────────────────
      if (layout === 'lane') {
        data.participants.forEach((participant, idx) => {
          const sign    = side === 'below' ? 1 : side === 'both' ? (idx % 2 === 0 ? -1 : 1) : -1;
          const laneNum = side === 'both' ? Math.floor(idx / 2) : idx;
          const offset  = sign * (r * 2 + laneSpacing / 2 + laneNum * laneSpacing);

          data.events.forEach((_, ei) => {
            const x = direction === 'x' ? sceneX(ei) : sceneX(ei) + offset;
            const y = direction === 'x' ? sceneY(ei) + offset : sceneY(ei);
            (posMap[participant.id] ??= {})[ei] = { x, y };
          });
        });

      // ── Force layout ─────────────────────────────────────────────────────────
      } else {
        forceNodeMap  = {};
        tickListeners = [];
        ctx.set('tickListeners', tickListeners);

        const nodes = [];
        data.events.forEach((event, ei) => {
          event.participations.forEach(({ participant, participantId }) => {
            const pidIdx = data.participants.findIndex(p => p.id === participantId);
            const node = {
              participantId,
              participant,
              eventIndex: ei,
              x: sceneX(ei) + (pidIdx - (data.participants.length - 1) / 2) * 4,
              y: sceneY(ei) + (ei    - (data.events.length      - 1) / 2) * 4,
              vx: 0, vy: 0,
            };
            nodes.push(node);
            (forceNodeMap[participantId] ??= {})[ei] = node;
            (posMap[participantId] ??= {})[ei] = { x: node.x, y: node.y };
          });
        });

        const links = [];
        data.events.forEach((event, ei) => {
          event.interactions.forEach(ix => {
            const src = forceNodeMap[ix.fromParticipant.id]?.[ei];
            const tgt = forceNodeMap[ix.toParticipant.id]?.[ei];
            if (src && tgt) links.push({ source: src, target: tgt });
          });
        });

        const targetPerp = d => {
          const base = direction === 'x' ? sceneY(d.eventIndex) : sceneX(d.eventIndex);
          return side === 'below' ? base + perpDistance : base - perpDistance;
        };

        forceSim = d3.forceSimulation(nodes)
          .randomSource(d3.randomLcg(42))
          .force('axis',
            direction === 'x'
              ? d3.forceX(d => sceneX(d.eventIndex)).strength(axisStrength)
              : d3.forceY(d => sceneY(d.eventIndex)).strength(axisStrength)
          )
          .force('perp',
            direction === 'x'
              ? d3.forceY(d => targetPerp(d)).strength(0.3)
              : d3.forceX(d => targetPerp(d)).strength(0.3)
          )
          .force('collision', d3.forceCollide(r + 10).strength(0.9))
          .force('link', d3.forceLink(links).distance(r * 4).strength(0.4))
          .alphaDecay(0.028)
          .velocityDecay(0.5)
          .stop();

        const activeSims = ctx.get('activeSimulations') ?? [];
        activeSims.push(forceSim);
        ctx.set('activeSimulations', activeSims);
      }

      ctx.set('charPos', (pid, ei) => posMap[pid]?.[ei] ?? null);

      // ── SVG setup ────────────────────────────────────────────────────────────
      const svg     = ctx.get('svg');
      const svgNode = svg.node();
      const defs    = svg.select('defs').empty()
        ? svg.insert('defs', ':first-child')
        : svg.select('defs');

      // ── Draw nodes ────────────────────────────────────────────────────────────
      Object.entries(posMap).forEach(([pid, eventPositions]) => {
        const participant = data.participantById.get(pid);
        if (!participant) return;

        Object.entries(eventPositions).forEach(([ei, { x, y }]) => {
          if (!present.get(pid)?.has(+ei)) return;

          const forceNode = forceNodeMap?.[pid]?.[+ei] ?? null;

          const g = layer.append('g')
            .datum(forceNode)
            .attr('class', forceNode ? 'ss-char-node ss-char-force' : 'ss-char-node')
            .attr('transform', `translate(${x},${y})`)
            .style('cursor', forceNode ? 'grab' : onClick ? 'pointer' : 'default');

          g.append('circle')
            .attr('r', r)
            .attr('fill', resolvedColor(participant))
            .attr('stroke', '#fff').attr('stroke-width', 2)
            .style('filter', 'drop-shadow(0 1px 4px rgba(0,0,0,0.20))');

          if (resolvedIconFn) appendIcon(g, participant, r, defs, resolvedIconFn);

          if (onClick) g.on('click', () => onClick(participant, +ei));

          g.on('mousemove', function(event) {
            const tt = ctx.get('tooltip');
            if (!tt) return;
            const rect       = svgNode.parentElement.getBoundingClientRect();
            const sceneCount = present.get(participant.id)?.size ?? 0;
            tt.show(
              event.clientX - rect.left,
              event.clientY - rect.top,
              `<strong>${participant.name}</strong>` +
              `<br><span style="color:#6b7280">${sceneCount} event${sceneCount !== 1 ? 's' : ''}</span>`
            );
          }).on('mouseleave', () => ctx.get('tooltip')?.hide());
        });
      });

      // ── Force mode: drag + live tick ──────────────────────────────────────────
      if (layout === 'force' && forceSim) {
        const forceGroups = layer.selectAll('.ss-char-force');

        const drag = d3.drag()
          .on('start', (event, d) => {
            if (!event.active) forceSim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
            d3.select(event.currentTarget).style('cursor', 'grabbing');
          })
          .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on('end',  (event, d) => {
            if (!event.active) forceSim.alphaTarget(0);
            d.fx = null; d.fy = null;
            d3.select(event.currentTarget).style('cursor', 'grab');
          });

        forceGroups.call(drag);

        forceSim.on('tick', () => {
          Object.entries(forceNodeMap).forEach(([pid, evNodes]) => {
            Object.entries(evNodes).forEach(([ei, n]) => {
              (posMap[pid] ??= {})[+ei] = { x: n.x, y: n.y };
            });
          });
          forceGroups.attr('transform', d => d ? `translate(${d.x},${d.y})` : null);
          tickListeners.forEach(fn => fn());
        });

        for (let i = 0; i < 300; i++) forceSim.tick();
        Object.entries(forceNodeMap).forEach(([pid, evNodes]) => {
          Object.entries(evNodes).forEach(([ei, n]) => {
            (posMap[pid] ??= {})[+ei] = { x: n.x, y: n.y };
          });
        });
        forceGroups.attr('transform', d => d ? `translate(${d.x},${d.y})` : null);
        tickListeners.forEach(fn => fn());
        forceSim.restart();
      }

      // ── Name labels (lane mode only) ──────────────────────────────────────────
      if (labels && layout === 'lane') {
        const lblLayer  = ctx.get('layer')('labels');
        const { padding } = ctx.opts;

        // All labels share a single consistent x — just left of the first tick.
        // Using sceneX(0) means labels never drift into the chart body regardless
        // of which event a participant first appears in.
        const labelX = sceneX(0) - r - 8;

        // Available px between the left padding edge and the label anchor.
        // Rough per-char width at 11px bold ≈ 7px.  Truncate names that exceed it.
        const availW   = labelX - ((padding?.left) ?? 0) - 4;
        const maxChars = Math.max(3, Math.floor(availW / 7));

        data.participants.forEach(participant => {
          const evPositions = posMap[participant.id];
          if (!evPositions) return;

          // In lane mode the participant's y is constant — grab any event's y.
          const anyEi  = Object.keys(evPositions)[0];
          const { y }  = evPositions[anyEi];
          const name   = participant.name;
          const label  = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;

          if (direction === 'x') {
            lblLayer.append('text')
              .attr('x', labelX).attr('y', y + 4)
              .attr('text-anchor', 'end')
              .attr('font-size', '11px').attr('font-weight', '700')
              .attr('fill', '#374151')
              .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
              .text(label);
          } else {
            const { x } = evPositions[anyEi];
            lblLayer.append('text')
              .attr('x', x + r + 6).attr('y', y + 4)
              .attr('text-anchor', 'start')
              .attr('font-size', '11px').attr('font-weight', '700')
              .attr('fill', '#374151')
              .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
              .text(label);
          }
        });
      }
    },
  };
}
