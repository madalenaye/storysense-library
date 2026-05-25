/**
 * Pre-creates named SVG <g> layers in a fixed z-order.
 * Primitives call layer('nodes') instead of appending
 * directly to the SVG — this guarantees edges always sit
 * below nodes, labels always sit on top, etc.
 */
const ORDER = ['background', 'paths', 'edges', 'nodes', 'pins', 'labels', 'overlay'];

export function createLayers(svg) {
  const map = {};
  ORDER.forEach(name => {
    map[name] = svg.append('g').attr('class', `ss-layer-${name}`);
  });

  return function layer(name) {
    if (!map[name]) {
      console.warn(`storysense: unknown layer "${name}", using overlay`);
      return map.overlay;
    }
    return map[name];
  };
}
