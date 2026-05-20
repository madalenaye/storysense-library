/**
 * Shared blackboard passed to every primitive.
 * Primitives read and write named keys — the context is
 * the coordination mechanism between independent marks.
 */
export function createContext(data, opts) {
  const registry = {};

  return {
    data,
    opts,

    set(key, value) {
      registry[key] = value;
    },

    get(key) {
      return registry[key];
    },

    has(key) {
      return key in registry;
    },
  };
}
