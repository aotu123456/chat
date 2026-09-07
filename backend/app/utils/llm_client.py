import json
from typing import Iterator, Optional

import requests

from app.config import (DASHSCOPE_API_KEY, DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL,
                        IMAGE_N, IMAGE_SIZE, IMAGE_TIMEOUT, WANX_API_BASE_URL)

# ===== DeepSeek 文本模型调用 =====


def call_llm(prompt: str, system_prompt: str = None, model: str = "deepseek-chat",
             max_tokens: int = 512, temperature: float = 0.7) -> str:
    """一次性调用 DeepSeek,返回完整回复文本"""
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": False
    }
    try:
        response = requests.post(f"{DEEPSEEK_BASE_URL}/chat/completions",
                                 headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"DeepSeek API 调用失败: {e}")
        return "[DeepSeek 生成失败]"


def stream_llm(prompt: str, system_prompt: str = None, model: str = "deepseek-chat",
               max_tokens: int = 512, temperature: float = 0.7) -> Iterator[str]:
    """流式调用 DeepSeek,逐块产出增量文本"""
    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json"
    }
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True
    }
    try:
        response = requests.post(f"{DEEPSEEK_BASE_URL}/chat/completions",
                                 headers=headers, json=payload, timeout=120, stream=True)
        response.raise_for_status()
        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue
            line = line.strip()
            if not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                chunk = json.loads(data)
                delta = chunk["choices"][0]["delta"].get("content", "")
                if delta:
                    yield delta
            except (json.JSONDecodeError, KeyError, IndexError):
                continue
    except Exception as e:
        print(f"DeepSeek 流式调用失败: {e}")
        yield "[DeepSeek 生成失败]"


# ===== 通义万相图像生成(供前端调用) =====
def generate_image(prompt: str) -> dict:
    """
    调用通义万相生成图片,返回结果字典。
    成功时: {"success": True, "url": "图片URL"}
    失败时: {"success": False, "error": "错误信息"}
    """
    headers = {
        "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "wanx-v1",
        "input": {"prompt": prompt},
        "parameters": {"size": IMAGE_SIZE, "n": IMAGE_N}
    }
    try:
        response = requests.post(WANX_API_BASE_URL, headers=headers, json=payload, timeout=IMAGE_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        image_url = data.get("output", {}).get("results", [{}])[0].get("url")
        if image_url:
            return {"success": True, "url": image_url}
        else:
            return {"success": False, "error": "API 返回无图片 URL"}
    except Exception as e:
        print(f"图像生成失败: {e}")
        return {"success": False, "error": str(e)}
