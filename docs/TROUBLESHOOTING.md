# Troubleshooting
| Symptom | Check |
|---|---|
| "backend unreachable" badge | `/readyz` of the frontend; `API_BASE_URL`; backend logs; Render cold start (30–60 s on free tier) |
| Buttons greyed out | status-dependent: completed heats cannot run; paused heats need *Resume*; Viewer role cannot act |
| 403 toast | role too low — switch demo role (Operator/Metallurgist/ProcessEngineer) |
| 409 toast "paused" | the simulation clock is frozen — press *Resume* |
| 412 toast | another user changed the scenario (ETag) — reload |
| 422 toast | input outside physical bounds or schedule invalid — see Validate inputs |
| Optimizer slow | 1–3 min per request on 1 CPU; it runs as a background job (progress bar) |
| 3D black/blank | WebGL disabled → 2D schematic fallback; enable hardware acceleration |
| Charts empty | no simulation selected → *New heat* or choose one in the selector |
| SSE "reconnecting" | normal on network hiccups; the stream resumes with Last-Event-ID |
