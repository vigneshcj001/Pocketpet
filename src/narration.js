// Overlay narration deliberately uses tool identifiers, never tool arguments or
// raw progress text. Queries, typed text, URLs, and error details stay in Tasks.
const TOOL_LINES = {
  web_search: "Looking for useful information…",
  search_web: "Looking for useful information…",
  fetch_page: "Reading the page…",
  web_fetch: "Reading the page…",
  read_page: "Reading the page…",
  open_browser: "Opening the page…",
  open_url: "Opening the page…",
  screenshot: "Taking a look at the page…",
  browser_snapshot: "Taking a look at the page…",
  press_key: "Moving through the page…",
  browser_press: "Moving through the page…",
  type_text: "Filling in the requested details…",
  browser_type: "Filling in the requested details…",
  click: "Taking the next step…",
  browser_click: "Taking the next step…",
};

export function taskNarration(event = {}) {
  if (event.kind === "tool") return TOOL_LINES[event.detail?.tool] ?? "Working on your task…";
  if (event.kind === "plan") return "Planning the next steps…";
  if (event.kind === "result") return "Checking what I found…";
  if (event.kind === "note" || event.kind === "step") return "Working on your task…";
  if (event.kind === "confirm") return "I need your approval. Open Details.";
  if (event.kind === "ask") return "I have a question for you. Open Details.";
  if (event.kind === "answer") return "Done! Your answer is ready in Details.";
  if (event.kind === "error") return "I couldn't finish this task. See Details.";
  return "On it! Let's get started…";
}
