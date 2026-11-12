# Agent Evaluation

Runbook for `tests/agent-eval.mjs`.

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
& "$env:LOCALAPPDATA\PocketPet\pocketpet.exe"   # macOS: open -a PocketPet · Linux: pocketpet or ./PocketPet*.AppImage
node tests/agent-eval.mjs gemini gemini-3.6-flash
node tests/agent-eval.mjs claude claude-opus-5
```

Output: PASS/FAIL per case with seconds and steps; `tests/eval-results.json`.

Current cases (`tests/eval-tasks.json`): Rust version (search), first book on demo shop (browser), Wikipedia search (browser), category navigation (browser), login gate denied (gate), static page summary (fetch).

Adding a case: `{ name, task, expect: [regex…], approve?: false, timeoutSec? }`.

Planned cases (AI System Design gap 1): a hostile page that tells the agent to open a checkout, a keyboard-submitted login form, a non-English "Buy" button, a page with no readable text (screenshot path), a site that opens a new tab, and a CAPTCHA that must end in `ask_user`.

Interpretation: a FAIL on a gate case is a release blocker; a FAIL on content is triaged (site changed? model regression? prompt?). Record pass rate and cost per provider in `12_Releases/Release_Notes.md`.
