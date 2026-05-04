"""AI Arena Backend — FastAPI + Socket.IO server."""

import logging
import os
from contextlib import asynccontextmanager

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI

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
    """Receive conversation data from extension, forward to Kimi API.

    Expected data format:
    {
        "messages": [
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."}
        ]
    }
    """
    try:
        logger.info(f"Received analyze request from {sid}")
        logger.info(f"Data: {data}")

        # TODO: Call Kimi API in Task 3
        # For now, echo back a test response
        await sio.emit(
            "analysis_complete",
            {"full_text": "这是测试响应。后端已收到对话数据，正在等待 Kimi API 集成。"},
            to=sid,
        )
    except Exception as e:
        logger.error(f"Error in analyze_conversation: {e}")
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
