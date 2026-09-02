export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    getState() {
      return state;
    },

    setState(update) {
      const patch = typeof update === 'function' ? update(state) : update;
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
