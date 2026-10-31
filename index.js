const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// In-memory sample data
const items = [
  { id: 1, name: 'Item One', description: 'The first example item.' },
  { id: 2, name: 'Item Two', description: 'Another example item in the list.' },
  { id: 3, name: 'Item Three', description: 'A third item to demonstrate listing.' }
];

app.get('/api/health', (req, res) => {
  console.log('[HEALTH] Health check probe requested at:', new Date().toISOString());
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/items', (req, res) => {
  console.log('[ITEMS] data fetch - fetching all items, count:', items.length);
  console.info('[ITEMS] Successfully retrieved items list');
  res.json(items);
});

app.get('/api/items/:id', (req, res) => {
  console.log('[ITEM-DETAIL] Fetching item by ID:', req.params.id);
  const item = items.find(i => i.id === parseInt(req.params.id, 10));
  if (!item) {
    console.warn('[ITEM-DETAIL] Item not found for ID:', req.params.id);
    return res.status(404).json({ error: 'Item not found' });
  }
  console.info('[ITEM-DETAIL] Found item:', item.name);
  res.json(item);
});

app.get('/api/error-test', (req, res) => {
  console.error('[TEST-ERROR] Simulated error logged for observability testing');
  res.status(500).json({ error: 'Simulated test error' });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Small test app listening on http://localhost:${PORT}`);
});
