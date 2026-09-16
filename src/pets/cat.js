// Every pet exposes the same part classes (p-head, p-arm, p-leg-f, p-leg-b,
// p-tail, p-eye) so styles.css can animate all four animals with one ruleset.
export default {
  id: "cat",
  name: "Cat",
  emoji: "🐱",
  /** Where the paw sits, as a fraction of the sprite box. Used to aim reaches. */
  /** What this animal eats; shown as the food item and in menus. */
  /** Body fills, darkest-to-lightest offsets relative to the first; recoloured by the colour picker. */
  tint: ["#f5a94c", "#f9b75c", "#d3812f", "#e8963c", "#e08b30", "#ffdcb0", "#ffe6c4"],
  food: "🐟",
  paw: { x: 0.7, y: 0.6 },
  svg: `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <path class="p-tail" d="M45 43 C 58 43, 60 28, 51 22"
        fill="none" stroke="#e8963c" stroke-width="5.5" stroke-linecap="round"/>
  <rect class="p-leg-b" x="23" y="45" width="7.5" height="13" rx="3.7" fill="#d3812f"/>
  <rect class="p-leg-f" x="34" y="45" width="7.5" height="13" rx="3.7" fill="#f5a94c"/>
  <ellipse cx="32" cy="40" rx="16" ry="13" fill="#f5a94c"/>
  <ellipse cx="33" cy="44" rx="9.5" ry="7" fill="#ffdcb0"/>
  <path d="M22 32 h12 v3 h-12z M20 39 h14 v3 h-14z" fill="#e08b30" opacity=".55"/>
  <rect class="p-arm" x="40" y="33" width="7" height="13.5" rx="3.5" fill="#f5a94c"/>
  <g class="p-head">
    <path d="M21 15 L24 3 L33 12 Z" fill="#f5a94c"/>
    <path d="M43 15 L40 3 L31 12 Z" fill="#f5a94c"/>
    <path d="M23.5 14 L25.5 7 L30.5 12.5 Z" fill="#ff9db0"/>
    <path d="M40.5 14 L38.5 7 L33.5 12.5 Z" fill="#ff9db0"/>
    <circle cx="32" cy="22" r="13.5" fill="#f9b75c"/>
    <ellipse class="p-eye" cx="26.5" cy="21" rx="2.4" ry="3.2" fill="#2c2438"/>
    <ellipse class="p-eye" cx="37.5" cy="21" rx="2.4" ry="3.2" fill="#2c2438"/>
    <circle cx="27.2" cy="20" r="0.8" fill="#fff"/>
    <circle cx="38.2" cy="20" r="0.8" fill="#fff"/>
    <ellipse cx="32" cy="27" rx="6" ry="4.5" fill="#ffe6c4"/>
    <path d="M30 26 h4 l-2 2.2 Z" fill="#ff8fa3"/>
    <path d="M30.2 28.6 q1.8 1.8 3.6 0" fill="none" stroke="#2c2438" stroke-width="1" stroke-linecap="round"/>
    <g stroke="#d3812f" stroke-width="0.9" stroke-linecap="round" opacity=".8">
      <path d="M24 25 L17 23.5"/><path d="M24 27 L17 27.5"/>
      <path d="M40 25 L47 23.5"/><path d="M40 27 L47 27.5"/>
    </g>
  </g>
</svg>`,
  lines: {
    greet: ["Mrrp! I live here now.", "Nyaa~ 🐾", "Did someone say snacks?"],
    idle: [
      "Purrrr...",
      "You've been staring at that screen a while.",
      "I knocked something off a table. Somewhere.",
      "Stretch break? 🐈",
      "I could nap on that taskbar.",
    ],
    click: ["Mrrow!", "Scritches! More.", "*headbutt*", "You may pet me. Once."],
    sleep: ["Zzz... 💤", "Do not disturb. Cat loading.", "*curls into a loaf*"],
    drag: ["Weeee!", "Unhand me, human!", "*dangles*"],
    land: ["Always on my feet.", "Nailed it.", "*thump*"],
    close: ["Bye bye, window!", "*swats the X*", "Gone. You're welcome."],
    minimize: ["Shrink!", "Down you go.", "*boops minimise*"],
    mischief: ["Oops. My paw slipped.", "That one looked closable.", "Tidying up~"],
    perch: ["Fine. I'll stay up here.", "*settles in*", "Good spot."],
    call: ["Coming!", "Make room~"],
    welcome: ["You're back. I waited. Barely.", "Feeling better?"],
    hungry: ["Feed me, human.", "My bowl echoes.", "Is it fish o'clock yet?"],
    eat: ["Nom nom nom.", "*crunch* Acceptable.", "Fish! You are forgiven."],
  },
};
