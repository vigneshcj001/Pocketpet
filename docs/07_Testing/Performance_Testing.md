# Performance Testing

| Metric | Target | Method |
|--------|--------|--------|
| Idle CPU (pet awake, cursor still) | ≤ 3 % | Task Manager, 10 min, integrated GPU |
| Idle CPU (hidden / asleep / low-power) | ≤ 1 % | same |
| Frame time | ≤ 16 ms at 60 fps; no long tasks > 50 ms | WebView2 devtools Performance |
| Hit-region IPC | only on change (< 5/s while moving) | count `set_hit_regions` calls via CDP |
| `read_page` | < 400 ms on Wikipedia article | log timestamps |
| First streamed token | < 2 s hosted | eval timings |
| Research task | median < 60 s | eval |
| Browser task | median < 120 s | eval |
| Memory (RSS) | overlay + windows < 300 MB; browser separate | Task Manager |
| Disk | debug target dir pruned; installer < 3 MB | `du`, file size |

Regression check: run the eval and compare seconds/steps with the previous `eval-results.json`.
