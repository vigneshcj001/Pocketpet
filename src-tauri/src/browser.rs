//! Browser driver for the task agent: launches Edge/Chrome with its own
//! profile and remote debugging, then drives one tab over the Chrome DevTools
//! Protocol. The model sees the page as a numbered list of interactive
//! elements plus readable text ("read_page"), and acts through click / type /
//! select / scroll / press / navigate / screenshot.
//!
//! Real input events (Input.dispatch*) are used for clicks and typing so React
//! and friends behave as with a human.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_tungstenite::tungstenite::Message;

const VIEWPORT: (u32, u32) = (1180, 860);

// --- launching -------------------------------------------------------------------

fn browser_exe() -> Option<std::path::PathBuf> {
    let pf86 = std::env::var("ProgramFiles(x86)").unwrap_or_default();
    let pf = std::env::var("ProgramFiles").unwrap_or_default();
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let candidates = [
        format!(r"{pf86}\Microsoft\Edge\Application\msedge.exe"),
        format!(r"{pf}\Microsoft\Edge\Application\msedge.exe"),
        format!(r"{pf}\Google\Chrome\Application\chrome.exe"),
        format!(r"{pf86}\Google\Chrome\Application\chrome.exe"),
        format!(r"{local}\Google\Chrome\Application\chrome.exe"),
        format!(r"{pf}\BraveSoftware\Brave-Browser\Application\brave.exe"),
    ];
    candidates.into_iter().map(std::path::PathBuf::from).find(|p| p.exists())
}

fn profile_dir() -> std::path::PathBuf {
    let local = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(local).join("PocketPet").join("browser")
}

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|a| a.port())
        .unwrap_or(9333)
}

// --- CDP client ---------------------------------------------------------------------

struct Cdp {
    tx: mpsc::UnboundedSender<String>,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>,
    next: AtomicU64,
}

impl Cdp {
    async fn connect(url: &str) -> Result<Arc<Cdp>, String> {
        let (ws, _) = tokio_tungstenite::connect_async(url).await.map_err(|e| format!("CDP connect: {e}"))?;
        let (mut sink, mut stream): (_, _) = ws.split();
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>> = Arc::new(Mutex::new(HashMap::new()));
        let p2 = pending.clone();
        tokio::spawn(async move {
            while let Some(text) = rx.recv().await {
                if sink.send(Message::Text(text.into())).await.is_err() {
                    break;
                }
            }
        });
        tokio::spawn(async move {
            while let Some(Ok(msg)) = stream.next().await {
                if let Message::Text(t) = msg {
                    if let Ok(v) = serde_json::from_str::<Value>(&t) {
                        if let Some(id) = v.get("id").and_then(Value::as_u64) {
                            if let Some(tx) = p2.lock().await.remove(&id) {
                                let _ = tx.send(v);
                            }
                        }
                        // events are ignored; we poll state instead of subscribing
                    }
                }
            }
        });
        Ok(Arc::new(Cdp { tx, pending, next: AtomicU64::new(1) }))
    }

    async fn call(&self, session: Option<&str>, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);
        let mut msg = json!({ "id": id, "method": method, "params": params });
        if let Some(s) = session {
            msg["sessionId"] = json!(s);
        }
        self.tx.send(msg.to_string()).map_err(|_| "CDP send failed (browser closed?)".to_string())?;
        let v = tokio::time::timeout(Duration::from_secs(30), rx)
            .await
            .map_err(|_| format!("CDP timeout on {method}"))?
            .map_err(|_| "CDP connection dropped".to_string())?;
        if let Some(err) = v.get("error") {
            return Err(format!("{method}: {}", err.get("message").and_then(Value::as_str).unwrap_or("error")));
        }
        Ok(v.get("result").cloned().unwrap_or(Value::Null))
    }
}

// --- one driven tab -----------------------------------------------------------------

pub struct Browser {
    cdp: Arc<Cdp>,
    /// The attached tab; swapped when the page opens a new one.
    session: std::sync::Mutex<String>,
    known_targets: std::sync::Mutex<HashSet<String>>,
    pub pid: u32,
    child: Option<std::process::Child>,
}

impl Browser {
    pub async fn launch() -> Result<Browser, String> {
        let exe = browser_exe().ok_or("No Chromium browser found (Edge, Chrome or Brave).")?;
        let port = free_port();
        let dir = profile_dir();
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let child = std::process::Command::new(&exe)
            .arg(format!("--remote-debugging-port={port}"))
            .arg(format!("--user-data-dir={}", dir.display()))
            .arg(format!("--window-size={},{}", VIEWPORT.0 + 16, VIEWPORT.1 + 130))
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg("--disable-features=Translate,MediaRouter")
            .arg("--new-window")
            .arg("about:blank")
            .spawn()
            .map_err(|e| format!("Could not start browser: {e}"))?;
        let pid = child.id();

        // Wait for the DevTools endpoint.
        let client = reqwest::Client::new();
        let mut ws_url = None;
        for _ in 0..60 {
            if let Ok(r) = client.get(format!("http://127.0.0.1:{port}/json/version")).send().await {
                if let Ok(v) = r.json::<Value>().await {
                    ws_url = v.get("webSocketDebuggerUrl").and_then(Value::as_str).map(String::from);
                    if ws_url.is_some() {
                        break;
                    }
                }
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
        let ws_url = ws_url.ok_or("Browser started but DevTools did not come up.")?;
        let cdp = Cdp::connect(&ws_url).await?;

        // Reuse the blank tab the browser opened, or make one.
        let targets = cdp.call(None, "Target.getTargets", json!({})).await?;
        let mut target_id = targets
            .get("targetInfos")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .find(|t| t.get("type").and_then(Value::as_str) == Some("page"))
            .and_then(|t| t.get("targetId").and_then(Value::as_str))
            .map(String::from);
        if target_id.is_none() {
            let created = cdp.call(None, "Target.createTarget", json!({ "url": "about:blank" })).await?;
            target_id = created.get("targetId").and_then(Value::as_str).map(String::from);
        }
        let target_id = target_id.ok_or("No page target")?;
        let attached = cdp.call(None, "Target.attachToTarget", json!({ "targetId": target_id, "flatten": true })).await?;
        let session = attached.get("sessionId").and_then(Value::as_str).ok_or("No session")?.to_string();
        let mut known = HashSet::new();
        for t in targets.get("targetInfos").and_then(Value::as_array).into_iter().flatten() {
            if let Some(id) = t.get("targetId").and_then(Value::as_str) {
                known.insert(id.to_string());
            }
        }
        known.insert(target_id.clone());
        let b = Browser { cdp, session: std::sync::Mutex::new(session), known_targets: std::sync::Mutex::new(known), pid, child: Some(child) };
        b.cmd("Page.enable", json!({})).await?;
        b.cmd("Runtime.enable", json!({})).await?;
        let _ = b.cmd("Page.bringToFront", json!({})).await;
        Ok(b)
    }

    async fn cmd(&self, method: &str, params: Value) -> Result<Value, String> {
        let session = self.session.lock().unwrap().clone();
        self.cdp.call(Some(&session), method, params).await
    }

    /// Sites open payment gateways and "view on map" in new tabs. If one has
    /// appeared since we last looked, drive that instead. Returns true on switch.
    pub async fn follow_new_tab(&self) -> Result<bool, String> {
        let targets = self.cdp.call(None, "Target.getTargets", json!({})).await?;
        let mut newest: Option<String> = None;
        {
            let mut known = self.known_targets.lock().unwrap();
            for t in targets.get("targetInfos").and_then(Value::as_array).into_iter().flatten() {
                if t.get("type").and_then(Value::as_str) != Some("page") {
                    continue;
                }
                let Some(id) = t.get("targetId").and_then(Value::as_str) else { continue };
                if known.insert(id.to_string()) {
                    newest = Some(id.to_string());
                }
            }
        }
        let Some(id) = newest else { return Ok(false) };
        let attached = self.cdp.call(None, "Target.attachToTarget", json!({ "targetId": id, "flatten": true })).await?;
        let session = attached.get("sessionId").and_then(Value::as_str).ok_or("No session")?.to_string();
        *self.session.lock().unwrap() = session;
        self.cmd("Page.enable", json!({})).await?;
        self.cmd("Runtime.enable", json!({})).await?;
        self.wait_loaded().await;
        Ok(true)
    }

    /// Readable text of the page (for the purchase cap), capped.
    pub async fn page_text(&self) -> Result<String, String> {
        let v = self.eval("(document.body ? document.body.innerText : '').slice(0, 20000)").await?;
        Ok(v.as_str().unwrap_or("").to_string())
    }

    /// Run JS in the page and return its JSON-serialisable result.
    async fn eval(&self, expression: &str) -> Result<Value, String> {
        let r = self
            .cmd(
                "Runtime.evaluate",
                json!({ "expression": expression, "returnByValue": true, "awaitPromise": true }),
            )
            .await?;
        if let Some(ex) = r.get("exceptionDetails") {
            return Err(format!("page script error: {}", ex.get("text").and_then(Value::as_str).unwrap_or("?")));
        }
        Ok(r.pointer("/result/value").cloned().unwrap_or(Value::Null))
    }

    pub async fn navigate(&self, url: &str) -> Result<String, String> {
        let url = if url.starts_with("http") { url.to_string() } else { format!("https://{url}") };
        self.cmd("Page.navigate", json!({ "url": url })).await?;
        self.wait_loaded().await;
        self.summary().await
    }

    async fn wait_loaded(&self) {
        for _ in 0..60 {
            tokio::time::sleep(Duration::from_millis(250)).await;
            if let Ok(v) = self.eval("document.readyState").await {
                if v.as_str() == Some("complete") {
                    break;
                }
            }
        }
        // Let late scripts settle a little.
        tokio::time::sleep(Duration::from_millis(600)).await;
    }

    pub async fn summary(&self) -> Result<String, String> {
        let v = self.eval("JSON.stringify({ url: location.href, title: document.title })").await?;
        Ok(v.as_str().unwrap_or("{}").to_string())
    }

    pub async fn current_host(&self) -> String {
        self.eval("location.hostname").await.ok().and_then(|v| v.as_str().map(String::from)).unwrap_or_default()
    }

    /// Numbered interactive elements + readable text. Refs live in window.__ppRefs.
    pub async fn read_page(&self) -> Result<String, String> {
        let v = self.eval(READ_PAGE_JS).await?;
        Ok(v.as_str().unwrap_or("").to_string())
    }

    /// Description of a ref (for confirmation gates), or an error if stale.
    pub async fn describe(&self, r#ref: u32) -> Result<Value, String> {
        let v = self
            .eval(&format!(
                r#"(() => {{ const el = (window.__ppRefs||[])[{r}]; if (!el) return null;
                    const t = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || el.id || '').trim().slice(0,120);
                    return {{ tag: el.tagName.toLowerCase(), type: (el.type||'').toLowerCase(), text: t, autocomplete: (el.getAttribute('autocomplete')||'').toLowerCase(), href: el.href||'' }}; }})()"#,
                r = r#ref
            ))
            .await?;
        if v.is_null() {
            return Err(format!("[{}] is not on the page any more; call read_page again.", r#ref));
        }
        Ok(v)
    }

    /// Scroll a ref into view and return its centre in CSS px, plus the page's DPR.
    async fn center(&self, r#ref: u32) -> Result<(f64, f64), String> {
        let v = self
            .eval(&format!(
                r#"(() => {{ const el = (window.__ppRefs||[])[{r}]; if (!el) return null;
                    el.scrollIntoView({{ block: 'center', inline: 'center' }});
                    const b = el.getBoundingClientRect();
                    return {{ x: b.left + b.width / 2, y: b.top + b.height / 2 }}; }})()"#,
                r = r#ref
            ))
            .await?;
        let x = v.get("x").and_then(Value::as_f64).ok_or(format!("[{}] is not on the page any more; call read_page again.", r#ref))?;
        let y = v.get("y").and_then(Value::as_f64).unwrap_or(0.0);
        tokio::time::sleep(Duration::from_millis(120)).await;
        Ok((x, y))
    }

    pub async fn click(&self, r#ref: u32) -> Result<(f64, f64), String> {
        let (x, y) = self.center(r#ref).await?;
        for (t, extra) in [("mouseMoved", json!({})), ("mousePressed", json!({ "button": "left", "clickCount": 1 })), ("mouseReleased", json!({ "button": "left", "clickCount": 1 }))] {
            let mut p = json!({ "type": t, "x": x, "y": y });
            for (k, v) in extra.as_object().into_iter().flatten() {
                p[k] = v.clone();
            }
            self.cmd("Input.dispatchMouseEvent", p).await?;
        }
        self.wait_loaded().await;
        Ok((x, y))
    }

    pub async fn type_text(&self, r#ref: u32, text: &str, submit: bool) -> Result<(f64, f64), String> {
        let (x, y) = self.center(r#ref).await?;
        // Focus with a real click, clear, then insert.
        for (t, extra) in [("mousePressed", json!({ "button": "left", "clickCount": 1 })), ("mouseReleased", json!({ "button": "left", "clickCount": 1 }))] {
            let mut p = json!({ "type": t, "x": x, "y": y });
            for (k, v) in extra.as_object().into_iter().flatten() {
                p[k] = v.clone();
            }
            self.cmd("Input.dispatchMouseEvent", p).await?;
        }
        let _ = self
            .eval(&format!(
                r#"(() => {{ const el = (window.__ppRefs||[])[{r}]; if (el && 'value' in el) {{ el.focus(); el.select && el.select(); }} return true; }})()"#,
                r = r#ref
            ))
            .await;
        self.press("Control+a").await?;
        self.cmd("Input.insertText", json!({ "text": text })).await?;
        if submit {
            self.press("Enter").await?;
            self.wait_loaded().await;
        }
        Ok((x, y))
    }

    pub async fn select(&self, r#ref: u32, value: &str) -> Result<String, String> {
        let v = self
            .eval(&format!(
                r#"(() => {{ const el = (window.__ppRefs||[])[{r}]; if (!el || el.tagName !== 'SELECT') return 'not a select';
                    const want = {val}.toLowerCase();
                    const opt = [...el.options].find(o => o.value.toLowerCase() === want || o.text.trim().toLowerCase() === want)
                             || [...el.options].find(o => o.text.toLowerCase().includes(want));
                    if (!opt) return 'no option matches; options: ' + [...el.options].map(o => o.text.trim()).slice(0, 30).join(' | ');
                    el.value = opt.value; el.dispatchEvent(new Event('input', {{ bubbles: true }})); el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return 'selected ' + opt.text.trim(); }})()"#,
                r = r#ref,
                val = serde_json::to_string(value).unwrap_or_default()
            ))
            .await?;
        Ok(v.as_str().unwrap_or("").to_string())
    }

    pub async fn press(&self, combo: &str) -> Result<(), String> {
        let mut parts: Vec<&str> = combo.split('+').map(|s| s.trim()).collect();
        let key = parts.pop().unwrap_or("Enter");
        let mut modifiers = 0;
        for m in parts {
            modifiers |= match m.to_ascii_lowercase().as_str() {
                "alt" => 1,
                "ctrl" | "control" => 2,
                "meta" | "win" => 4,
                "shift" => 8,
                _ => 0,
            };
        }
        let (code, vk, text) = match key.to_ascii_lowercase().as_str() {
            "enter" | "return" => ("Enter", 13, Some("\r")),
            "tab" => ("Tab", 9, None),
            "escape" | "esc" => ("Escape", 27, None),
            "backspace" => ("Backspace", 8, None),
            "delete" => ("Delete", 46, None),
            "arrowdown" | "down" => ("ArrowDown", 40, None),
            "arrowup" | "up" => ("ArrowUp", 38, None),
            "arrowleft" | "left" => ("ArrowLeft", 37, None),
            "arrowright" | "right" => ("ArrowRight", 39, None),
            "pagedown" => ("PageDown", 34, None),
            "pageup" => ("PageUp", 33, None),
            "home" => ("Home", 36, None),
            "end" => ("End", 35, None),
            "space" | " " => ("Space", 32, Some(" ")),
            k if k.len() == 1 => ("KeyX", k.to_ascii_uppercase().as_bytes()[0] as i32, None),
            _ => return Err(format!("Unknown key '{key}'")),
        };
        let key_name = if key.len() == 1 { key.to_string() } else { code.to_string() };
        let mut down = json!({ "type": "keyDown", "key": key_name, "code": code, "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk, "modifiers": modifiers });
        if let Some(t) = text {
            down["text"] = json!(t);
        }
        self.cmd("Input.dispatchKeyEvent", down).await?;
        self.cmd("Input.dispatchKeyEvent", json!({ "type": "keyUp", "key": key_name, "code": code, "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk, "modifiers": modifiers })).await?;
        Ok(())
    }

    pub async fn scroll(&self, direction: &str) -> Result<String, String> {
        let dy = match direction {
            "up" => -600,
            "top" => -1_000_000,
            "bottom" => 1_000_000,
            _ => 600,
        };
        self.eval(&format!("window.scrollBy(0, {dy}); 'ok'")).await?;
        tokio::time::sleep(Duration::from_millis(300)).await;
        let v = self.eval("Math.round(window.scrollY) + '/' + Math.round(document.documentElement.scrollHeight - window.innerHeight)").await?;
        Ok(format!("scrolled; position {}", v.as_str().unwrap_or("?")))
    }

    /// JPEG screenshot of the viewport, base64.
    pub async fn screenshot(&self) -> Result<String, String> {
        let r = self.cmd("Page.captureScreenshot", json!({ "format": "jpeg", "quality": 55 })).await?;
        r.get("data").and_then(Value::as_str).map(String::from).ok_or("no screenshot data".into())
    }

    /// Where the viewport sits on screen, physical px: (left, top, dpr).
    pub async fn viewport_origin(&self) -> Option<(f64, f64, f64)> {
        let v = self
            .eval("JSON.stringify({ x: window.screenX + (window.outerWidth - window.innerWidth) / 2, y: window.screenY + (window.outerHeight - window.innerHeight), dpr: window.devicePixelRatio })")
            .await
            .ok()?;
        let o: Value = serde_json::from_str(v.as_str()?).ok()?;
        Some((o.get("x")?.as_f64()?, o.get("y")?.as_f64()?, o.get("dpr")?.as_f64()?))
    }

    pub async fn close(mut self) {
        let _ = self.cdp.call(None, "Browser.close", json!({})).await;
        if let Some(mut c) = self.child.take() {
            tokio::time::sleep(Duration::from_millis(500)).await;
            let _ = c.kill();
        }
    }
}

/// Builds the model-facing view of the page. Kept in one place so it is easy
/// to tune what the model sees.
const READ_PAGE_JS: &str = r#"(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > -200 && r.top < innerHeight + 1200; };
  const clean = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const sel = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [contenteditable="true"], summary';
  const all = [...document.querySelectorAll(sel)].filter(vis);
  const refs = []; const lines = [];
  for (const el of all) {
    if (refs.length >= 160) break;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    let kind = tag === 'a' ? 'link' : tag === 'input' ? 'input(' + (el.type || 'text') + ')' : tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : role || tag;
    if (tag === 'input' && (el.type === 'hidden')) continue;
    let text = clean(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.title || el.alt || el.name || '');
    if (tag === 'input' && el.type !== 'submit' && el.type !== 'button') {
      const lab = el.labels && el.labels[0] ? clean(el.labels[0].innerText) : '';
      text = [lab, el.placeholder ? 'placeholder="' + clean(el.placeholder) + '"' : '', el.value ? 'value="' + clean(el.value).slice(0, 40) + '"' : ''].filter(Boolean).join(' ');
    }
    if (tag === 'select') text += ' [' + [...el.options].slice(0, 8).map(o => clean(o.text)).join(' | ') + (el.options.length > 8 ? ' | …' : '') + ']';
    if (!text && tag !== 'input' && tag !== 'textarea') continue;
    const i = refs.push(el);
    let extra = '';
    if (tag === 'a') { try { const u = new URL(el.href); extra = ' → ' + (u.host + u.pathname).slice(0, 60); } catch {} }
    if (el.checked) extra += ' [checked]';
    if (el.disabled) extra += ' [disabled]';
    lines.push('[' + i + '] ' + kind + ' "' + text.slice(0, 90) + '"' + extra);
  }
  window.__ppRefs = [null, ...refs];
  let body = clean(document.body ? document.body.innerText : '');
  if (body.length > 7000) body = body.slice(0, 7000) + ' …[more below; scroll to read on]';
  return 'URL: ' + location.href + '\nTITLE: ' + document.title + '\nSCROLL: ' + Math.round(scrollY) + '/' + Math.max(0, Math.round(document.documentElement.scrollHeight - innerHeight)) +
    '\n\nINTERACTIVE ELEMENTS (use the [n] ref):\n' + (lines.join('\n') || '(none visible)') + '\n\nPAGE TEXT:\n' + body;
})()"#;
