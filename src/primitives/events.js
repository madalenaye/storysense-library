/**
 * Primitive: events
 *
 * Draws a visual marker at each event's position on the timeline axis.
 * When `titles` is true, each marker gets a short connector line and
 * a readable label — labels alternate between two heights to avoid
 * crowding (above the axis for horizontal, to the right for vertical).
 *
 * Hovering any marker always shows a rich tooltip: title, time, full
 * description, and the list of participants present.
 *
 * Needs:    sceneX, sceneY
 * Provides: —
 *
 * Options:
 *   shape     'dot' (default) | 'pin'
 *   r         dot radius in px (default 6)
 *   fill      colour string or fn(event, index) → string (default '#6366f1')
 *   titles    show event title labels alongside the axis (default false)
 *   onClick   fn(event, eventIndex) — called on marker click
 */
export function events(opts = {}) {
  const {
    shape   = 'dot',
    r       = 6,
    fill    = '#172554',
    titles  = false,
    onClick = null,
  } = opts;

  return {
    id:       'events',
    needs:    ['sceneX', 'sceneY'],
    provides: [],

    render(ctx) {
      const sceneX    = ctx.get('sceneX');
      const sceneY    = ctx.get('sceneY');
      const direction = ctx.get('direction');
      const layer     = ctx.get('layer')('pins');
      const lblLayer  = ctx.get('layer')('labels');
      const { data }  = ctx;
      const svgNode   = ctx.get('svg').node();
      const tt        = ctx.get('tooltip');

      data.events.forEach((event, i) => {
        const x   = sceneX(i);
        const y   = sceneY(i);
        const col = typeof fill === 'function' ? fill(event, i) : fill;

        // ── Marker ─────────────────────────────────────────────────────────────
        let markerEl;

        if (shape === 'pin') {
          const g = layer.append('g').attr('transform', `translate(${x},${y - 24})`);
          g.append('path')
            .attr('d', 'M0,-16 C8,-16 12,-8 12,0 C12,8 0,20 0,20 C0,20 -12,8 -12,0 C-12,-8 -8,-16 0,-16Z')
            .attr('fill', col).attr('opacity', 0.9);
          g.append('circle').attr('r', 4).attr('fill', '#fff').attr('opacity', 0.8);
          markerEl = g;
        } else {
          markerEl = layer.append('circle')
            .attr('cx', x).attr('cy', y)
            .attr('r', r)
            .attr('fill', col)
            .attr('stroke', '#fff').attr('stroke-width', 2);
        }

        if (onClick) markerEl.style('cursor', 'pointer').on('click', () => onClick(event, i));

        // ── Title label alongside the axis ────────────────────────────────────
        // Labels use rotate(35°) text-anchor:end so they descend left-to-right,
        // ending just above each dot — the mirror of the timeline's time labels
        // which ascend at -35° below the axis.  Both converge from the left.
        if (titles && event.title) {
          const label = event.title.length > 22 ? event.title.slice(0, 20) + '…' : event.title;

          if (direction === 'y') {
            // Vertical axis: label to the right, angled slightly down
            lblLayer.append('text')
              .attr('transform', `translate(${x + r + 10},${y}) rotate(35)`)
              .attr('text-anchor', 'start')
              .attr('font-size', '10px').attr('font-weight', '600').attr('fill', '#374151')
              .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
              .text(label);
          } else {
            // Horizontal axis: centered above the dot, no rotation
            lblLayer.append('text')
              .attr('x', x).attr('y', y - r - 8)
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px').attr('font-weight', '600').attr('fill', '#374151')
              .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
              .text(label);
          }
        }

        // ── Tooltip ───────────────────────────────────────────────────────────
        // Bound in the forEach closure so each marker captures its own event.
        if (tt) {
          const participantNames = (event.participations ?? [])
            .map(p => p.participant?.name)
            .filter(Boolean);

          markerEl
            .style('cursor', 'pointer')
            .on('mousemove', function(domEvent) {
              const rect = svgNode.parentElement.getBoundingClientRect();
              tt.show(
                domEvent.clientX - rect.left,
                domEvent.clientY - rect.top,
                `<strong>${event.title ?? ''}</strong>` +
                (event.time
                  ? `<br><span style="color:#9ca3af">${event.time.value}</span>`
                  : '') +
                (event.description
                  ? `<br><span style="color:#6b7280;font-size:11px">${event.description}</span>`
                  : '') +
                (participantNames.length
                  ? `<br><span style="color:#6b7280;font-size:11px">With: ${participantNames.join(', ')}</span>`
                  : '')
              );
            })
            .on('mouseleave', () => tt.hide());
        }
      });
    },
  };
}
