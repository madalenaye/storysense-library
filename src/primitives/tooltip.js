/**
 * Primitive: tooltip
 *
 * Creates an HTML overlay tooltip div on the SVG container.
 * Must be added before other primitives that use it.
 *
 * Needs:    —
 * Provides: tooltip  — { show(x, y, html), hide() }
 */
// NO d3 import needed
export function tooltip(opts = {}) {
  return {
    id:       'tooltip',
    needs:    [],
    provides: ['tooltip'],

    render(ctx) {
      const svgEl   = ctx.get('svg').node();
      const wrapper = svgEl.parentElement;
      wrapper.style.position = 'relative';

      const div = document.createElement('div');
      div.style.cssText = [
        'position:absolute', 'pointer-events:none', 'opacity:0',
        'background:#fff', 'border:1px solid #e5e7eb', 'border-radius:8px',
        'padding:8px 12px', 'font-size:12px', 'color:#374151', 'font-family:system-ui,sans-serif',
        'box-shadow:0 4px 16px rgba(0,0,0,0.10)', 'z-index:100',
        'max-width:220px', 'line-height:1.5', 'transition:opacity 0.12s',
      ].join(';');
      wrapper.appendChild(div);

      ctx.set('tooltip', {
        show(x, y, html) {
          div.innerHTML       = html;
          div.style.left      = `${x + 14}px`;
          div.style.top       = `${y - 10}px`;
          div.style.opacity   = '1';
        },
        hide() { div.style.opacity = '0'; },
      });
    },
  };
}
