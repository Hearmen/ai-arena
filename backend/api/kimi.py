"""Kimi (Moonshot) API client."""

import os
from typing import AsyncGenerator

import httpx

KIMI_API_KEY = os.getenv("KIMI_API_KEY", "")
KIMI_API_BASE = os.getenv("KIMI_API_BASE", "https://api.moonshot.cn/v1")
KIMI_MODEL = os.getenv("KIMI_MODEL", "moonshot-v1-8k")


def build_critic_prompt(messages: list[dict]) -> str:
    """Build the critic prompt from conversation messages."""
    conversation_lines = []
    for msg in messages:
        role_label = "用户" if msg["role"] == "user" else "ChatGPT"
        conversation_lines.append(f"{role_label}: {msg['content']}")

    conversation_history = "\n".join(conversation_lines)

    prompt_path = os.path.join(os.path.dirname(__file__), "..", "prompts", "critic.txt")
    with open(prompt_path, "r", encoding="utf-8") as f:
        template = f.read()

    return template.format(conversation_history=conversation_history)


async def stream_kimi_analysis(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream analysis from Kimi API.

    Yields text chunks as they arrive from the API.
    """
    if not KIMI_API_KEY:
        yield "错误：未配置 KIMI_API_KEY。请在 backend/.env 中设置。"
        return

    prompt = build_critic_prompt(messages)

    headers = {
        "Authorization": f"Bearer {KIMI_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": KIMI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            async with client.stream(
                "POST",
                f"{KIMI_API_BASE}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue

                    data = line[6:]  # Remove "data: " prefix
                    if data == "[DONE]":
                        break

                    import json

                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0]["delta"]
                        if "content" in delta:
                            yield delta["content"]
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

        except httpx.HTTPStatusError as e:
            yield f"\n\n错误：Kimi API 请求失败 ({e.response.status_code})。请检查 API Key 是否正确。"
        except httpx.RequestError as e:
            yield f"\n\n错误：无法连接到 Kimi API。{str(e)}"
