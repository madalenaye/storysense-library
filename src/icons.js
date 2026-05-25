/**
 * Icon helpers — shared by the characters and network primitives.
 *
 * Default source: DiceBear Avatars (https://www.dicebear.com)
 * Override: pass an `iconUrl` function anywhere characters/network accept it.
 */

/**
 * Build a DiceBear avatar URL.
 *
 * @param {object} participant  Participant object from the narrative
 * @param {object} [opts]
 * @param {string} [opts.style='notionists']  DiceBear style slug
 * @param {object} [opts.params]              Extra query parameters (merged last)
 * @returns {string}
 */
export function dicebearUrl(participant, opts = {}) {
  const { style = 'notionists', params = {} } = opts;
  const query = new URLSearchParams({
    seed:  participant.name,
    scale: 120,
    radius: 50,
    ...params,
  });
  return `https://api.dicebear.com/7.x/${style}/svg?${query}`;
}

/**
 * Returns the participant's initials (up to 2 characters).
 * Used as a text fallback when icons are disabled.
 *
 * @param {object} participant
 * @returns {string}
 */
export function initials(participant) {
  return participant.name
    .split(' ')
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Append a circular avatar image to a D3 <g> already translated to node centre (0, 0).
 *
 * The clip path ID encodes both the participant id and the radius so that the
 * same participant can appear at different sizes (e.g. in network vs characters)
 * without sharing a stale clip definition.
 *
 * @param {import('d3').Selection} g            Group element centred at (0, 0)
 * @param {object}                 participant   Participant data
 * @param {number}                 r             Node radius in px
 * @param {import('d3').Selection} defs          SVG <defs> selection
 * @param {function}               iconUrl       fn(participant) → URL string
 */
export function appendIcon(g, participant, r, defs, iconUrl) {
  const clipId = `ss-clip-${participant.id}-${Math.round(r)}`;

  if (defs.select(`#${clipId}`).empty()) {
    defs.append('clipPath')
      .attr('id', clipId)
      .append('circle')
      .attr('r', r - 1)   
      .attr('cx', 0)
      .attr('cy', 0);
  }

  g.append('image')
    .attr('href', iconUrl(participant))
    .attr('width',  r * 2)
    .attr('height', r * 2)
    .attr('x', -r)
    .attr('y', -r)
    .attr('clip-path', `url(#${clipId})`);
}
