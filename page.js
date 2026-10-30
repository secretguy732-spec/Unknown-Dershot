import { nav, h } from './common.js';
const app = document.getElementById('app');
app.prepend(nav(location.pathname.replace('/', '') || 'home'));
