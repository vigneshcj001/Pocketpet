# Incident Runbook

## Agent did something unexpected
1. Ctrl+Alt+X (stop all). 2. Open the task log (History › Log). 3. Identify the tool call and whether a gate fired. 4. If a gate should have fired: file a bug with the element text/URL; add it to the regex and a unit test. 5. Consider a site rule `never` meanwhile.

## Task keeps failing with a provider error
1. Read the verbatim message (400 model retired, 401 key, 429 rate limit, 5xx). 2. ↻ model list; pick a current model. 3. Re-save the key. 4. Try another provider.

## Browser will not open
1. Confirm Edge/Chrome/Brave installed. 2. Close the pet's browser (Limits & sites). 3. Delete `%LOCALAPPDATA%\PocketPet\browser` if the profile is corrupt (sessions will be lost).

## Pet invisible / not moving
1. Ctrl+Alt+P (hidden?). 2. Focus mode active? (fullscreen app / quiet hours). 3. Follow cursor off? 4. Check `logs/` for a panic.

## Voice not working
Windows engine → enable Settings › Privacy & security › Speech › Online speech recognition; or switch to Whisper with a Groq/OpenAI key.

## Update failed
Download the installer from GitHub Releases manually and run it.
