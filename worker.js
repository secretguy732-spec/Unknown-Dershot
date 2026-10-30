import { createApp } from './app.js';
import { createStore } from './store.js';

export default {
  async fetch(request, env) {
    return createApp({ env, store: createStore(env.DB) }).fetch(request);
  },
  async scheduled(_event, env) {
    await createApp({ env, store: createStore(env.DB) }).scheduled();
  },
};
