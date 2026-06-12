# -*- coding: utf-8 -*-
import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

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

class ChatRequest(BaseModel):
    model: str  # deepseek-v4-flash 或 deepseek-v4-pro
    messages: list

@app.post("/chat")
async def chat(request: ChatRequest):
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
        return {"content": ai_content}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # 绑定在本地 127.0.0.1:5678 端口上
    uvicorn.run(app, host="127.0.0.1", port=5678)
