'use strict';
const { recordHttpMetrics, collectorMetricsUrl, flushOtel, obsPipelineLog } = require('./otel.js');

function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  res.on('finish', () => {
    const [sec, nanosec] = process.hrtime(start);
    const duration = sec * 1000 + nanosec / 1e6;
    recordHttpMetrics(req, res, duration);
    obsPipelineLog('HTTP response → flush OTLP', {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
      durationMs: Math.round(duration * 100) / 100
    });
    flushOtel().catch((err) => {
      obsPipelineLog('HTTP flush failed', { error: err?.message || String(err), path: req.path });
    });
  });
  next();
}

metricsMiddleware.collectorMetricsUrl = collectorMetricsUrl;

async function collectorMetricsHandler(req, res) {
  const url = collectorMetricsUrl;
  try {
    const upstream = await fetch(url);
    const body = await upstream.text();
    res.status(upstream.status);
    res.set(
      'Content-Type',
      upstream.headers.get('content-type') || 'text/plain; version=0.0.4; charset=utf-8'
    );
    res.send(body);
  } catch (err) {
    res.status(502).json({
      status: 'error',
      message: 'Failed to reach OpenTelemetry collector metrics',
      collectorMetricsUrl: url,
      error: err.message
    });
  }
}

metricsMiddleware.collectorMetricsHandler = collectorMetricsHandler;

module.exports = metricsMiddleware;
