# Cost Monitoring

- Every model turn's usage (input/output tokens) is priced with `agent.rs::price` (approximate list prices) and emitted as `usage`; the overlay accumulates `agent.spend` per day.
- Tasks window shows "$x today"; Limits & sites shows today vs cap.
- Daily cap (default $2) stops a task mid-way when exceeded; the next task will not start until the cap is raised or the day changes.
- Levers, cheapest first: digest model, lower max steps, flash/mini main model, browser off for research-only tasks, allow-list to avoid wandering.
- Local models (Ollama/custom) are priced at $0.
- Review monthly: sum `usd` across `tasks[]` history (answers carry it in the detail at completion; the log has `usage` lines removed — rely on the spend meter).
