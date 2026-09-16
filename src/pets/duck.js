export default {
  id: "duck",
  name: "Duck",
  emoji: "🦆",
  /** What this animal eats; shown as the food item and in menus. */
  /** Body fills, darkest-to-lightest offsets relative to the first; recoloured by the colour picker. */
  tint: ["#f5cf3d", "#f5c62f", "#ffd94a", "#ffe15c", "#ffeb96", "#fff0ae"],
  food: "🍞",
  paw: { x: 0.68, y: 0.58 },
  svg: `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path class="p-tail" d="M46 38 L58 31 L57 43 Z" fill="#f5cf3d"/>
  <rect class="p-leg-b" x="24" y="46" width="5.5" height="11" rx="2.7" fill="#e2892a"/>
  <path d="M19 56 h13 l-1.5 4 h-13 Z" fill="#f79a2e"/>
  <rect class="p-leg-f" x="34" y="46" width="5.5" height="11" rx="2.7" fill="#f79a2e"/>
  <path d="M29 56 h13 l-1.5 4 h-13 Z" fill="#ffab45"/>
  <ellipse cx="32" cy="40" rx="16.5" ry="13" fill="#ffd94a"/>
  <ellipse cx="33" cy="44" rx="10" ry="7" fill="#fff0ae"/>
  <!-- the wing doubles as the arm that reaches for buttons -->
  <path class="p-arm" d="M38 32 q10 2 9 11 q-6 3 -11 -2 Z" fill="#f5c62f"/>
  <g class="p-head">
    <circle cx="32" cy="21" r="13" fill="#ffe15c"/>
    <path d="M18 14 q7 -6 14 -3 q-6 1 -14 3 Z" fill="#ffeb96"/>
    <ellipse class="p-eye" cx="27" cy="19.5" rx="2.3" ry="3" fill="#2c2438"/>
    <ellipse class="p-eye" cx="37.5" cy="19.5" rx="2.3" ry="3" fill="#2c2438"/>
    <circle cx="27.7" cy="18.5" r="0.8" fill="#fff"/>
    <circle cx="38.2" cy="18.5" r="0.8" fill="#fff"/>
    <path d="M24 25 q8 -2 16 0 q-8 7 -16 0 Z" fill="#ff9c2b"/>
    <path d="M25.5 25.8 q6.5 -1.2 13 0" fill="none" stroke="#e07a16" stroke-width="0.9"/>
    <circle cx="21" cy="26" r="2.6" fill="#ff9db0" opacity=".45"/>
    <circle cx="43" cy="26" r="2.6" fill="#ff9db0" opacity=".45"/>
  </g>
</svg>`,
  lines: {
    greet: ["Quack. 🦆", "Rubber duck debugging, at your service.", "Quack quack!"],
    idle: [
      "Explain your bug to me. Out loud. I'll wait.",
      "*paddles across the desktop*",
      "Have you tried turning it off and on?",
      "Quack... that variable name is suspicious.",
      "Water break? 💧",
    ],
    click: ["Quack!", "Squeak!", "*flaps wings*", "Rude. But okay."],
    sleep: ["Zzz... 💤", "*tucks head under wing*", "Quackzzz."],
    drag: ["QUAAACK!", "I can't fly that well!", "*flaps frantically*"],
    land: ["Splashdown!", "*waddles off*", "Smooth landing."],
    close: ["Quack! Window closed.", "*wing-slaps the X*", "That one's done."],
    minimize: ["Down it goes. Quack.", "*wing on minimise*", "Tidied."],
    mischief: ["Quack. That was me.", "Oops, wing slipped.", "Too many windows!"],
    perch: ["Perch acquired.", "*wiggles into place*"],
    call: ["Quack! Coming!", "Incoming duck!"],
    welcome: ["Welcome back!", "Good stretch?"],
    hungry: ["Bread. I require bread.", "*stares at you hungrily*", "Quack means feed me."],
    eat: ["*nom nom*", "Bread! Best day.", "Crumbs everywhere. Perfect."],
  },
};
