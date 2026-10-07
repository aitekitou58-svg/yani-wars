import { mountAd } from './ads.js';
import { production } from './build-mode.js';
fetch('../config.json').then(r => r.json()).then(c => mountAd(document.querySelector('#info-ad'), c, 'slotInfo', production)).catch(() => {});
