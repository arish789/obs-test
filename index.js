const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'obs-testing-service';

app.use(cors());
app.use(express.json());

// Helper for structured JSON application logging
function log(level, message, meta = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    service: SERVICE_NAME,
    message,
    ...meta
  };
  const jsonStr = JSON.stringify(logEntry);
  switch (level.toLowerCase()) {
    case 'error':
      console.error(jsonStr);
      break;
    case 'warn':
      console.warn(jsonStr);
      break;
    case 'debug':
      console.debug(jsonStr);
      break;
    default:
      console.info(jsonStr);
      break;
  }
}

// Request logging middleware (tracks duration and logs outcome)
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const meta = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress
    };
    if (res.statusCode >= 500) {
      log('error', `HTTP ${req.method} ${req.path} failed with server error`, meta);
    } else if (res.statusCode >= 400) {
      log('warn', `HTTP ${req.method} ${req.path} client error`, meta);
    } else {
      log('info', `HTTP ${req.method} ${req.path} handled successfully`, meta);
    }
  });
  next();
});

// --- In-Memory Application State ---
const items = [
  { id: 1, name: 'Cloud Server Instance', category: 'compute', price: 49.99, stock: 15, description: 'General purpose cloud compute VM' },
  { id: 2, name: 'Managed Kubernetes Cluster', category: 'containers', price: 129.00, stock: 8, description: 'Fully managed 3-node Kubernetes cluster' },
  { id: 3, name: 'Block Storage Volume (100GB)', category: 'storage', price: 10.00, stock: 50, description: 'High IOPS NVMe persistent block volume' },
  { id: 4, name: 'Observability Log Ingestion Pack', category: 'monitoring', price: 35.50, stock: 25, description: 'Standard tier 50GB log ingestion allocation' },
  { id: 5, name: 'Application Load Balancer', category: 'networking', price: 22.00, stock: 12, description: 'Layer 7 HTTP/HTTPS load balancing service' }
];

const users = [
  { id: 1, name: 'Alice Walker', email: 'alice.walker@example.com', role: 'admin', tier: 'enterprise' },
  { id: 2, name: 'Bob Martinez', email: 'bob.martinez@example.com', role: 'developer', tier: 'pro' },
  { id: 3, name: 'Charlie Kim', email: 'charlie.kim@example.com', role: 'viewer', tier: 'starter' }
];

const orders = [
  {
    orderId: 'ORD-1001',
    customerId: 1,
    items: [{ itemId: 1, quantity: 2, unitPrice: 49.99 }],
    totalAmount: 99.98,
    status: 'completed',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

// --- 1. Health & Readiness Probes ---
app.get('/health', (req, res) => {
  log('debug', 'Health check probe executed', { uptimeSec: Math.floor(process.uptime()) });
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', (req, res) => {
  log('debug', 'Readiness check probe executed');
  res.status(200).json({
    status: 'ready',
    service: SERVICE_NAME,
    dependencies: {
      inMemoryStore: 'healthy',
      telemetryPipeline: 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// --- 2. Item Catalog Endpoints ---
app.get('/api/items', (req, res) => {
  const { category, search, limit } = req.query;
  let results = [...items];

  if (category) {
    results = results.filter(i => i.category.toLowerCase() === String(category).toLowerCase());
  }
  if (search) {
    const q = String(search).toLowerCase();
    results = results.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }
  if (limit) {
    const n = parseInt(limit, 10);
    if (!isNaN(n) && n > 0) results = results.slice(0, n);
  }

  log('info', 'Item catalog queried', { totalFound: results.length, filterCategory: category || 'all' });
  res.status(200).json({
    items: results,
    count: results.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find(i => i.id === id);

  if (!item) {
    log('warn', `Item not found with ID ${req.params.id}`, { requestedId: req.params.id });
    return res.status(404).json({
      error: 'ItemNotFound',
      message: `Item with ID ${req.params.id} does not exist in catalog`,
      requestedId: req.params.id
    });
  }

  log('info', `Item retrieved: ${item.name}`, { itemId: item.id, itemPrice: item.price });
  res.status(200).json(item);
});

// --- 3. User Endpoints ---
app.get('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const user = users.find(u => u.id === id);

  if (!user) {
    log('warn', `User not found with ID ${req.params.id}`, { requestedId: req.params.id });
    return res.status(404).json({
      error: 'UserNotFound',
      message: `User with ID ${req.params.id} not found`,
      requestedId: req.params.id
    });
  }

  log('info', `User retrieved: ${user.name}`, { userId: user.id, tier: user.tier });
  res.status(200).json(user);
});

// --- 4. Order Management (Validation & Creation) ---
app.post('/api/orders', (req, res) => {
  const { customerId, items: orderItems } = req.body;

  // Validation
  if (!customerId || !Array.isArray(orderItems) || orderItems.length === 0) {
    log('warn', 'Order creation failed: missing customerId or items array', { payload: req.body });
    return res.status(400).json({
      error: 'InvalidOrderPayload',
      message: 'Order must contain customerId and a non-empty items array',
      received: { customerId: !!customerId, itemsCount: Array.isArray(orderItems) ? orderItems.length : 0 }
    });
  }

  const customer = users.find(u => u.id === parseInt(customerId, 10));
  if (!customer) {
    log('warn', `Order creation failed: customer ID ${customerId} not found`, { customerId });
    return res.status(400).json({
      error: 'CustomerNotFound',
      message: `Customer ID ${customerId} does not exist in system`
    });
  }

  let totalAmount = 0;
  const processedItems = [];

  for (const itemReq of orderItems) {
    const catalogItem = items.find(i => i.id === parseInt(itemReq.itemId, 10));
    if (!catalogItem) {
      log('warn', `Order creation failed: item ${itemReq.itemId} not found`, { itemId: itemReq.itemId });
      return res.status(400).json({
        error: 'ItemNotFoundInCatalog',
        message: `Item ID ${itemReq.itemId} does not exist in catalog`
      });
    }

    const qty = parseInt(itemReq.quantity, 10) || 1;
    if (qty <= 0 || qty > catalogItem.stock) {
      log('warn', `Order creation failed: insufficient stock for item ${catalogItem.id}`, {
        itemId: catalogItem.id,
        requestedQty: qty,
        availableStock: catalogItem.stock
      });
      return res.status(400).json({
        error: 'InsufficientStock',
        message: `Item ${catalogItem.name} has only ${catalogItem.stock} in stock, requested ${qty}`
      });
    }

    // Deduct stock
    catalogItem.stock -= qty;
    const subtotal = Math.round(catalogItem.price * qty * 100) / 100;
    totalAmount += subtotal;
    processedItems.push({
      itemId: catalogItem.id,
      name: catalogItem.name,
      quantity: qty,
      unitPrice: catalogItem.price,
      subtotal
    });
  }

  const newOrder = {
    orderId: `ORD-${1000 + orders.length + 1}`,
    customerId: customer.id,
    customerName: customer.name,
    items: processedItems,
    totalAmount: Math.round(totalAmount * 100) / 100,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
  log('info', `Order created successfully: ${newOrder.orderId}`, {
    orderId: newOrder.orderId,
    customerId: newOrder.customerId,
    totalAmount: newOrder.totalAmount,
    itemCount: processedItems.length
  });

  res.status(201).json(newOrder);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.orderId === req.params.id);
  if (!order) {
    log('warn', `Order not found: ${req.params.id}`, { requestedOrderId: req.params.id });
    return res.status(404).json({
      error: 'OrderNotFound',
      message: `Order ${req.params.id} does not exist`
    });
  }
  log('info', `Order details retrieved: ${order.orderId}`, { orderId: order.orderId });
  res.status(200).json(order);
});

// --- 5. Simulation Endpoints (Latency, Errors, Failures) ---
app.get('/api/simulate/slow', (req, res) => {
  const requestedMs = parseInt(req.query.ms, 10);
  const delayMs = Math.min(Math.max(!isNaN(requestedMs) ? requestedMs : 800, 50), 5000);

  log('warn', `Simulating slow request with delay ${delayMs}ms`, { delayMs });

  setTimeout(() => {
    log('info', `Slow request completed after ${delayMs}ms`, { delayMs });
    res.status(200).json({
      status: 'success',
      type: 'simulated_slow_response',
      simulatedDelayMs: delayMs,
      timestamp: new Date().toISOString()
    });
  }, delayMs);
});

app.get('/api/simulate/error', (req, res) => {
  log('error', 'Simulating controlled 500 internal server error', {
    simulationType: 'server_500',
    timestamp: new Date().toISOString()
  });
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Controlled 500 error triggered for observability testing',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/simulate/client-error', (req, res) => {
  log('warn', 'Simulating controlled 400 client error', {
    simulationType: 'client_400',
    reason: 'missing_required_test_parameter'
  });
  res.status(400).json({
    error: 'BadRequest',
    message: 'Controlled 400 client error triggered for observability testing',
    timestamp: new Date().toISOString()
  });
});

// --- 6. Multi-Step Traceable Workflow (Exercises nested HTTP client calls) ---
app.get('/api/workflow/:id', async (req, res) => {
  const workflowId = `WF-${req.params.id || Date.now()}`;
  log('info', `Starting multi-step workflow ${workflowId}`, { workflowId });

  const steps = [];

  // Step 1: In-memory customer validation
  const user = users[0];
  steps.push({ step: 1, name: 'validate_user', status: 'ok', user: user.name });
  log('info', `Workflow ${workflowId} Step 1: User validated`, { workflowId, user: user.name });

  // Step 2: Internal HTTP GET call to test outgoing HTTP client instrumentation & distributed trace linking
  const internalItemPromise = new Promise((resolve, reject) => {
    const internalReq = http.get(`http://127.0.0.1:${PORT}/api/items/1`, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ status: 'raw', data });
        }
      });
    });
    internalReq.on('error', (err) => {
      log('warn', `Internal workflow HTTP call error: ${err.message}`, { workflowId });
      resolve({ fallback: true, error: err.message });
    });
    internalReq.setTimeout(2000, () => {
      internalReq.destroy();
      resolve({ timeout: true });
    });
  });

  const internalItem = await internalItemPromise;
  steps.push({ step: 2, name: 'internal_http_item_fetch', status: 'ok', item: internalItem.name || 'Cloud Server Instance' });
  log('info', `Workflow ${workflowId} Step 2: Internal HTTP item fetched`, { workflowId, itemId: 1 });

  // Step 3: Simulate workflow processing computation
  const calcStart = Date.now();
  let checksum = 0;
  for (let i = 0; i < 50000; i++) checksum = (checksum + i) % 1000;
  const computationMs = Date.now() - calcStart;
  steps.push({ step: 3, name: 'compute_risk_score', status: 'ok', score: checksum, computationMs });

  // Step 4: Finalize workflow summary
  log('info', `Workflow ${workflowId} completed successfully`, { workflowId, totalSteps: steps.length });
  res.status(200).json({
    workflowId,
    status: 'completed',
    totalSteps: steps.length,
    steps,
    completedAt: new Date().toISOString()
  });
});

// --- 7. Controlled Workload Generator ---
// Fires a bounded set of requests across all endpoints to generate complete metrics, traces, and logs.
async function executeWorkload(reqCount = 10) {
  const boundedCount = Math.min(Math.max(reqCount, 1), 30);
  const targets = [
    { method: 'GET', path: '/health', expectedStatus: 200 },
    { method: 'GET', path: '/api/items', expectedStatus: 200 },
    { method: 'GET', path: '/api/items/1', expectedStatus: 200 },
    { method: 'GET', path: '/api/items/999', expectedStatus: 404 }, // Not Found test
    { method: 'POST', path: '/api/orders', body: JSON.stringify({ customerId: 1, items: [{ itemId: 3, quantity: 1 }] }), expectedStatus: 201 }, // Valid order
    { method: 'POST', path: '/api/orders', body: JSON.stringify({ customerId: 999, items: [] }), expectedStatus: 400 }, // Invalid order
    { method: 'GET', path: '/api/simulate/slow?ms=200', expectedStatus: 200 }, // Latency test
    { method: 'GET', path: '/api/simulate/client-error', expectedStatus: 400 }, // 400 Client error
    { method: 'GET', path: '/api/simulate/error', expectedStatus: 500 }, // 500 Server error
    { method: 'GET', path: '/api/workflow/workload-run', expectedStatus: 200 } // Multi-step workflow test
  ];

  const results = [];
  const start = Date.now();

  for (let i = 0; i < boundedCount; i++) {
    const target = targets[i % targets.length];
    const reqStart = Date.now();
    try {
      const res = await new Promise((resolve, reject) => {
        const isPost = target.method === 'POST';
        const options = {
          hostname: '127.0.0.1',
          port: PORT,
          path: target.path,
          method: target.method,
          headers: isPost ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(target.body || '') } : {}
        };

        const clientReq = http.request(options, (resp) => {
          let data = '';
          resp.on('data', chunk => data += chunk);
          resp.on('end', () => resolve({ statusCode: resp.statusCode, durationMs: Date.now() - reqStart }));
        });
        clientReq.on('error', (err) => resolve({ error: err.message, durationMs: Date.now() - reqStart }));
        clientReq.setTimeout(4000, () => {
          clientReq.destroy();
          resolve({ error: 'timeout', durationMs: Date.now() - reqStart });
        });
        if (isPost && target.body) clientReq.write(target.body);
        clientReq.end();
      });

      results.push({
        index: i + 1,
        method: target.method,
        path: target.path,
        statusCode: res.statusCode || 0,
        expectedStatus: target.expectedStatus,
        durationMs: res.durationMs,
        matched: res.statusCode === target.expectedStatus
      });
    } catch (e) {
      results.push({ index: i + 1, method: target.method, path: target.path, error: e.message });
    }
  }

  const durationMs = Date.now() - start;
  const successful = results.filter(r => r.statusCode >= 200 && r.statusCode < 300).length;
  const clientErrors = results.filter(r => r.statusCode >= 400 && r.statusCode < 500).length;
  const serverErrors = results.filter(r => r.statusCode >= 500).length;

  return {
    totalRequests: results.length,
    successful,
    clientErrors,
    serverErrors,
    totalDurationMs: durationMs,
    results
  };
}

app.post('/api/workload/run', async (req, res) => {
  const count = parseInt(req.body?.count, 10) || 10;
  log('info', `Triggering controlled test workload with ${count} requests`, { count });
  const summary = await executeWorkload(count);
  log('info', 'Test workload execution completed', {
    total: summary.totalRequests,
    successful: summary.successful,
    clientErrors: summary.clientErrors,
    serverErrors: summary.serverErrors
  });
  res.status(200).json(summary);
});

app.get('/api/workload/run', async (req, res) => {
  const count = parseInt(req.query?.count, 10) || 10;
  log('info', `Triggering controlled test workload via GET with ${count} requests`, { count });
  const summary = await executeWorkload(count);
  res.status(200).json(summary);
});

// --- Server Startup & Shutdown Handlers ---
const server = app.listen(PORT, () => {
  log('info', `DevOpsArk Observability Test Application started on port ${PORT}`, {
    port: PORT,
    service: SERVICE_NAME,
    nodeVersion: process.version,
    pid: process.pid,
    env: process.env.NODE_ENV || 'development'
  });
});

process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, closing HTTP server gracefully');
  server.close(() => {
    log('info', 'HTTP server closed cleanly');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, closing HTTP server');
  server.close(() => {
    process.exit(0);
  });
});
