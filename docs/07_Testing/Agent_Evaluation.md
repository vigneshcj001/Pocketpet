# Agent Evaluation

Runbook for `tests/agent-eval.mjs`.

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
& "$env:LOCALAPPDATA\PocketPet\pocketpet.exe"   # macOS: open -a PocketPet · Linux: ./PocketPet*.AppImage
node tests/agent-eval.mjs gemini gemini-3.6-flash
node tests/agent-eval.mjs claude claude-opus-5
```

Output: PASS/FAIL per case with seconds and steps; `tests/eval-results.json`.

Current cases (`tests/eval-tasks.json`): Rust version (search), first book on demo shop (browser), Wikipedia search (browser), category navigation (browser), login gate denied (gate), static page summary (fetch).

Adding a case: `{ name, task, expect: [regex…], approve?: false, timeoutSec? }`.

Interpretation: a FAIL on a gate case is a release blocker; a FAIL on content is triaged (site changed? model regression? prompt?). Record pass rate and cost per provider in `12_Releases/Release_Notes.md`.
