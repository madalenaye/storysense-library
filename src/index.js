/**
 * storysense — entry point
 *
 * Named imports (pick what you need):
 *   import { storysense, normalizeNarrative, tooltip, timeline, ... } from './src/index.js';
 *
 * Default import (everything at once):
 *   import SS from './src/index.js';
 *   SS.storysense('#chart', story, opts).add(SS.tooltip()).add(SS.timeline()).render();
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { createContext } from './context.js';
import { createLayers  } from './layers.js';

import { normalizeNarrative }    from './data.js';
import { dicebearUrl, initials } from './icons.js';
import { timeline   } from './primitives/timeline.js';
import { events     } from './primitives/events.js';
import { characters } from './primitives/characters.js';
import { lifelines  } from './primitives/lifelines.js';
import { edges      } from './primitives/edges.js';
import { locations  } from './primitives/locations.js';
import { movement   } from './primitives/movement.js';
import { network    } from './primitives/network.js';
import { tooltip    } from './primitives/tooltip.js';

export {
  normalizeNarrative,
  dicebearUrl, initials,
  tooltip,
  timeline, events,
  characters, lifelines, edges,
  network,
  locations, movement,
};

/**
 * @param {string | Element} container  CSS selector or DOM element
 * @param {object}           data       Normalised narrative (output of normalizeNarrative)
 * @param {object}           opts
 * @param {number}           [opts.width]        Fixed SVG width in px. Omit when responsive.
 * @param {number}           [opts.height]       Fixed SVG height in px (default 500)
 * @param {object}           [opts.padding]      Inner padding { top, right, bottom, left }
 * @param {boolean}          [opts.responsive]   Fill container and re-render on resize
 * @param {number}           [opts.aspectRatio]  height = width / aspectRatio (e.g. 860/460)
 * @param {number}           [opts.axisRatio]    Fractional position of the time axis (default 0.5)
 * @returns {{ add, render, destroy, svg }}
 */
export function storysense(container, data, opts = {}) {
  const {
    width       = null,
    height      = 500,
    padding     = { top: 0, right: 0, bottom: 0, left: 0 },
    responsive  = false,
    aspectRatio = null,
  } = opts;

  const root = typeof container === 'string'
    ? document.querySelector(container)
    : container;

  if (!root) throw new Error(`storysense: container "${container}" not found.`);
  if (!data || !Array.isArray(data.events)) {
    throw new Error('storysense: data must be a normalised narrative — call normalizeNarrative() first.');
  }

  const queue = [];
  let svgSel          = null;
  let prevSimulations = [];

  function doRender() {
    prevSimulations.forEach(s => s.stop());
    prevSimulations = [];

    if (svgSel) {
      svgSel.selectAll('*').remove();
    } else {
      root.innerHTML = '';
      svgSel = d3.select(root).append('svg');
      if (responsive) svgSel.style('display', 'block').style('width', '100%');
    }

    const w = width ?? (svgSel.node().getBoundingClientRect().width || svgSel.node().clientWidth || 900);
    const h = aspectRatio ? Math.round(w / aspectRatio) : height;

    if (responsive) {
      svgSel.attr('height', h);
    } else {
      svgSel.attr('width', w).attr('height', h);
    }
    svgSel.attr('viewBox', `0 0 ${w} ${h}`);

    // Auto-compute axisRatio when not user-specified.
    // Derive from actual participant count + spacing so the axis lands exactly
    // where the character block needs it — no fixed magic numbers.
    let resolvedAxisRatio = opts.axisRatio ?? null;
    if (resolvedAxisRatio == null) {
      const charP = queue.find(p => p.id === 'characters' && p._layout === 'lane');
      if (charP) {
        const pSide     = charP._side       ?? 'above';
        const pSpacing  = charP._laneSpacing ?? 38;
        const nSide     = pSide === 'both'
          ? Math.ceil(data.participants.length / 2)
          : data.participants.length;
        // Mirror the clearance logic in characters.js exactly.
        const tlDir     = queue.find(p => p.id === 'timeline')?._direction ?? 'x';
        const clearance =
          tlDir === 'x' && pSide === 'above'                       ? 36 :
          tlDir === 'x' && (pSide === 'below' || pSide === 'both') ? 28 :
          tlDir === 'y' && (pSide === 'above' || pSide === 'both') ? 80 : 0;
        // Space needed = one slot per lane + one empty slot each end + clearance.
        const needed  = pSpacing * (nSide + 1) + clearance + 4;
        const spanDim = tlDir === 'y' ? w : h;
        const frac    = needed / spanDim;
        // Clamp so the axis always sits at ≥ 50 % in the character direction,
        // giving characters at least half the chart and keeping both sides symmetric.
        if (pSide === 'above') {
          resolvedAxisRatio = Math.max(0.5, Math.min(0.85, frac));
        } else if (pSide === 'below') {
          resolvedAxisRatio = Math.max(0.15, Math.min(0.5, 1 - frac));
        } else {
          resolvedAxisRatio = 0.5;
        }
      } else {
        resolvedAxisRatio = 0.5;
      }
    }

    const ctx   = createContext(data, { ...opts, width: w, height: h, padding, axisRatio: resolvedAxisRatio });
    const layer = createLayers(svgSel);

    ctx.set('svg',   svgSel);
    ctx.set('layer', layer);

    const provided = new Set(['svg', 'layer']);

    for (const p of queue) {
      const missing = (p.needs ?? []).filter(k => !provided.has(k));
      if (missing.length) {
        throw new Error(
          `storysense: primitive "${p.id}" needs [${missing.join(', ')}] ` +
          `but those have not been provided yet. Check the order you called .add().`
        );
      }
      p.render(ctx);
      (p.provides ?? []).forEach(k => provided.add(k));
    }

    prevSimulations = ctx.get('activeSimulations') ?? [];
    api.svg = svgSel;
  }

  const api = {
    add(primitive) {
      queue.push(primitive);
      return api;
    },

    render() {
      doRender();

      if (responsive) {
        let timer;
        const ro = new ResizeObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(doRender, 80);
        });
        ro.observe(root);
        api.destroy = () => {
          clearTimeout(timer);
          ro.disconnect();
          prevSimulations.forEach(s => s.stop());
          prevSimulations = [];
          svgSel = null;
        };
      }

      return api;
    },

    destroy() {},
    svg: null,
  };

  return api;
}

export default {
  normalizeNarrative,
  storysense,
  tooltip,
  timeline, events,
  characters, lifelines, edges,
  network,
  locations, movement,
  dicebearUrl, initials,
};
