# -*- coding: utf-8 -*-
import os
import sys
import uvicorn
import httpx
import base64
import mimetypes
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
    file_paths: Optional[List[str]] = []  # 接收绑定的本地绝对路径列表

# ================= 辅助函数：根据路径转换/解析多模态与Office、代码文件 =================

def process_file_paths(file_paths: List[str]) -> tuple:
    """
    解析传入的本地文件：
    1. 图片和音频转为原生多模态(通过返回对应的原生格式)
    2. 代码文件直接由 Python 本地读取
    3. Office 文件(.docx, .xlsx, .pptx, .pdf) 调用最新 LlamaCloud SDK 转换为 Markdown
    返回: (文本上下文拼接字符串, 原生多模态列表)
    """
    text_context = ""
    multimodal_contents = []

    # 兼容获取最新的 Llama Cloud Key，优先捕获系统环境变量
    llama_cloud_key = os.environ.get("LLAMA_CLOUD_API_KEY") or os.environ.get("LLAMAPARSE_API_KEY")

    for path in file_paths:
        if not os.path.exists(path):
            continue

        filename = os.path.basename(path)
        ext = os.path.splitext(path)[1].lower()

        # 1. 原生多模态处理（图片和音频）
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp3', '.wav', '.ogg', '.m4a']:
            try:
                mime_type, _ = mimetypes.guess_type(path)
                if not mime_type:
                    mime_type = "image/png" if ext in ['.png', '.jpg', '.jpeg'] else "audio/mp3"
                
                with open(path, "rb") as f:
                    file_b64 = base64.b64encode(f.read()).decode("utf-8")
                
                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
                    multimodal_contents.append({
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{file_b64}"
                        }
                    })
                else:
                    # 音频文件数据类型
                    multimodal_contents.append({
                        "type": "input_audio",
                        "input_audio": {
                            "data": file_b64,
                            "format": ext.replace('.', '')
                        }
                    })
            except Exception as e:
                text_context += f"\n\n[读取多模态文件出错 {filename}: {str(e)}]\n\n"

        # 2. Office类文件：调用最新的 LlamaCloud SDK 进行转换
        elif ext in ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.rtf', '.epub', '.mobi']:
            if not llama_cloud_key:
                text_context += f"\n\n[警告：检测到 Office 文件 {filename}，但未配置系统环境变量 LLAMA_CLOUD_API_KEY，无法解析。]\n\n"
                continue
            try:
                # 动态导入最新版统一 SDK
                from llama_cloud import LlamaCloud
                
                # 初始化客户端，手动传入读取到的密钥，避免环境变量命名不一致问题
                client = LlamaCloud(api_key=llama_cloud_key)
                
                # 创建上传任务，指定用途为解析
                with open(path, "rb") as f:
                    uploaded_file = client.files.create(file=f, purpose="parse")
                
                # 启动解析，设置 tier 为 agentic (高表现力智能版)
                # 移除不支持的 'language' 关键字参数，让云端自适应最强大的多语言混合 OCR 纠错
                result = client.parsing.parse(
                    file_id=uploaded_file.id,
                    tier="agentic",
                    version="latest",
                    expand=["markdown"]
                )
                
                # 从解析结果的每一页中提取 Markdown 文本并合并
                pages_markdown = []
                if result.markdown and hasattr(result.markdown, "pages"):
                    for page in result.markdown.pages:
                        pages_markdown.append(page.markdown)
                
                parsed_md = "\n\n".join(pages_markdown)
                text_context += f"\n\n[以下是 Office 文件 `{filename}` 的解析内容]\n---\n{parsed_md}\n---\n"
            except Exception as e:
                text_context += f"\n\n[LlamaCloud 解析 Office 文件 {filename} 失败: {str(e)}]\n\n"

        # 3. 其他文件默认为文本或代码文件：直接本地纯文本读取
        else:
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                lang = ext.replace('.', '') if ext else 'text'
                text_context += f"\n\n[已加载代码/文本文件: `{filename}`]\n```{lang}\n{content}\n```\n"
            except Exception as e:
                text_context += f"\n\n[读取文件 {filename} 失败: {str(e)}]\n\n"

    return text_context.strip(), multimodal_contents

# ================= 新增：Python 底层 Tkinter 极简原生文件选择对话框 =================

@app.post("/api/select-files")
async def select_files():
    """
    拉起 Windows 原生文件选择对话框（支持多选）
    """
    import tkinter as tk
    from tkinter import filedialog
    
    # 初始化一个隐藏的 tk 实例，只用来调起文件对话框
    root = tk.Tk()
    root.withdraw()
    # 保持置顶，避免弹窗被主界面盖住
    root.attributes('-topmost', True)
    
    # 弹出原生多文件选择对话框
    files = filedialog.askopenfilenames(
        title="选择对话附件",
        filetypes=[
            ("所有文件", "*.*"),
            ("文档/Office", "*.pdf;*.docx;*.doc;*.xlsx;*.xls;*.pptx;*.ppt;*.txt"),
            ("图片文件", "*.jpg;*.jpeg;*.png;*.gif;*.webp;*.bmp"),
            ("音频文件", "*.mp3;*.wav;*.ogg;*.m4a"),
            ("代码文件", "*.py;*.js;*.ts;*.tsx;*.rs;*.go;*.cpp;*.c;*.html;*.css;*.json;*.yaml")
        ]
    )
    
    root.destroy() # 彻底销毁 tk 实例以释放内存
    
    if files:
        return {"status": "success", "files": list(files)}
    return {"status": "success", "files": []}

# ================= 新增：Ollama 检测服务 =================

@app.get("/api/ollama/status")
async def get_ollama_status():
    """
    检测本地 Ollama 服务的运行状态。
    """
    async with httpx.AsyncClient() as client:
        try:
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

    # 处理输入文件
    text_context, multimodal_contents = process_file_paths(request.file_paths)

    # 准备标准的对话上下文
    processed_messages = []
    
    for i, msg in enumerate(request.messages):
        if i == len(request.messages) - 1 and msg["role"] == "user":
            user_text = msg["content"]
            if text_context:
                user_text = f"{text_context}\n\n请结合以上文档/代码内容，回答用户的问题：{user_text}"
            
            if multimodal_contents:
                content_payload = [{"type": "text", "text": user_text}] + multimodal_contents
                processed_messages.append({
                    "role": "user",
                    "content": content_payload
                })
            else:
                processed_messages.append({
                    "role": "user",
                    "content": user_text
                })
        else:
            processed_messages.append(msg)

    if is_deepseek_model:
        # ---- DeepSeek 官方 API 逻辑 ----
        if not api_key:
            raise HTTPException(status_code=500, detail="本地未检测到环境变量 DEEPSEEK_API_KEY，请检查系统设置！")
        
        try:
            client = OpenAI(
                api_key=api_key,
                base_url="https://api.deepseek.com"
            )
            
            kwargs = {
                "model": request.model,
                "messages": processed_messages,
            }

            if request.model == "deepseek-v4-pro":
                kwargs["reasoning_effort"] = "high"
                kwargs["extra_body"] = {"thinking": {"type": "enabled"}}

            response = client.chat.completions.create(**kwargs)
            ai_content = response.choices[0].message.content
            
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
                headers = {"Content-Type": "application/json"}
                payload = {
                    "model": request.model,
                    "messages": processed_messages,
                    "stream": False
                }
                
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=180.0
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
    uvicorn.run(app, host="127.0.0.1", port=5678)
