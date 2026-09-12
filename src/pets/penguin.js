export default {
  id: "penguin",
  name: "Penguin",
  emoji: "🐧",
  /** What this animal eats; shown as the food item and in menus. */
  food: "🐟",
  paw: { x: 0.69, y: 0.6 },
  svg: `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path class="p-tail" d="M45 44 L55 48 L46 50 Z" fill="#241f2b"/>
  <rect class="p-leg-b" x="24" y="48" width="5" height="8" rx="2.5" fill="#e2892a"/>
  <path d="M19 55 h12 l-1 4.5 h-12 Z" fill="#f79a2e"/>
  <rect class="p-leg-f" x="35" y="48" width="5" height="8" rx="2.5" fill="#f79a2e"/>
  <path d="M30 55 h12 l-1 4.5 h-12 Z" fill="#ffab45"/>
  <ellipse cx="32" cy="38" rx="16" ry="15" fill="#2b2533"/>
  <ellipse cx="32.5" cy="41" rx="10.5" ry="11" fill="#fdfbf7"/>
  <!-- flipper: the arm that presses caption buttons -->
  <path class="p-arm" d="M44 29 q8 6 6 16 q-5 2 -8 -4 Z" fill="#241f2b"/>
  <path d="M20 29 q-8 6 -6 16 q5 2 8 -4 Z" fill="#241f2b" opacity=".85"/>
  <g class="p-head">
    <circle cx="32" cy="20" r="13.5" fill="#2b2533"/>
    <path d="M32 8.5 a12 12 0 0 1 10.5 17 q-10.5 5 -21 0 A12 12 0 0 1 32 8.5 Z"
          fill="#2b2533"/>
    <ellipse cx="32" cy="24" rx="10" ry="8.5" fill="#fdfbf7"/>
    <ellipse class="p-eye" cx="27.5" cy="20" rx="2.5" ry="3.2" fill="#241f2b"/>
    <ellipse class="p-eye" cx="36.5" cy="20" rx="2.5" ry="3.2" fill="#241f2b"/>
    <circle cx="28.2" cy="19" r="0.9" fill="#fff"/>
    <circle cx="37.2" cy="19" r="0.9" fill="#fff"/>
    <path d="M28 25 h8 l-4 5 Z" fill="#ff9c2b"/>
    <path d="M28 25 h8 l-4 2 Z" fill="#e07a16"/>
    <circle cx="23" cy="26" r="2.4" fill="#ff9db0" opacity=".4"/>
    <circle cx="41" cy="26" r="2.4" fill="#ff9db0" opacity=".4"/>
  </g>
</svg>`,
  lines: {
    greet: ["Noot noot! 🐧", "Reporting for duty.", "It's warm in here."],
    idle: [
      "Noot.",
      "I'd slide across this desktop if I could.",
      "Formal attire, always.",
      "Is it cold outside? Asking for me.",
      "*waddles thoughtfully*",
    ],
    click: ["Noot noot!", "*flipper five*", "Hey!", "I accept this attention."],
    sleep: ["Zzz... 💤", "*huddles for warmth*", "Noot... noot..."],
    drag: ["NOOOOT!", "Penguins don't fly!", "*flippers windmill*"],
    land: ["*belly slide stop*", "Landed. Dignity intact.", "Noot."],
    close: ["Window closed. Noot.", "*flipper-smacks the X*", "Handled."],
    minimize: ["Minimised. Noot.", "*taps minimise*", "Tucked below."],
    mischief: ["That was strategic.", "Noot. No regrets.", "Desk is cleaner now."],
    perch: ["I shall stand here.", "*waddles into place*"],
    call: ["Sliding over!"],
    welcome: ["Welcome back!", "Refreshed?"],
    hungry: ["Fish delivery when?", "My belly is empty and cold.", "*flaps hopefully*"],
    eat: ["*gulp*", "Fish! Excellent.", "Slippery and delicious."],
  },
};
