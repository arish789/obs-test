import logging
import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Configure standard Python logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [%(name)s] %(message)s'
)
logger = logging.getLogger("python-obs-test")

app = FastAPI(title="Python Observability Test Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

items_db = [
    {"id": 1, "name": "Python Item Alpha", "description": "High performance data object."},
    {"id": 2, "name": "Python Item Beta", "description": "Processed analytics payload."},
    {"id": 3, "name": "Python Item Gamma", "description": "Telemetry test node."}
]

@app.get("/api/health")
def health():
    now_iso = datetime.utcnow().isoformat()
    logger.info(f"[HEALTH] Health check executed at {now_iso}")
    return {"status": "ok", "timestamp": now_iso, "runtime": "python"}

@app.get("/api/items")
def get_items():
    logger.info(f"[ITEMS] Fetching items list, total count: {len(items_db)}")
    return items_db

@app.get("/api/items/{item_id}")
def get_item(item_id: int):
    logger.info(f"[ITEM-DETAIL] Fetching item ID: {item_id}")
    item = next((i for i in items_db if i["id"] == item_id), None)
    if not item:
        logger.warning(f"[ITEM-DETAIL] Item {item_id} not found")
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@app.get("/api/error-test")
def error_test():
    logger.error("[TEST-ERROR] Simulated error endpoint triggered for telemetry validation")
    raise HTTPException(status_code=500, detail="Simulated Python error")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"[SERVER] Starting Python server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
