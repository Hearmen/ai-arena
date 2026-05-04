"""AI Arena Backend — FastAPI + Socket.IO server.

Simplified version: backend acts as a pass-through.
It receives conversation data from the extension, wraps it with a critic prompt,
and sends it directly back to the extension for auto-submission into Kimi web UI.
"""

import logging
import os
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI

from utils.websocket import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


# Critic prompt template
CRITIC_PROMPT_TEMPLATE = """你是一位批判性思维专家。用户正在与 ChatGPT 讨论一个话题。
请基于以下对话历史，提供批判性分析：

1. 指出 ChatGPT 观点中可能存在的漏洞、偏见或过度简化
2. 提出被忽略的不同视角或反方论据
3. 建议用户进一步思考的方向
4. 保持客观、理性，不要为反对而反对

对话历史：
{conversation_history}

请用中文给出你的分析，结构清晰，分点论述。"""


def build_prompt(messages: list[dict]) -> str:
    """Build the critic prompt from conversation messages."""
    conversation_lines = []
    for msg in messages:
        role_label = "用户" if msg["role"] == "user" else "ChatGPT"
        conversation_lines.append(f"{role_label}: {msg['content']}")
    conversation_history = "\n".join(conversation_lines)
    return CRITIC_PROMPT_TEMPLATE.format(conversation_history=conversation_history)


@sio.event
async def analyze_conversation(sid: str, data: dict):
    """Receive conversation data from extension, build prompt, send back for Kimi web UI."""
    try:
        logger.info("Received analyze request from %s", sid)

        messages = data.get("messages", [])
        if not messages:
            await sio.emit("analysis_error", {"error": "No messages provided"}, to=sid)
            return

        prompt = build_prompt(messages)

        # Send the complete prompt directly to the extension
        # The extension will auto-submit it into Kimi web UI
        await sio.emit("analysis_complete", {"full_text": prompt}, to=sid)
        logger.info("Prompt built and sent for %s, length: %d", sid, len(prompt))
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
