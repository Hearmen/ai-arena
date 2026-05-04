"""AI Arena Backend — FastAPI + Socket.IO server."""

import logging
import os
from contextlib import asynccontextmanager

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI

from api.kimi import stream_kimi_analysis
from utils.websocket import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Create Socket.IO async server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["chrome-extension://*", "http://localhost:*"],
)


@sio.event
async def connect(sid: str, environ: dict):
    manager.connect(sid, environ)


@sio.event
async def disconnect(sid: str):
    manager.disconnect(sid)


@sio.event
async def analyze_conversation(sid: str, data: dict):
    """Receive conversation data from extension, call Kimi API, stream results back."""
    try:
        logger.info("Received analyze request from %s", sid)

        messages = data.get("messages", [])
        if not messages:
            await sio.emit("analysis_error", {"error": "No messages provided"}, to=sid)
            return

        chunks = []
        async for chunk in stream_kimi_analysis(messages):
            chunks.append(chunk)
            await sio.emit("analysis_chunk", {"chunk": chunk}, to=sid)

        full_text = "".join(chunks)

        await sio.emit("analysis_complete", {"full_text": full_text}, to=sid)
        logger.info("Analysis complete for %s, length: %d", sid, len(full_text))
    except Exception as e:
        logger.error("Error in analyze_conversation: %s", e)
        await sio.emit("analysis_error", {"error": str(e)}, to=sid)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    logger.info(f"Starting AI Arena backend on {os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8000')}")
    yield
    logger.info("Shutting down AI Arena backend")


app = FastAPI(title="AI Arena Backend", lifespan=lifespan)

# Mount Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "connections": len(manager.active_connections)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        socket_app,
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
    )
