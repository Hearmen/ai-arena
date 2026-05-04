"""AI Arena Backend — FastAPI + Socket.IO server."""

import os
from contextlib import asynccontextmanager

import socketio
from dotenv import load_dotenv
from fastapi import FastAPI

from utils.websocket import manager

load_dotenv()

# Create Socket.IO async server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["chrome-extension://*", "http://localhost:*"],
)


@sio.event
async def connect(sid: str, environ: dict):
    await manager.connect(sid, environ)


@sio.event
async def disconnect(sid: str):
    await manager.disconnect(sid)


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
    print(f"Received analyze request from {sid}")
    print(f"Data: {data}")

    # TODO: Call Kimi API in Task 3
    # For now, echo back a test response
    await sio.emit(
        "analysis_complete",
        {"full_text": "这是测试响应。后端已收到对话数据，正在等待 Kimi API 集成。"},
        to=sid,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    print(f"Starting AI Arena backend on {os.getenv('HOST', '0.0.0.0')}:{os.getenv('PORT', '8000')}")
    yield
    print("Shutting down AI Arena backend")


app = FastAPI(title="AI Arena Backend", lifespan=lifespan)

# Mount Socket.IO ASGI app
socket_app = socketio.ASGIApp(sio, app)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "connections": len(manager.active_connections)}
