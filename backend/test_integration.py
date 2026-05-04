"""Simple integration test for the backend."""

import asyncio

import socketio


async def test_websocket():
    """Test WebSocket connection and analyze flow."""
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

    try:
        await client.connect("http://localhost:8000")
        print("Connected to backend")

        await client.emit("analyze_conversation", {
            "messages": [
                {"role": "user", "content": "什么是人工智能？"},
                {"role": "assistant", "content": "人工智能是模拟人类智能的技术。"},
            ]
        })

        # Wait for response (with timeout)
        await asyncio.wait_for(client.wait(), timeout=30)

        print(f"Received {len(received_chunks)} chunks")
        print(f"Complete text length: {len(received_complete[0]) if received_complete else 0}")
        print("Integration test PASSED" if received_complete else "Integration test FAILED")

    except Exception as e:
        print(f"Test failed: {e}")
    finally:
        if client.connected:
            await client.disconnect()


if __name__ == "__main__":
    asyncio.run(test_websocket())
