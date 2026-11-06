# DevOpsArk observability

DevOpsArk added this folder only. **Your `index.js` (and other app files) were not modified.** Follow the steps below to wire observability.

## Injected files

| File | Purpose |
|------|---------|
| `logger.js` | Winston → OTLP logs (use instead of `console.log`) |
| `otel.js` | OpenTelemetry SDK → collector (logs, traces, metrics) |
| `metricsMiddleware.js` | Express HTTP metrics middleware |

## Step 1 — Environment

1. Copy repo root `.env.observability.example` → `.env`
2. Set `OTEL_EXPORTER_OTLP_ENDPOINT` (OTLP base URL, no `/metrics` suffix)
3. Set `OTEL_COLLECTOR_METRICS_URL` (collector Prometheus scrape URL)
4. `OTEL_SERVICE_NAME` must match your DevOpsArk observability integration (full `arkrn:...` id)

## Step 2 — Wire your app entry (`index.js`)

Edit **`index.js`** yourself (CommonJS example matches detected module type: **cjs**).

```javascript
require('dotenv').config();

const logger = require('./Devopsark-d5c2586eed86/logger.js');
const metricsMiddleware = require('./Devopsark-d5c2586eed86/metricsMiddleware.js');

async function main() {
  await logger.whenReady();
  const express = require('express');
  const cors = require('cors');

  const app = express();
  const PORT = process.env.PORT || 5001;

  app.use(cors());
  app.use(express.json());
  app.use(metricsMiddleware);

  app.get('/api/health', (req, res) => {
    logger.info('Health check');
    res.json({ status: 'ok' });
  });

  app.get('/api/otel-status', (req, res) => {
    res.json(logger.getOtelStatus ? logger.getOtelStatus() : { ready: false });
  });

  app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start:', err.message || err);
  process.exit(1);
});
```

### Rules

1. **CommonJS:** wrap startup in `async function main() { ... }` and call `main().catch(...)` — **never** use top-level `await` with `require()` (Node error: `ERR_AMBIGUOUS_MODULE_SYNTAX`).
2. **Load OTEL before Express** — `await logger.whenReady()` then `require('express')` / `import('express')` so HTTP traces are captured.
3. **`app.use(metricsMiddleware)`** after body parser (`express.json()`).
4. Use **`logger.info` / `logger.warn` / `logger.error`** — not `console.log`. Do not call `logger.log('message')` (Winston needs a level: use `logger.info`).
5. Optional: **`GET /api/otel-status`** → `logger.getOtelStatus()` to verify OTLP endpoints.
6. Restart the app after changes.

## Step 3 — Verify

1. Hit `/api/health` (or your routes).
2. Check `GET /api/otel-status` — `ready: true`, correct `otlpEndpoint` and `serviceName`.
3. In DevOpsArk UI → Observability → Logs / Traces / Metrics.

## Pipeline debug

App (export to collector):

```bash
DEVOPSARK_OBSERVABILITY_DEBUG=true
```

Logs: `[Observability Pipeline][1-App Export]`

GraphQL (OpenSearch fetch):

```bash
OBSERVABILITY_DEBUG=true
```

Logs: `[Observability Pipeline][4-GraphQL Fetch/...]`

## More detail

See repo root `OBSERVABILITY_SETUP.md` for a short pointer to this file.
