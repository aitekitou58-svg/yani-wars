import { palette } from "./core.js";
import { worldDays } from "./world.js";

// Fixed planting locations keep the user's landscape stable across reloads.
// Each plant grows continuously from its own start; there are no level switches.
const scatter = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const trees = Array.from({ length: 58 }, (_, i) => {
  let x = 8 + i * 11.8 + scatter(i + 70) * 17;
  if (x > 348 && x < 415) x += 72;
  const depth = scatter(i + 200);
  const y = 246 + depth * 59;
  const height = (35 + depth * 64) * (.65 + scatter(i + 300) * .85);
  const early = i % 10 === 0;
  return [x, early ? 272 + depth * 23 : y, early ? Math.max(65, height) : height, early ? 20 : 30 + scatter(i + 400) * 125,
    early ? 12 : 25 + scatter(i + 500) * 24, .72 + scatter(i + 600) * .45];
}).sort((a, b) => a[1] - b[1]);
const flowers = [];
const ground = x => 342 - 65 * Math.exp(-Math.pow((x - 425) / 165, 2));
for (let i = 0; flowers.length < 340; i++) {
  const x = 5 + scatter(i * 2) * 690;
  const y = 300 + scatter(i * 2 + 1) * 119;
  const leftBank = 305 + (420 - y) * .65;
  const rightBank = 375 + (420 - y) * .23;
  if (y < ground(x) + 9 || (x > leftBank - 9 && x < rightBank + 9)) continue;
  const n = flowers.length;
  flowers.push([x, y, 5 + (y - 290) * .18 + ((i * 7) % 5),
    n < 6 ? 1 + n * 1.5 : 8 + ((n * 37) % 150),
    8 + (n % 5) * 4, n % 5]);
}
// Extra flowers follow the left bank rather than a rectangular planting grid.
for (let i = 0; i < 110; i++) {
  const y = 314 + scatter(i + 900) * 104;
  const x = 305 + (420 - y) * .65 - 13 - scatter(i + 1000) * 72;
  if (y < ground(x) + 9) continue;
  flowers.push([x, y, 5 + (y - 290) * .18 + scatter(i + 1100) * 5,
    8 + scatter(i + 1200) * 120, 14 + (i % 5) * 4, i % 5]);
}
flowers.sort((a, b) => a[1] - b[1]);
const tufts = Array.from({ length: 28 }, (_, i) => [
  12 + ((i * 79) % 682),
  333 + ((i * 23) % 87),
  i * 0.8,
  8 + i,
]);

export function plantGrowth(count, start, pace) {
  return 1 - Math.exp(-Math.max(0, count - start) / pace);
}
export function vegetation(count) {
  const days = worldDays(count);
  return {
    trees: trees.map(([x, y, height, start, pace, width]) => ({
      x,
      y,
      height,
      width,
      growth: plantGrowth(days, start, pace),
    })),
    flowers: flowers.map(([x, y, height, start, pace, color]) => ({
      x,
      y,
      height,
      color,
      growth: plantGrowth(days, 30 + (start - 1) * 1.5, 15 + pace),
    })),
    tufts: tufts.map(([x, y, start, pace]) => ({
      x,
      y,
      growth: plantGrowth(days, 30 + start * 2, 20 + pace),
    })),
  };
}
const f = (n) => Number(n.toFixed(4));
function treeSvg(t, p) {
  const scale = f((t.height / 120) * t.growth);
  return `<g data-plant="tree" data-growth="${f(t.growth)}" transform="translate(${t.x} ${t.y}) scale(${f(scale * t.width)} ${scale})" opacity="${f(Math.min(1, t.growth * 4))}">
    <path d="M-5 0 0-90 5 0Z" fill="${p.bark}"/>
    <path d="M0-37-24-66M0-56 24-84" fill="none" stroke="${p.bark}" stroke-width="3" stroke-linecap="round"/>
    <path d="M-40-61C-56-76-43-101-26-101-34-119-13-135 2-126 16-142 41-124 37-107 60-101 54-77 43-72 40-46 11-48 2-53-15-42-35-47-40-61Z" fill="${p.leaf}"/>
    <path d="M-31-94C-39-108-24-120-11-119-9-133 14-136 23-123 39-125 45-108 36-98 18-108 7-90-6-96-16-86-27-87-31-94Z" fill="${p.leafLight}" opacity=".64"/>
    <path d="M-26-70q13 8 26-1m11 6q12 3 21-6" fill="none" stroke="${p.leafLight}" stroke-width="2" opacity=".45" stroke-linecap="round"/>
  </g>`;
}
function flowerSvg(t, p) {
  const scale = f((t.height / 25) * t.growth),
    color = [p.flower, p.blush, "#e8b9d9", "#f7f4e8", "#c5b8ec"][t.color];
  return `<g data-plant="flower" data-growth="${f(t.growth)}" transform="translate(${t.x} ${t.y}) scale(${scale})" opacity="${f(Math.min(1, t.growth * 4))}">
    <path d="M0 0q3-12 0-25" fill="none" stroke="${p.leaf}" stroke-width="1.8"/>
    <path d="M1-8q-13-10-11-3 1 7 11 3m0-5q10-10 10-3-1 6-10 3" fill="${p.leafLight}"/>
    <g fill="${color}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-30" rx="3.5" ry="5.5" transform="rotate(${a} 0 -25)"/>`).join("")}</g>
    <circle cy="-25" r="2.8" fill="#d4b362"/>
  </g>`;
}

export function landscapeSvg(count, { compact = false } = {}) {
  const p = palette(count),
    plants = vegetation(count),
    fishGrowth = plantGrowth(worldDays(count), 90, 60),
    waterId = `world-water-${Math.max(0, Math.round(count))}-${compact ? "compact" : "full"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${compact ? "0 120 700 300" : "0 0 700 420"}" width="700" height="${compact ? 300 : 420}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <style>@keyframes world-swim {0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(5px,-9px) rotate(8deg)}}
    .world-fish{animation:world-swim 5s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
    @media (prefers-reduced-motion:reduce){.world-fish{animation:none}}</style>
    <defs><linearGradient id="${waterId}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${p.waterLight}"/><stop offset="1" stop-color="${p.water}"/></linearGradient><filter id="world-grain"><feTurbulence type="fractalNoise" baseFrequency=".66" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".10"/></feComponentTransfer></filter></defs>
    <path fill="${p.sky}" d="M0 0h700v420H0z"/>
    <circle cx="487" cy="116" r="58" fill="${p.bg}"/>
    <path d="M0 233Q134 101 289 217T700 179V420H0" fill="${p.hill}"/>
    <path d="M0 296Q175 198 363 275T700 212V420H0" fill="${p.green}" opacity=".57"/>
    ${plants.trees
      .slice(0)
      .map((t) => treeSvg(t, p))
      .join("")}
    <path d="M0 334Q150 365 301 301T700 314V420H0" fill="${p.green}"/>
    <path data-world="stream" d="M305 425c4-93 82-106 97-144-5 53-41 73-27 144" fill="url(#${waterId})"/>
    <path d="M323 415q-2-33 21-58m17-15q25-24 32-40M357 414q-9-25-1-42" fill="none" stroke="${p.waterLight}" stroke-width="2" opacity=".7" stroke-linecap="round"/>
    ${[[338,398,1],[357,367,.8],[378,330,.55],[349,414,.65]].map(([x,y,size],i)=>`<g data-animal="fish" data-growth="${f(fishGrowth)}" transform="translate(${x} ${y}) scale(${f(size * fishGrowth)})" opacity="${f(fishGrowth)}"><g class="world-fish" style="animation-delay:-${i * 1.3}s"><path d="M0-9Q-6-3 0 7Q6-3 0-9M0 5-4 12 0 10 4 12Z" fill="#286b88"/><path d="M0-5V4" stroke="#87cbd7" stroke-width="1.2"/><circle cx="1.5" cy="-4" r=".8" fill="#153c50"/></g></g>`).join("")}

    <path d="M75 420q13-55 2-93m4 70-14-13m13-6 12-17" fill="none" stroke="${p.bark}" stroke-width="2" opacity="${f(1 - p.progress * 0.6)}"/>
    ${plants.tufts.map((t) => `<g transform="translate(${t.x} ${t.y}) scale(${f(t.growth)})" opacity="${f(t.growth * 0.8)}" fill="none" stroke="${p.leafLight}" stroke-width="1.5" stroke-linecap="round"><path d="M0 0-6-15M0 0 2-21M0 0 8-12"/></g>`).join("")}
    ${plants.flowers.map((t) => flowerSvg(t, p)).join("")}
    <path d="M0 0h700v420H0z" filter="url(#world-grain)" opacity="${f(1 - p.progress * 0.9)}"/>
  </svg>`;
}
