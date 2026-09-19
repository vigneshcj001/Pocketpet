// Sprite colouring shared by the overlay and the settings preview. No DOM
// dependency beyond producing markup strings.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Colour picking works on the SVG itself: every fill in the pet's `tint`
// list is replaced by the chosen colour, keeping each fill's lightness
// offset from the first (the "base" body colour). Raster custom pets can't
// be recoloured this way and are left alone.
export function tintedSvg(p, color) {
  if (!color || !p.tint?.length) return p.svg;
  const target = hexToHsl(color);
  const base = hexToHsl(p.tint[0]);
  const map = new Map();
  for (const c of p.tint) {
    const src = hexToHsl(c);
    const l = clamp(target.l + (src.l - base.l), 0.04, 0.96);
    const s = clamp(target.s + (src.s - base.s) * 0.5, 0, 1);
    map.set(c.toLowerCase(), hslToHex(target.h, s, l));
  }
  const pattern = new RegExp([...map.keys()].join("|"), "gi");
  return p.svg.replace(pattern, (m) => map.get(m.toLowerCase()) ?? m);
}

/** Markup for a custom (raster) pet's sprite. */
export const customImageSvg = (image) => `<img class="custom-img" src="${image}" alt="" draggable="false" />`;

/** Fill `container` with emoji accessory spans positioned by styles.css / settings.css. */
export function renderAccessoryNodes(container, items) {
  container.innerHTML = "";
  for (const a of items) {
    const span = document.createElement("span");
    span.className = `acc acc-${a.slot}`;
    span.textContent = a.emoji;
    span.style.setProperty("--acc-size", a.size);
    span.style.setProperty("--acc-x", `${a.x}%`);
    span.style.setProperty("--acc-y", `${a.y}%`);
    container.append(span);
  }
}
