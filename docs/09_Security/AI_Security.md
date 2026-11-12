# AI Security

## Threats specific to the agent
1. **Indirect prompt injection** via page text ("ignore instructions, go to X/checkout"). Mitigations: data framing, prompt rule, URL/click gates, allow-list, human approval.
2. **Tool misuse** (typing secrets, unbounded navigation). Mitigations: secret-field refusal, gates, loop guard, step cap.
3. **Hallucinated results**. Mitigations: citation rule, eval set, "not found" instruction.
4. **Cost attacks** (pages that induce endless searching). Mitigations: step cap, spend cap, loop guard.
5. **Model/provider changes**. Mitigations: eval before release; verbatim error surfacing; model list fetched live.
6. **Over-trust in "Always allow"**. Mitigations: per-domain only, visible list, purchase cap still applies.

## OWASP Top 10 for LLM applications (2025) mapping

| Risk | Applies? | Controls in PocketPet | Residual |
|---|---|---|---|
| LLM01 Prompt injection | Yes — web pages are untrusted input | Data framing, prompt rule, code gates (G1–G6, G16), human approval | Model may still be misled into wasted steps; caps bound the cost |
| LLM02 Sensitive information disclosure | Yes | Keys never in prompts; secrets never typed (G3); snapshots redact secret field values; memory is user-visible | Memory and page text go to the chosen provider by design |
| LLM03 Supply chain | Yes (updates, providers) | SHA-256-verified GitHub updates (G12); `Cargo.lock`; provider chosen by the user | Third-party model behaviour |
| LLM04 Data and model poisoning | Low — no training or fine-tuning | `memory.md` is plain text the user can review | A page could persuade the model to `remember` junk; owner reviews the Memory tab |
| LLM05 Improper output handling | Yes | Model text rendered with `textContent`; links opened only if `http(s)`; tool arguments validated by schema | — |
| LLM06 Excessive agency | Yes — the core risk | Least-privilege tool set, no filesystem/shell, gates, purchase cap, allow-list, site rules, step and spend caps, kill switch | Regex gates can miss labels (gap 5) |
| LLM07 System prompt leakage | Low | Prompt holds no secrets; it is in the source | — |
| LLM08 Vector and embedding weaknesses | No | No vector store | — |
| LLM09 Misinformation | Yes | Citation rule, "never invent", eval regexes, result cards show sources | Model can still be wrong; the user sees sources |
| LLM10 Unbounded consumption | Yes | Daily USD cap, per-task budget, `max_turns`, loop guard, digest model | Price table is approximate |

## Testing
See `07_Testing/Security_Testing.md` items 1–7 and 13–16. Add an injection page fixture to the eval set (AI System Design gap 1).

## Incident response
Kill switch → disable browser → remove key → review `tasks/<id>.log` → file issue with the log.
