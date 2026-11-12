# AI System Design

Version 0.2.4 · November 2026 · Owner: vigneshcj001

One page that describes PocketPet as an AI system and checks the design
against the usual AI-system-design concerns. Each row links to the document
that holds the detail. Status: **Met** (designed, implemented and tested),
**Partial** (designed and implemented, verification or coverage incomplete),
**Gap** (not addressed yet; see §5).

## 1. System in one paragraph

PocketPet is a local desktop app with one LLM agent. The user gives an errand
by text, voice, the pet's chat bar, a recipe or a schedule. A single
tool-using loop in Rust (`agent.rs`) calls the user's chosen provider
(Anthropic Messages or any OpenAI-compatible API), runs web search, page fetch
and a real Chromium browser through CDP (`browser.rs`), and stops for a human
click at every commitment point. Safety rules are code, not prompt text. Keys
stay in the OS keychain, everything else on disk; there is no PocketPet
server and no telemetry. The pet itself (movement, care, games) uses rules,
not models.

```
 user ──task──► Tasks window ──IPC──► agent loop (Rust) ──HTTPS──► LLM provider
   ▲               ▲  approvals          │  gates · budget · loop guard
   │               └──── confirm/ask ────┤
   │                                     ├──► web_search / fetch_page (HTTP)
   └──── watches / takes over ◄──────────┴──► own Chromium profile (CDP)
                                         └──► memory.md · tasks/<id>.log
```

## 2. Key AI design decisions

| Decision | Choice | Why | Trade-off accepted |
|---|---|---|---|
| Agent topology | One ReAct-style agent; plan held in the loop (`set_plan` / `update_step`) | Errands are short and sequential; one loop is easy to gate and audit | No parallel sub-agents; long tasks are slower |
| Model access | Bring your own provider; two wire formats | Privacy, cost control, no lock-in; every requested provider fits one of the two | Quality varies by model; quirks handled per provider |
| Safety enforcement | Deterministic gates in Rust before every side effect | A prompt can be talked around; code cannot | Regex gates can miss unusual labels (mitigated by caps, allow-list, a watching user) |
| Human oversight | Blocking approval cards with per-site memory | Money, identity and messages stay human decisions | Some friction on repeat sites (user can "always allow") |
| Retrieval | Live web search + page reading; no vector index | Errands need fresh data; the web is not ours to embed | No offline knowledge; DuckDuckGo HTML is unofficial |
| Memory | Plain `memory.md` injected whole (≤ 6 000 chars) | Transparent and user-editable | Does not scale beyond a page of facts |
| Context budget | Tool result ≤ 16 000 chars; digest model above 7 000; page text ≤ 7 000; follow-ups ≤ 40 messages | Keeps cost and latency bounded on small models | Very long pages are summarised, not read in full |
| Cost control | Per-turn usage priced locally; daily cap, step cap, digest model | Predictable spend with any provider | Prices are approximate list prices |
| Data locality | Keys in the keychain; history, memory, logs on disk | No server to breach; user owns the data | No cloud sync; backups are files |

## 3. Design checklist

### 3.1 Problem and requirements

| Concern | Status | Where |
|---|---|---|
| Problem, users, goals with measurable targets | Met | [Business Requirements](../01_Product/Business_Requirements.md), [PRD](../01_Product/PRD.md) |
| Functional requirements for the AI parts | Met | [SRS §2](../02_Requirements/SRS.md), [Agent Requirements](../04_Agents/Agent_Requirements.md) |
| Non-functional: latency, cost, reliability, privacy | Met | [NFR](../02_Requirements/NFR.md) |
| Testable acceptance criteria for agent behaviour | Met | [Acceptance Criteria](../02_Requirements/Acceptance_Criteria.md) |
| When *not* to use AI | Met | Pet behaviour, scheduling, gates and narration are rules ([Agent Registry](../04_Agents/Agent_Registry.md)) |

### 3.2 Architecture

| Concern | Status | Where |
|---|---|---|
| Component view, process model, trust boundaries | Met | [System Architecture](System_Architecture.md), [Security Architecture](../09_Security/Security_Architecture.md) |
| Agent loop, state, stop conditions | Met | [Agentic Architecture](Agentic_Architecture.md), [Agent Workflows §6](../04_Agents/Agent_Workflows.md) |
| Interfaces (IPC, provider APIs, CDP, deep links) | Met | [API Architecture](API_Architecture.md) |
| Data model and retention | Met | [Data Design](Database_Design.md), [Data Privacy](../09_Security/Data_Privacy.md) |
| Failure modes and degradation | Met | [Agentic Architecture › Failure handling](Agentic_Architecture.md#failure-handling) |
| Provider failover | Gap | A failing provider ends the task; the user switches by hand (§5) |

### 3.3 Models

| Concern | Status | Where |
|---|---|---|
| Model roles (main, digest, speech) and defaults | Met | [Model Strategy](../05_AI/Model_Strategy.md) |
| Selection guidance (tool use, vision, local models) | Met | [Model Strategy](../05_AI/Model_Strategy.md) |
| Provider quirks and drift | Met | [Model Strategy › Provider quirks](../05_AI/Model_Strategy.md) |
| Model and prompt versioning | Met | [Model & Prompt Versioning](../11_Governance/Model_Prompt_Versioning.md) |

### 3.4 Prompts, context and retrieval

| Concern | Status | Where |
|---|---|---|
| System prompt structure and principles | Met | [Prompt Design](../05_AI/Prompt_Design.md) |
| Context-window budget | Met | [Prompt Design › Context budget](../05_AI/Prompt_Design.md) |
| Retrieval strategy and why no vector store | Met | [Retrieval Design](../05_AI/RAG_Design.md) |
| Grounding and citations | Met | Prompt rule + eval regexes ([Evaluation Strategy](../05_AI/Evaluation_Strategy.md)) |
| Memory design and privacy | Met | [Memory Design](../04_Agents/Memory_Design.md) |

### 3.5 Tools and agency

| Concern | Status | Where |
|---|---|---|
| Tool catalogue with schemas, side effects, gates | Met | [Tool Registry](../04_Agents/Tool_Registry.md) |
| Least privilege (no filesystem or shell tools) | Met | [Security Architecture](../09_Security/Security_Architecture.md) |
| Human-in-the-loop points and timeouts | Met | [Human in the Loop](../04_Agents/Human_In_The_Loop.md) |
| Interruptibility (pause, cancel, kill switch) | Met | [Guardrails G11](../05_AI/Guardrails.md), unit test for cancellation |

### 3.6 Safety and security

| Concern | Status | Where |
|---|---|---|
| Guardrails enforced in code with unit tests | Met | [Guardrails](../05_AI/Guardrails.md) |
| Prompt injection (direct and from web pages) | Partial | Data framing + gates; injection fixture not yet in the eval set ([AI Security](../09_Security/AI_Security.md)) |
| OWASP Top 10 for LLM applications mapped | Met | [AI Security › OWASP mapping](../09_Security/AI_Security.md) |
| Secrets never in prompts, settings, logs or backups | Met | [Data Privacy](../09_Security/Data_Privacy.md), Security test 8 |
| Supply chain: update integrity | Met | GitHub-only origin + SHA-256 digest check ([Guardrails G12](../05_AI/Guardrails.md)) |

### 3.7 Evaluation and quality

| Concern | Status | Where |
|---|---|---|
| Offline unit tests for gates, parsers, schema | Met | [Test Plan](../07_Testing/Test_Plan.md) |
| Task-level eval set with pass criteria | Partial | 6 cases today; target ~30 ([Agent Evaluation](../07_Testing/Agent_Evaluation.md)) |
| Safety eval (gate bypass count must be 0) | Met | [Security Testing](../07_Testing/Security_Testing.md) |
| Regression gate before release | Partial | Manual: eval is live and costs money, so it is not in CI |
| Online quality signals | Partial | Local only: History status, duration and approvals ([Evaluation Strategy](../05_AI/Evaluation_Strategy.md)) |

### 3.8 Operations

| Concern | Status | Where |
|---|---|---|
| Observability (audit log, crash logs, diagnostics) | Met | [Monitoring](../10_Operations/Monitoring.md), [Audit Logging](../11_Governance/Audit_Logging.md) |
| Cost monitoring and hard limits | Met | [Cost Monitoring](../10_Operations/Cost_Monitoring.md) |
| Incident response | Met | [Incident Runbook](../10_Operations/Incident_Runbook.md) |
| Deployment, rollback, environment config | Met | [CI/CD](../08_DevOps/CI_CD.md), [Rollback Plan](../08_DevOps/Rollback_Plan.md), [Environment Config](../08_DevOps/Environment_Config.md) |
| Scalability | Met (by design) | One user per install; load scales with the user's provider quota, not with PocketPet |

### 3.9 Governance and responsible AI

| Concern | Status | Where |
|---|---|---|
| Principles, roles, change control | Met | [AI Governance](../11_Governance/AI_Governance.md) |
| Transparency to the user (what the agent did and why) | Met | Live progress log, plan, approval text naming element and host, per-task log |
| User control over data and autonomy | Met | Caps, allow-list, site rules, memory editor, browser off switch |
| Disclosure and third-party data processing | Met | [AI Governance › Responsible use](../11_Governance/AI_Governance.md) |
| Accessibility of the AI features | Partial | Keyboard access and read-aloud; no screen-reader audit yet |

## 4. Quality attributes and how they are met

| Attribute | Target | Mechanism | Verified by |
|---|---|---|---|
| Safety | 0 unapproved purchases, logins, sends | Gates G1–G6, G16; purchase cap overrides approval | Unit tests; Security Testing 1–7 |
| Reliability | No silent failure | Verbatim provider errors; one non-stream retry; loop guard; panic log | Unit tests; manual |
| Cost | Research < $0.05, browser task < $0.30 | Digest model, step cap, daily cap | Spend meter; eval cost column |
| Latency | First token < 2 s; median research < 60 s | Streaming; compact page view | Eval timings |
| Privacy | No key leaves the keychain; no telemetry | Rust-only provider traffic; CSP; keys excluded from backups | Code review; Security test 8 |
| Portability | Same agent on Windows, macOS, Linux | Platform code isolated; agent and browser driver shared | CI on three OSes |

## 5. Gaps and follow-ups

| # | Gap | Impact | Proposed step |
|---|---|---|---|
| 1 | Eval set has 6 cases, no injection fixture | Regressions in browsing or injection resistance may go unnoticed | Grow `tests/eval-tasks.json` to ~30 cases incl. a hostile page; record results per release |
| 2 | Agent eval is not automated | Prompt or model changes can ship unevaluated | Offline loop test against a fake OpenAI-compatible server in CI |
| 3 | No provider failover | A provider outage stops the task | Optional fallback provider in Limits & sites, used on 5xx/429 |
| 4 | Approval replies are implied in the audit log | Harder to review who allowed what | Log the reply as its own `reply` line ([Audit Logging](../11_Governance/Audit_Logging.md)) |
| 5 | Regex gates are English-centric | Non-English checkout buttons may not be gated | Add common labels per locale; keep purchase cap and allow-list as backstops |
| 6 | Prices are hard-coded list prices | Spend estimate drifts as providers change prices | Label the spend meter "approximate"; review `price_at` each release |
| 7 | No screen-reader audit of the Tasks window | Approval cards may be hard to use without sight | Audit with NVDA / VoiceOver / Orca |

Gaps are reviewed before each release as part of [AI Governance](../11_Governance/AI_Governance.md).
