# py_sidecar/main.py
# -*- coding: utf-8 -*-
import os
import sys
import uvicorn
import httpx
import base64
import mimetypes
import re
import json
import asyncio
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import OpenAI
from google import genai
from google.genai import types
from typing import Optional, List, Dict, Any

app = FastAPI()

# 允许 Tauri 前端进行跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tavily_api_key = os.environ.get('TAVILY_API_KEY')
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEBUGGER_URL = "http://127.0.0.1:9999/log"


class ChatRequest(BaseModel):
    model: str  # 模型名称，例如 deepseek-v4-flash, gemini-2.5-flash, qwen2:7b 等
    messages: list
    file_paths: Optional[List[str]] = []  # 接收绑定的本地绝对路径列表
    web_search: Optional[str] = "off"     # 支持三态值: "off" | "direct" | "agent"
    provider: Optional[str] = None        # 前端透传的提供商显示名
    base_url: Optional[str] = None        # 前端透传的 Base URL
    env_key_name: Optional[str] = None    # 前端透传的环境变量名


# ================= 开发者助手非阻塞广播函数 =================

async def send_debug_log(log_type: str, extra_data: dict):
    """
    非阻塞向外部 debugger.py 广播当前的框架调试状态。
    如果 debugger 未启动，优雅丢弃。
    """
    try:
        async with httpx.AsyncClient() as client:
            payload = {"type": log_type}
            payload.update(extra_data)
            await client.post(DEBUGGER_URL, json=payload, timeout=0.05)
    except Exception:
        pass


# ================= 辅助函数：根据路径转换/解析多模态与Office、代码文件 =================

def process_file_paths(file_paths: List[str]) -> tuple:
    """
    解析传入的本地文件，支持原生多模态、大文本读取及 Office 云端高质量解析
    """
    text_context = ""
    multimodal_contents = []
    llama_cloud_key = os.environ.get("LLAMA_CLOUD_API_KEY") or os.environ.get("LLAMAPARSE_API_KEY")

    for path in file_paths:
      if not os.path.exists(path):
          continue

      filename = os.path.basename(path)
      ext = os.path.splitext(path)[1].lower()

      if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.mp3', '.wav', '.ogg', '.m4a']:
          try:
              mime_type, _ = mimetypes.guess_type(path)
              # 【修复点】：优化 MIME 类型回退逻辑，确保所有支持的图片/音频格式都能正确识别
              if not mime_type:
                  if ext in ['.jpg', '.jpeg']:
                      mime_type = "image/jpeg"
                  elif ext == '.png':
                      mime_type = "image/png"
                  elif ext == '.gif':
                      mime_type = "image/gif"
                  elif ext == '.webp':
                      mime_type = "image/webp"
                  elif ext == '.bmp':
                      mime_type = "image/bmp"
                  elif ext == '.mp3':
                      mime_type = "audio/mpeg"
                  elif ext in ['.wav', '.ogg', '.m4a']:
                      mime_type = f"audio/{ext.replace('.', '')}"
                  else:
                      mime_type = "application/octet-stream"

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
                  multimodal_contents.append({
                      "type": "input_audio",
                      "input_audio": {
                          "data": file_b64,
                          "format": ext.replace('.', '')
                      }
                  })
          except Exception as e:
              text_context += f"\n\n[读取多模态文件出错 {filename}: {str(e)}]\n\n"
      else:
          try:
              if ext in ['.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.pdf'] and llama_cloud_key:
                  try:
                      from llama_parse import LlamaParse
                      parser = LlamaParse(api_key=llama_cloud_key, result_type="markdown")
                      extra_docs = parser.load_data(path)
                      parsed_text = "\n".join([doc.text for doc in extra_docs])
                      text_context += f"\n\n--- [解析文档: {filename}] ---\n{parsed_text}\n"
                  except Exception as parse_err:
                      text_context += f"\n\n[LlamaParse 解析文档失败 {filename}: {str(parse_err)}，尝试普通文本读取]\n\n"
                      with open(path, "r", encoding="utf-8", errors="ignore") as f:
                          text_context += f"\n\n--- [解析文本: {filename}] ---\n{f.read(50000)}\n"
              else:
                  with open(path, "r", encoding="utf-8", errors="ignore") as f:
                      text_context += f"\n\n--- [解析代码/文本: {filename}] ---\n{f.read(50000)}\n"
          except Exception as e:
              text_context += f"\n\n[读取文本文件出错 {filename}: {str(e)}]\n\n"

    return text_context, multimodal_contents


@app.post("/select_files")
async def select_files():
    """
    打开系统原生文件选择框并返回选中的绝对路径列表。
    这里沿用前端当前 fetch('/select_files') 的协议，不改现有业务逻辑。
    """
    try:
        import tkinter as tk
        from tkinter import filedialog

        # 创建隐藏根窗口，避免弹出多余 Tk 主窗体
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)

        file_paths = filedialog.askopenfilenames(
            title="选择要附加到对话中的文件",
            filetypes=[
                ("支持的文件", "*.txt *.md *.json *.yaml *.yml *.py *.js *.ts *.tsx *.jsx *.html *.css *.rs *.go *.java *.cpp *.c *.h *.hpp *.cs *.php *.sh *.bat *.ps1 *.sql *.xml *.csv *.jpg *.jpeg *.png *.gif *.webp *.bmp *.mp3 *.wav *.ogg *.m4a *.pdf *.doc *.docx *.xls *.xlsx *.ppt *.pptx"),
                ("所有文件", "*.*")
            ]
        )

        try:
            root.destroy()
        except Exception:
            pass

        normalized_paths = [os.path.abspath(path) for path in file_paths] if file_paths else []
        return {"file_paths": normalized_paths}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"打开文件选择框失败: {str(e)}")


@app.get("/api/ollama/status")
async def get_ollama_status():
    """检测本地 Ollama 服务是否在线"""
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(OLLAMA_BASE_URL, timeout=2.0)
            if res.status_code == 200:
                return {"status": "online", "message": "Ollama is running"}
            return {"status": "offline", "message": f"状态异常: HTTP {res.status_code}"}
    except Exception as e:
        return {"status": "offline", "message": str(e)}


@app.get("/api/ollama/tags")
async def get_ollama_tags():
    """获取本地 Ollama 已下载的模型列表"""
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
            if res.status_code == 200:
                data = res.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {"status": "success", "models": models}
            return {"status": "error", "message": f"状态异常: HTTP {res.status_code}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ================= 提供商判断与请求辅助函数 =================

def normalize_text(value: Optional[str]) -> str:
    return (value or "").strip()

def normalize_lower(value: Optional[str]) -> str:
    return normalize_text(value).lower()

def is_ollama_provider(provider: Optional[str], base_url: Optional[str]) -> bool:
    p = normalize_lower(provider)
    b = normalize_lower(base_url)

    if p == "ollama":
        return True

    if "127.0.0.1:11434" in b or "localhost:11434" in b:
        return True

    return False

def is_gemini_provider(provider: Optional[str], model: str, base_url: Optional[str]) -> bool:
    p = normalize_lower(provider)
    b = normalize_lower(base_url)
    m = normalize_lower(model)

    # Gemini 不是标准 OpenAI 兼容，因此保留专用分支
    if p == "gemini":
        return True

    if "generativelanguage.googleapis.com" in b:
        return True

    if m.startswith("gemini"):
        return True

    return False

def resolve_openai_like_base_url(base_url: Optional[str]) -> Optional[str]:
    val = normalize_text(base_url)
    if not val:
        return None
    return val.rstrip("/")

def get_api_key_from_env(env_key_name: Optional[str]) -> Optional[str]:
    env_name = normalize_text(env_key_name)
    if not env_name:
        return None
    return os.environ.get(env_name)

def sanitize_messages_for_text_only(messages: list) -> list:
    """
    某些 OpenAI 兼容后端 / 本地 Ollama 不一定支持 input_audio / image_url 混合结构，
    因此在必要时将内容折叠为纯文本。（注：Ollama 视觉模型已支持多模态，不再强制使用此函数）
    """
    formatted_messages = []
    for msg in messages:
        if isinstance(msg.get("content"), list):
            text_only = ""
            for item in msg["content"]:
                if item.get("type") == "text":
                    text_only += item.get("text", "")
            formatted_messages.append({"role": msg["role"], "content": text_only})
        else:
            formatted_messages.append({"role": msg["role"], "content": msg["content"]})
    return formatted_messages


# ================= 🚀 流式核心生成器与 LLM 客户端 =================

async def call_llm_api_stream(
    model: str,
    messages: list,
    provider: str,
    search_sources: list,
    base_url: Optional[str] = None,
    env_key_name: Optional[str] = None,
    raw_request: Optional[Request] = None
):
    """
    支持流式传输的通用 LLM 接口，逐步 yield SSE chunk 给前端
    """
    await send_debug_log("LLM_CALL_PREPARED", {
        "provider": provider,
        "model": model,
        "base_url": base_url,
        "env_key_name": env_key_name,
        "messages": messages
    })

    full_content = ""
    usage_dict = {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0}

    # ---- Gemini 流式逻辑 ----
    if is_gemini_provider(provider, model, base_url):
        api_key_val = get_api_key_from_env(env_key_name) or os.environ.get('GEMINI_API_KEY')
        if not api_key_val:
            env_name = normalize_text(env_key_name) or "GEMINI_API_KEY"
            err_msg = f"本地未检测到环境变量 {env_name}，请检查系统设置！"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"
            return

        try:
            client = genai.Client(api_key=api_key_val)
            contents = []
            system_instruction = None
            system_msgs = [m for m in messages if m["role"] == "system"]
            if system_msgs:
                system_instruction = "\n".join([m["content"] for m in system_msgs])

            for msg in messages:
                if msg["role"] == "system":
                    continue

                role_val = "user" if msg["role"] == "user" else "model"
                parts_list = []

                if isinstance(msg["content"], list):
                    for part in msg["content"]:
                        if part.get("type") == "text":
                            parts_list.append(types.Part.from_text(text=part["text"]))
                        elif part.get("type") == "image_url":
                            img_url = part["image_url"]["url"]
                            if ";base64," in img_url:
                                header, data_b64 = img_url.split(";base64,")
                                mime_type = header.split("data:")[-1]
                                parts_list.append(types.Part.from_bytes(
                                    data=base64.b64decode(data_b64),
                                    mime_type=mime_type
                                ))
                else:
                    parts_list.append(types.Part.from_text(text=msg["content"]))

                contents.append(types.Content(role=role_val, parts=parts_list))

            config = types.GenerateContentConfig(system_instruction=system_instruction) if system_instruction else None

            response_stream = client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=config
            )

            for chunk in response_stream:
                # 检测客户端是否断开
                if raw_request and await raw_request.is_disconnected():
                    break

                text_chunk = chunk.text or ""
                full_content += text_chunk

                if chunk.usage_metadata:
                    usage_dict = {
                        "total_tokens": chunk.usage_metadata.total_token_count,
                        "prompt_tokens": chunk.usage_metadata.prompt_token_count,
                        "completion_tokens": chunk.usage_metadata.candidates_token_count
                    }

                payload = {
                    "choices": [{"delta": {"content": text_chunk}}],
                    "usage": usage_dict,
                    "sources": search_sources
                }
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)

            await send_debug_log("LLM_RESPONSE_RECEIVED", {
                "provider": provider,
                "model": model,
                "content": full_content,
                "usage": usage_dict
            })

        except Exception as e:
            err_msg = f"{provider or 'Gemini'} 云端推理流式失败: {str(e)}"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"

    # ---- Ollama 本地流式逻辑 ----
    elif is_ollama_provider(provider, base_url):
        try:
            ollama_base = resolve_openai_like_base_url(base_url) or f"{OLLAMA_BASE_URL}"
            client = OpenAI(api_key="ollama", base_url=f"{ollama_base}/v1")

            # 【核心修复 1】：强制 Ollama 在流式输出的最后返回 token 统计信息
            response = client.chat.completions.create(
                model=model,
                messages=messages, 
                stream=True,
                stream_options={"include_usage": True}
            )

            for chunk in response:
                # 检测客户端是否断开，若断开则立即停止 Ollama 推理
                if raw_request and await raw_request.is_disconnected():
                    break

                # 提取 usage（可能在最后一个没有 choices 的 chunk 中）
                usage_info = getattr(chunk, "usage", None)
                if usage_info:
                    usage_dict = usage_info.model_dump() if hasattr(usage_info, "model_dump") else dict(usage_info)

                # 【核心修复 2】：如果既没有 choices 也没有 usage，才跳过。防止带有 usage 的空 choices chunk 被丢弃
                if not chunk.choices and not usage_info:
                    continue

                text_chunk = ""
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    text_chunk = getattr(delta, "content", "") or ""
                    full_content += text_chunk

                payload = {
                    "choices": [{"delta": {"content": text_chunk}}],
                    "usage": usage_dict,
                    "sources": search_sources
                }
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.002)

            await send_debug_log("LLM_RESPONSE_RECEIVED", {
                "provider": provider,
                "model": model,
                "content": full_content,
                "usage": usage_dict
            })
        except Exception as e:
            err_msg = f"{provider or 'Ollama'} 本地连接或模型加载失败: {str(e)}。请确保本地已运行 `ollama run {model}` 启动，且该模型支持视觉能力。"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"

    # ---- 通用 OpenAI 兼容第三方 API 流式逻辑 ----
    else:
        api_key_val = get_api_key_from_env(env_key_name)
        if not api_key_val:
            env_name = normalize_text(env_key_name) or "未提供环境变量名"
            err_msg = f"本地未检测到环境变量 {env_name}，请检查系统设置！"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"
            return

        final_base_url = resolve_openai_like_base_url(base_url)
        if not final_base_url:
            err_msg = "当前第三方提供商未配置有效 Base URL，请在设置页补充。"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"
            return

        try:
            client = OpenAI(api_key=api_key_val, base_url=final_base_url)

            kwargs: Dict[str, Any] = {
                "model": model,
                "messages": messages,
                "stream": True
            }

            if model == "deepseek-v4-pro":
                kwargs["reasoning_effort"] = "high"
                kwargs["extra_body"] = {"thinking": {"type": "enabled"}}

            # 【核心修复 3】：通用 OpenAI 兼容接口同样需要强制开启 stream_options 以获取 usage
            kwargs["stream_options"] = {"include_usage": True}
            response = client.chat.completions.create(**kwargs)

            for chunk in response:
                # 检测客户端是否断开，若断开则立即停止云端推理
                if raw_request and await raw_request.is_disconnected():
                    break

                # 提取 usage
                usage_info = getattr(chunk, "usage", None)
                if usage_info:
                    usage_dict = usage_info.model_dump() if hasattr(usage_info, "model_dump") else dict(usage_info)

                # 【核心修复 4】：防止带有 usage 的空 choices chunk 被丢弃
                if not chunk.choices and not usage_info:
                    continue

                text_chunk = ""
                reasoning_chunk = None
                if chunk.choices:
                    delta = chunk.choices[0].delta
                    text_chunk = getattr(delta, "content", "") or ""
                    reasoning_chunk = getattr(delta, "reasoning_content", None)
                    full_content += text_chunk

                payload = {
                    "choices": [{"delta": {"content": text_chunk, "reasoning_content": reasoning_chunk}}],
                    "usage": usage_dict,
                    "sources": search_sources
                }
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.002)

            await send_debug_log("LLM_RESPONSE_RECEIVED", {
                "provider": provider,
                "model": model,
                "base_url": final_base_url,
                "content": full_content,
                "usage": usage_dict
            })
        except Exception as e:
            err_msg = f"{provider or '第三方 OpenAI 兼容接口'} 推理流式失败: {str(e)}"
            yield f"data: {json.dumps({'error': err_msg})}\n\n"


# ================= 🚀 核心对话推理路由 =================

@app.post("/chat")
async def chat(request: ChatRequest, raw_request: Request):
    # 广播 incoming 请求给 debugger.py
    await send_debug_log("REQUEST_INCOMING", {
        "provider": request.provider,
        "model": request.model,
        "base_url": request.base_url,
        "env_key_name": request.env_key_name,
        "file_paths": request.file_paths,
        "web_search": request.web_search
    })

    provider = normalize_text(request.provider)
    base_url = normalize_text(request.base_url)
    env_key_name = normalize_text(request.env_key_name)

    if not provider:
        if is_gemini_provider(provider, request.model, base_url):
            provider = "Gemini"
        elif is_ollama_provider(provider, base_url):
            provider = "Ollama"
        else:
            provider = "OpenAI-Compatible"

    text_context, multimodal_contents = process_file_paths(request.file_paths)
    processed_messages = []

    # 【修复点】：增强健壮性，动态查找最后一个 user 消息的索引，防止因消息顺序异常导致图片丢失
    last_user_idx = -1
    for i in range(len(request.messages) - 1, -1, -1):
        if request.messages[i]["role"] == "user":
            last_user_idx = i
            break

    for i, msg in enumerate(request.messages):
        if i == last_user_idx:
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

    search_sources = []

    # 🚀 --- 联网搜索处理核心路由 ---
    if request.web_search != "off":
        if not tavily_api_key:
            warning_msg = "\n\n[注意：系统检测到未配置系统环境变量 TAVILY_API_KEY。联网搜索已失效，本次回答将基于您的已有知识解答。]\n\n"
            if isinstance(processed_messages[-1]["content"], list):
                processed_messages[-1]["content"].insert(0, {"type": "text", "text": warning_msg})
            else:
                processed_messages[-1]["content"] = warning_msg + processed_messages[-1]["content"]
        else:
            try:
                from tavily import TavilyClient
                tavily_client = TavilyClient(api_key=tavily_api_key)

                if request.web_search == "direct":
                    last_msg_content = request.messages[-1]["content"]
                    if isinstance(last_msg_content, list):
                        last_msg_content = " ".join([item["text"] for item in last_msg_content if item.get("type") == "text"])

                    await send_debug_log("TAVILY_CALL_TRIGGERED", {"query": last_msg_content})
                    response = tavily_client.search(query=last_msg_content, max_results=5)
                    results = response.get("results", [])

                    if results:
                        round_content = "--- [网络检索数据] ---\n"
                        for idx, item in enumerate(results):
                            title = item.get("title", "网页")
                            url = item.get("url", "#")
                            snippet = item.get("content", "")
                            search_sources.append({"title": title, "url": url})
                            round_content += f"[{idx+1}] 标题: {title}\n链接: {url}\n摘要: {snippet}\n\n"

                        await send_debug_log("TAVILY_CALL_COMPLETED", {
                            "round": 1,
                            "query": last_msg_content,
                            "sources": search_sources
                        })

                        search_prompt = (
                            f"\n\n[以下是为你实时单轮抓取的最新互联网客观数据。请参考这些事实回答用户，并在涉及引用处使用 Markdown 链接如 [标题](URL) 格式标注：]\n"
                            f"====================================\n"
                            f"{round_content}\n"
                            f"====================================\n"
                        )

                        if isinstance(processed_messages[-1]["content"], list):
                            processed_messages[-1]["content"].insert(0, {"type": "text", "text": search_prompt})
                        else:
                            processed_messages[-1]["content"] = search_prompt + processed_messages[-1]["content"]

                elif request.web_search == "agent":
                    agent_system_instruction = (
                        "你现在是一个具备联网搜索能力的智能调研专家。你需要自主判断并构建检索词，通过网络检索不断扩充、校准已有知识解答用户疑问。\n"
                        "【工具调用指令】\n"
                        "如果你需要获取最新信息，你必须在回答的开头输出且仅输出一行指令：\n"
                        "[SEARCH: 你的最优搜索词]\n"
                        "此指令发出后，后台会立即检索互联网并将数据返回在下一轮的 `[Observation]` 块中。如果你信息足够，可以直接为用户生成最终解答。\n"
                        "注意：在最终回答中采用 [标题](URL) 格式标准引用信源。"
                    )

                    agent_context = []
                    system_merged = False
                    for msg in processed_messages:
                        if msg["role"] == "system" and not system_merged:
                            merged_content = f"{agent_system_instruction}\n\n====================================\n助理基础设定：\n{msg['content']}"
                            agent_context.append({"role": "system", "content": merged_content})
                            system_merged = True
                        else:
                            agent_context.append(msg)
                    if not system_merged:
                        agent_context.insert(0, {"role": "system", "content": agent_system_instruction})

                    max_agent_rounds = 3

                    async def call_llm_api_sync(m_model, m_msgs, m_provider, m_base_url, m_env_key_name):
                        await send_debug_log("LLM_CALL_PREPARED", {
                            "provider": m_provider,
                            "model": m_model,
                            "base_url": m_base_url,
                            "env_key_name": m_env_key_name,
                            "messages": m_msgs
                        })
                        full_txt = ""
                        final_usage = {}
                        async for chunk_str in call_llm_api_stream(
                            m_model,
                            m_msgs,
                            m_provider,
                            [],
                            m_base_url,
                            m_env_key_name,
                            raw_request
                        ):
                            # 若客户端断开，直接中断 Agent 内部同步调用
                            if raw_request and await raw_request.is_disconnected():
                                break
                            if chunk_str.startswith("data: "):
                                try:
                                    js = json.loads(chunk_str[6:])
                                    if "error" in js:
                                        raise Exception(js["error"])
                                    full_txt += js["choices"][0]["delta"].get("content", "")
                                    final_usage = js.get("usage", final_usage)
                                except Exception:
                                    pass
                        return full_txt, final_usage

                    for agent_round in range(1, max_agent_rounds + 1):
                        # 每一轮 Agent 思考前检测是否已断开
                        if raw_request and await raw_request.is_disconnected():
                            break

                        ai_choice, current_usage = await call_llm_api_sync(
                            request.model,
                            agent_context,
                            provider,
                            base_url,
                            env_key_name
                        )
                        match = re.search(r"\[SEARCH:\s*(.*?)\]", ai_choice)
                        if match:
                            query_to_search = match.group(1).strip()
                            await send_debug_log("TAVILY_CALL_TRIGGERED", {"query": query_to_search})
                            tavily_resp = tavily_client.search(query=query_to_search, max_results=4)
                            results = tavily_resp.get("results", [])

                            round_content = ""
                            round_sources = []
                            if results:
                                round_content = f"--- [网络检索 Observation 数据 (检索词: '{query_to_search}')] ---\n"
                                for idx, item in enumerate(results):
                                    title = item.get("title", "网页")
                                    url = item.get("url", "#")
                                    snippet = item.get("content", "")
                                    if not any(s["url"] == url for s in search_sources):
                                        search_sources.append({"title": title, "url": url})
                                    round_sources.append({"title": title, "url": url})
                                    round_content += f"[{idx+1}] 标题: {title}\n链接: {url}\n摘要: {snippet}\n\n"

                            await send_debug_log("TAVILY_CALL_COMPLETED", {
                                "round": agent_round,
                                "query": query_to_search,
                                "sources": round_sources
                            })

                            agent_context.append({"role": "assistant", "content": f"[SEARCH: {query_to_search}]"})
                            agent_context.append({
                                "role": "user",
                                "content": f"[Observation (Round {agent_round})]:\n{round_content}\n请输出最终回答，或发起下一轮 `[SEARCH: 扩展搜索词]`。"
                            })
                        else:
                            async def stream_saved_response():
                                for i in range(0, len(ai_choice), 4):
                                    if raw_request and await raw_request.is_disconnected():
                                        break
                                    chunk = ai_choice[i:i+4]
                                    payload = {
                                        "choices": [{"delta": {"content": chunk}}],
                                        "usage": current_usage,
                                        "sources": search_sources
                                    }
                                    yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                                    await asyncio.sleep(0.01)
                            return StreamingResponse(stream_saved_response(), media_type="text/event-stream")

                    agent_context.append({"role": "user", "content": "您已达到检索上限，请直接基于已有事实，为用户输出最终的 Markdown 格式解答。"})
                    return StreamingResponse(
                        call_llm_api_stream(
                            request.model,
                            agent_context,
                            provider,
                            search_sources,
                            base_url,
                            env_key_name,
                            raw_request
                        ),
                        media_type="text/event-stream"
                    )

            except Exception as e:
                error_warning = f"\n\n[联网检索服务异常，已为您回退到无网解答模式: {str(e)}]\n\n"
                if isinstance(processed_messages[-1]["content"], list):
                    processed_messages[-1]["content"].insert(0, {"type": "text", "text": error_warning})
                else:
                    processed_messages[-1]["content"] = error_warning + processed_messages[-1]["content"]

    # ================= 走通用流式返回 =================
    try:
        return StreamingResponse(
            call_llm_api_stream(
                request.model,
                processed_messages,
                provider,
                search_sources,
                base_url,
                env_key_name,
                raw_request
            ),
            media_type="text/event-stream"
        )
    except Exception as e:
        await send_debug_log("ERROR_OCCURRED", {"detail": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5678)