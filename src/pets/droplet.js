
/** A little water-drop companion, drawn on an integer pixel grid. */
export default {
  id: "droplet",
  name: "Droplet",
  emoji: "💧",
  food: "🧊",
  paw: { x: 0.84, y: 0.68 },
  voice: { pitch: 1.25, rate: 1.03 },
  tint: ["#52c9ed", "#72d9f5", "#38bae6", "#25aadb", "#1598cf", "#2ab5e5"],
  svg: `<svg viewBox="0 0 64 72" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
    <g class="p-leg-b droplet-foot-left">
      <path d="M17 58h5v7h-5z" fill="#075887"/>
      <path d="M14 62h9v2h2v7H14v-2h-2v-5h2z" fill="#005080"/>
      <path d="M14 64h9v5h-9z" fill="#25aadb"/>
      <path d="M14 64h2v5h-2zM16 63h6v1h-6z" fill="#72d9f5"/>
      <path d="M22 64h2v5h-2z" fill="#1598cf"/>
    </g>
    <g class="p-leg-f droplet-foot-right">
      <path d="M43 58h5v7h-5z" fill="#075887"/>
      <path d="M42 62h9v2h2v5h-2v2H41v-7h1z" fill="#005080"/>
      <path d="M43 64h8v5h-8z" fill="#25aadb"/>
      <path d="M43 64h2v5h-2zM44 63h6v1h-6z" fill="#72d9f5"/>
      <path d="M50 64h2v4h-2z" fill="#1598cf"/>
    </g>
    <g class="p-head droplet-body">
      <path class="droplet-arm-left" d="M10 47H8v2H6v3H4v2h2v2h2v-3h3v-2h1z" fill="#005080"/>
      <path class="p-arm droplet-arm-rest" d="M54 47h2v2h2v3h3v2h-3v2h-2v-3h-3v-2h-1z" fill="#005080"/>
      <g class="droplet-arm-wave">
        <path d="M53 35h3v-2h2v-6h2v-2h5v2h2v7h-2v2h-5v3h-5v2h-3z" fill="#005080"/>
        <path d="M58 29h2v-2h4v2h1v4h-2v2h-5z" fill="#38bae6"/>
        <path d="M59 28h2v-1h3v2h-5z" fill="#72d9f5"/>
      </g>
      <path d="M31 2h2v2h2v3h2v3h2v3h3v3h3v3h3v3h2v4h2v4h2v5h2v17h-2v4h-2v3h-4v2h-6v2H23v-1h-5v-2h-4v-3h-3v-4H9V34h2v-5h2v-5h3v-4h3v-4h3v-4h3V8h3V5h3z" fill="#005080"/>
      <path d="M31 5h2v3h2v3h2v3h3v3h3v3h3v3h2v4h2v4h2v5h2v15h-2v4h-2v3h-4v2h-6v1H23v-1h-5v-2h-3v-3h-2v-4h-2V35h2v-5h2v-5h3v-4h3v-4h3v-4h3V9h3V6h1z" fill="#52c9ed"/>
      <path d="M31 5h2v3h2v3h2v3h3v3h3v3h-7v-2h-8v-2h-3v-3h2V9h3V6h1z" fill="#38bae6"/>
      <path d="M31 5h2v3h-2zM28 9h2v4h-2zM25 14h2v3h-2zM22 18h2v4h-2zM19 22h2v4h-2zM16 27h2v4h-2zM13 32h2v9h-2zM12 41h2v10h-2z" fill="#72d9f5"/>
      <path d="M43 20h3v3h2v4h2v4h2v5h2v15h-2v4h-2v3h-4v2h-6v1h-7V47h2v-9h3v-7h3v-6h2z" fill="#25aadb"/>
      <path d="M51 34h2v3h1v14h-2v4h-2v3h-4v2h-6v1h-6v-2h6v-1h5v-2h3v-3h2V40h1z" fill="#1598cf"/>
      <path d="M27 14h7v2h3v7h-2v4h-3v2h-7v-2h-3v-7h2v-4h3z" fill="#f3fdff"/>
      <path d="M20 22h2v5h-2v4h-2v3h-2v-6h2v-4h2z" fill="#e9fcff"/>
      <path d="M35 14h4v2h4v2h-6v-2h-2z" fill="#005080"/>
      <g class="droplet-eyes-open">
        <g class="droplet-eye">
          <path d="M21 38h4v8h-4z" fill="#032d37"/>
          <path d="M21 38h2v2h-2z" fill="#f3fdff"/>
        </g>
        <g class="droplet-eye">
          <path d="M40 38h4v8h-4z" fill="#032d37"/>
          <path d="M40 38h2v2h-2z" fill="#f3fdff"/>
        </g>
      </g>
      <g class="droplet-eyes-closed" fill="#032d37">
        <path d="M19 41h2v2h4v-2h2v3h-2v1h-4v-1h-2z"/>
        <path d="M38 41h2v2h4v-2h2v3h-2v1h-4v-1h-2z"/>
      </g>
      <g class="droplet-eyes-happy" fill="#032d37">
        <path d="M19 42h2v-2h2v-2h2v2h-2v2h-2v2h-2z"/>
        <path d="M40 42h2v-2h2v-2h2v2h-2v2h-2v2h-2z"/>
      </g>
      <path d="M18 46h3v2h3v3h-3v2h-3v-2h-3v-3h3zM43 46h3v2h3v3h-3v2h-3v-2h-3v-3h3z" fill="#ffabbc"/>
      <path class="droplet-mouth-rest" d="M31 49h4v2h-4z" fill="#032d37"/>
      <g class="droplet-mouth-happy">
        <path d="M28 45h9v8h-2v4h-4v-2h-2v-6h-1z" fill="#032d37"/>
        <path d="M30 48h5v5h-2v2h-2v-5h-1z" fill="#ff8fac"/>
        <path d="M30 48h5v2h-5z" fill="#ffc1ce"/>
      </g>
    </g>
  </svg>`,
  lines: {
    greet: ["A little drop of company.", "Hi! Let's make something.", "Ready when you are."],
    idle: ["One little thing at a time.", "I'm right here.", "A tiny water break? 💧"],
    click: ["Boop!", "That tickles!", "A little splash of joy."],
    sleep: ["Zzz…", "Recharging my sparkle.", "Dreaming of rain."],
    drag: ["Weeee!", "Cloud hopping!", "Where are we going?"],
    land: ["Splash!", "Made it.", "Soft landing."],
    close: ["All tidied up.", "One less thing."],
    minimize: ["Tucked away.", "A little more room."],
    mischief: ["Just a tiny splash.", "Oops. That was me."],
    perch: ["Lovely view.", "I'll keep you company."],
    call: ["Coming!", "On my way."],
    welcome: ["You're back!", "Ready for another little adventure?"],
    hungry: ["A little ice cube, please?", "Time for a water break."],
    eat: ["Refreshingly good!", "*tiny crunch*", "Thank you!"],
  },
};
