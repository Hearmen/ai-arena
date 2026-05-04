"""Integration test for AI Arena backend."""

import asyncio

import pytest
import socketio


BASE_URL = "http://localhost:8000"


@pytest.mark.asyncio
async def test_websocket_connection():
    """Test WebSocket connection to backend."""
    client = socketio.AsyncClient()
    await client.connect(BASE_URL)
    assert client.connected
    await client.disconnect()


@pytest.mark.asyncio
async def test_analyze_conversation():
    """Test analyze_conversation event flow."""
    client = socketio.AsyncClient()

    received_chunks = []
    received_complete = []

    @client.on("analysis_chunk")
    async def on_chunk(data):
        received_chunks.append(data["chunk"])

    @client.on("analysis_complete")
    async def on_complete(data):
        received_complete.append(data["full_text"])
        await client.disconnect()

    await client.connect(BASE_URL)

    await client.emit("analyze_conversation", {
        "messages": [
            {"role": "user", "content": "什么是人工智能？"},
            {"role": "assistant", "content": "人工智能是模拟人类智能的技术。"},
        ]
    })

    # Wait for response (with timeout)
    await asyncio.wait_for(client.wait(), timeout=30)

    assert len(received_complete) == 1
    assert len(received_complete[0]) > 0
    assert client.connected is False
