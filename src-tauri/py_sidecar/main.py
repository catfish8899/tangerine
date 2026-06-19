# -*- coding: utf-8 -*-
import os
import sys
import uvicorn
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
from typing import Optional, List

app = FastAPI()

# 允许 Tauri 前端进行跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 获取环境变量里的 API Key
api_key = os.environ.get('DEEPSEEK_API_KEY')
OLLAMA_BASE_URL = "http://127.0.0.1:11434"

class ChatRequest(BaseModel):
    model: str  # 模型名称，例如 deepseek-v4-flash, qwen2:7b 等
    messages: list

# ================= 新增：Ollama 检测服务 =================

@app.get("/api/ollama/status")
async def get_ollama_status():
    """
    检测本地 Ollama 服务的运行状态。
    """
    async with httpx.AsyncClient() as client:
        try:
            # 访问 Ollama 根路径，如果运行中通常会返回 "Ollama is running"
            response = await client.get(OLLAMA_BASE_URL, timeout=2.0)
            if response.status_code == 200:
                return {"status": "online", "message": "Ollama 服务在线"}
            else:
                return {"status": "offline", "message": f"服务响应异常: {response.status_code}"}
        except httpx.ConnectError:
            return {"status": "offline", "message": "无法连接到本地 Ollama，请确认该服务已被打开或启动。"}
        except Exception as e:
            return {"status": "offline", "message": str(e)}


@app.get("/api/ollama/tags")
async def get_ollama_tags():
    """
    从本地 Ollama 接口拉取已下载的可用模型列表。
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3.0)
            if response.status_code == 200:
                data = response.json()
                # 提取模型名称列表
                models = [model["name"] for model in data.get("models", [])]
                return {"status": "success", "models": models}
            else:
                raise HTTPException(status_code=response.status_code, detail="无法读取本地模型列表")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"无法连接 Ollama: {str(e)}")

# ================= 兼容 Ollama / DeepSeek 的聊天请求 =================

@app.post("/chat")
async def chat(request: ChatRequest):
    # 根据模型名称判断是否走 DeepSeek 官方
    is_deepseek_model = "deepseek" in request.model.lower()

    if is_deepseek_model:
        # ---- DeepSeek 官方 API 逻辑 ----
        if not api_key:
            raise HTTPException(status_code=500, detail="本地未检测到环境变量 DEEPSEEK_API_KEY，请检查系统设置！")
        
        try:
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com"
            )
            
            # 准备请求参数
            kwargs = {
                "model": request.model,
                "messages": request.messages,
            }

            # 如果调用的是 pro 豪华版，添加深度思考参数
            if request.model == "deepseek-v4-pro":
                kwargs["reasoning_effort"] = "high"
                kwargs["extra_body"] = {"thinking": {"type": "enabled"}}

            response = client.chat.completions.create(**kwargs)
            
            # 返回 AI 的文本
            ai_content = response.choices[0].message.content
            
            # 提取并透传 Token 消耗信息给 React 前端
            usage_info = None
            if hasattr(response, "usage") and response.usage is not None:
                if hasattr(response.usage, "model_dump"):
                    usage_info = response.usage.model_dump()
                else:
                    usage_info = {
                        "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                        "completion_tokens": getattr(response.usage, "completion_tokens", 0),
                        "total_tokens": getattr(response.usage, "total_tokens", 0)
                    }
            
            return {
                "content": ai_content,
                "usage": usage_info
            }
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        # ---- Ollama 本地模型 API 逻辑 ----
        async with httpx.AsyncClient() as client:
            try:
                # 转发给本地 Ollama 服务兼容 OpenAI 的对话接口
                headers = {"Content-Type": "application/json"}
                payload = {
                    "model": request.model,
                    "messages": request.messages,
                    "stream": False # 此处采用非流式处理
                }
                
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=180.0 # 本地推理可能较慢，给予更充裕的超时阈值
                )
                
                if response.status_code == 200:
                    data = response.json()
                    ai_content = data["choices"][0]["message"]["content"]
                    usage_info = data.get("usage", None)
                    return {
                        "content": ai_content,
                        "usage": usage_info
                    }
                else:
                    raise HTTPException(status_code=response.status_code, detail=f"Ollama 返回错误: {response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ollama 本地推理失败: {str(e)}")

if __name__ == "__main__":
    # 绑定在本地 127.0.0.1:5678 端口上
    uvicorn.run(app, host="127.0.0.1", port=5678)
