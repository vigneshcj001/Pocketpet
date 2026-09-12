export default {
  id: "panda",
  name: "Panda",
  emoji: "🐼",
  /** What this animal eats; shown as the food item and in menus. */
  food: "🎋",
  paw: { x: 0.71, y: 0.58 },
  svg: `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <ellipse class="p-tail" cx="47" cy="41" rx="4" ry="3.4" fill="#f4f1ef"/>
  <rect class="p-leg-b" x="22" y="45" width="8.5" height="14" rx="4.2" fill="#25212b"/>
  <rect class="p-leg-f" x="34" y="45" width="8.5" height="14" rx="4.2" fill="#332e3a"/>
  <ellipse cx="32" cy="40" rx="16.5" ry="13.5" fill="#f7f5f3"/>
  <path d="M20 33 q12 -5 24 0 q1 6 -2 9 q-10 4 -20 0 q-3 -3 -2 -9 Z" fill="#2a252f" opacity=".92"/>
  <ellipse cx="32" cy="46" rx="9" ry="6" fill="#fffdfb"/>
  <rect class="p-arm" x="39" y="33" width="8" height="14" rx="4" fill="#25212b"/>
  <g class="p-head">
    <circle cx="21" cy="11" r="5.6" fill="#25212b"/>
    <circle cx="43" cy="11" r="5.6" fill="#25212b"/>
    <circle cx="32" cy="22" r="14" fill="#fffdfb"/>
    <ellipse cx="26" cy="20.5" rx="5" ry="6" fill="#25212b" transform="rotate(-16 26 20.5)"/>
    <ellipse cx="38" cy="20.5" rx="5" ry="6" fill="#25212b" transform="rotate(16 38 20.5)"/>
    <ellipse class="p-eye" cx="26.6" cy="20.6" rx="2" ry="2.5" fill="#fff"/>
    <ellipse class="p-eye" cx="37.4" cy="20.6" rx="2" ry="2.5" fill="#fff"/>
    <circle cx="26.6" cy="20.8" r="1.2" fill="#1a161f"/>
    <circle cx="37.4" cy="20.8" r="1.2" fill="#1a161f"/>
    <ellipse cx="32" cy="27.5" rx="2.6" ry="2" fill="#25212b"/>
    <path d="M29.5 30 q2.5 2.4 5 0" fill="none" stroke="#25212b" stroke-width="1.1" stroke-linecap="round"/>
  </g>
</svg>`,
  lines: {
    greet: ["Hi. I brought snacks. 🎋", "Panda reporting for duty.", "Mmm, bamboo."],
    idle: [
      "Everything is fine. Chew bamboo.",
      "Rolling is also a valid form of travel.",
      "You have a lot of windows open, friend.",
      "Slow down. Snack. Continue.",
      "*munch munch* 🎋",
    ],
    click: ["Oh! Hello.", "*flops over*", "That tickles.", "More pats, please."],
    sleep: ["Zzz... 💤", "Nap is the natural state.", "*snores softly*"],
    drag: ["Whoaaa!", "I am not aerodynamic!", "*flails gently*"],
    land: ["*rolls to a stop*", "Stuck the landing. Mostly.", "Oof."],
    close: ["Closed. Less clutter.", "*pats the X*", "One fewer thing."],
    minimize: ["Tucked away.", "*pats minimise*", "Out of sight, calmer mind."],
    mischief: ["That window looked stressed.", "I'm helping.", "Fewer tabs, more calm."],
    perch: ["Cosy up here.", "*flops*"],
    call: ["On my way. Slowly."],
    welcome: ["Back already? Nice.", "Good break."],
    hungry: ["Bamboo... please...", "So hungry. So round.", "I could eat a forest."],
    eat: ["*munch munch munch*", "Bamboo. Bliss.", "More? No? Okay."],
  },
};
