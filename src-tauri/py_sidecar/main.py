# -*- coding: utf-8 -*-
import os
import sys
import uvicorn
import httpx
import base64
import mimetypes
import re
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI
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

# 获取环境变量里的 API Key
api_key = os.environ.get('DEEPSEEK_API_KEY')
tavily_api_key = os.environ.get('TAVILY_API_KEY')
OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEBUGGER_URL = "http://127.0.0.1:9999/log"

class ChatRequest(BaseModel):
    model: str  # 模型名称，例如 deepseek-v4-flash, qwen2:7b 等
    messages: list
    file_paths: Optional[List[str]] = []  # 接收绑定的本地绝对路径列表
    web_search: Optional[str] = "off"     # 支持三态值: "off" | "direct" | "agent"

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
                    multimodal_contents.append({
                        "type": "input_audio",
                        "input_audio": {
                            "data": file_b64,
                            "format": ext.replace('.', '')
                        }
                    })
            except Exception as e:
                text_context += f"\n\n[读取多模态文件出错 {filename}: {str(e)}]\n\n"

        elif ext in ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.rtf', '.epub', '.mobi']:
            if not llama_cloud_key:
                text_context += f"\n\n[警告：检测到 Office 文件 {filename}，但未配置系统环境变量 LLAMA_CLOUD_API_KEY，无法解析。]\n\n"
                continue
            try:
                from llama_cloud import LlamaCloud
                client = LlamaCloud(api_key=llama_cloud_key)
                
                with open(path, "rb") as f:
                    uploaded_file = client.files.create(file=f, purpose="parse")
                
                result = client.parsing.parse(
                    file_id=uploaded_file.id,
                    tier="agentic",
                    version="latest",
                    expand=["markdown"]
                )
                
                pages_markdown = []
                if result.markdown and hasattr(result.markdown, "pages"):
                    for page in result.markdown.pages:
                        pages_markdown.append(page.markdown)
                
                parsed_md = "\n\n".join(pages_markdown)
                text_context += f"\n\n[以下是 Office 文件 `{filename}` 的解析内容]\n---\n{parsed_md}\n---\n"
            except Exception as e:
                text_context += f"\n\n[LlamaCloud 解析 Office 文件 {filename} 失败: {str(e)}]\n\n"

        else:
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                lang = ext.replace('.', '') if ext else 'text'
                text_context += f"\n\n[已加载代码/文本文件: `{filename}`]\n```{lang}\n{content}\n```\n"
            except Exception as e:
                text_context += f"\n\n[读取文件 {filename} 失败: {str(e)}]\n\n"

    return text_context.strip(), multimodal_contents

# ================= Tkinter Windows 原生多文件选择器 =================

@app.post("/api/select-files")
async def select_files():
    import tkinter as tk
    from tkinter import filedialog
    
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    
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
    root.destroy()
    
    if files:
        return {"status": "success", "files": list(files)}
    return {"status": "success", "files": []}

# ================= Ollama 检测服务 =================

@app.get("/api/ollama/status")
async def get_ollama_status():
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(OLLAMA_BASE_URL, timeout=2.0)
            if response.status_code == 200:
                return {"status": "online", "message": "Ollama 服务在线"}
            else:
                return {"status": "offline", "message": f"服务响应异常: {response.status_code}"}
        except httpx.ConnectError:
            return {"status": "offline", "message": "无法连接到本地 Ollama"}
        except Exception as e:
            return {"status": "offline", "message": str(e)}

@app.get("/api/ollama/tags")
async def get_ollama_tags():
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

# ================= Ollama/OpenAI 兼容型单次会话底层调用器 =================

async def call_llm_api(model: str, messages: list, is_deepseek_model: bool) -> tuple:
    """
    统一底层大模型接口，并在调用前后向控制台调试器广播【发送完整上下文】与【大模型返回响应】。
    """
    # 🌟 1. 投递大模型即将被灌入的全部历史上下文
    await send_debug_log("LLM_CALL_PREPARED", {"messages": messages})

    if is_deepseek_model:
        if not api_key:
            raise HTTPException(status_code=500, detail="本地未检测到环境变量 DEEPSEEK_API_KEY，请检查系统设置！")
        try:
            client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
            kwargs = {
                "model": model,
                "messages": messages,
            }
            if model == "deepseek-v4-pro":
                kwargs["reasoning_effort"] = "high"
                kwargs["extra_body"] = {"thinking": {"type": "enabled"}}

            response = client.chat.completions.create(**kwargs)
            ai_content = response.choices[0].message.content or ""
            usage_info = getattr(response, "usage", None)
            usage_dict = usage_info.model_dump() if usage_info and hasattr(usage_info, "model_dump") else {}

            # 🌟 2. 投递返回的原生响应
            await send_debug_log("LLM_RESPONSE_RECEIVED", {
                "content": ai_content,
                "usage": usage_dict
            })
            return ai_content, usage_dict
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"DeepSeek 云端推理失败: {str(e)}")
    else:
        # ---- Ollama 本地调用逻辑 ----
        async with httpx.AsyncClient() as client:
            try:
                headers = {"Content-Type": "application/json"}
                payload = {
                    "model": model,
                    "messages": messages,
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
                    ai_content = data["choices"][0]["message"]["content"] or ""
                    usage_info = data.get("usage", {})

                    # 🌟 2. 投递返回的原生响应
                    await send_debug_log("LLM_RESPONSE_RECEIVED", {
                        "content": ai_content,
                        "usage": usage_info
                    })
                    return ai_content, usage_info
                else:
                    raise HTTPException(status_code=response.status_code, detail=f"Ollama 返回错误: {response.text}")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ollama 本地推理失败: {str(e)}")

# ================= 🚀 核心对话推理路由 =================

@app.post("/chat")
async def chat(request: ChatRequest):
    # 广播 incoming 请求给 debugger.py 
    await send_debug_log("REQUEST_INCOMING", {
        "model": request.model,
        "file_paths": request.file_paths,
        "web_search": request.web_search
    })

    is_deepseek_model = "deepseek" in request.model.lower()
    text_context, multimodal_contents = process_file_paths(request.file_paths)

    processed_messages = []
    
    # 构造标准的 [User-AI] 历史对话交互链
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

    search_sources = []
    
    # 🚀 --- 联网搜索处理核心路由 ---
    if request.web_search != "off":
        if not tavily_api_key:
            # 优雅容错
            warning_msg = "\n\n[注意：系统检测到未配置系统环境变量 TAVILY_API_KEY。联网搜索已失效，本次回答将基于您的已有知识解答。]\n\n"
            if isinstance(processed_messages[-1]["content"], list):
                processed_messages[-1]["content"].insert(0, {"type": "text", "text": warning_msg})
            else:
                processed_messages[-1]["content"] = warning_msg + processed_messages[-1]["content"]
        else:
            try:
                from tavily import TavilyClient
                tavily_client = TavilyClient(api_key=tavily_api_key)

                # ----------------- 模式 A：直接单轮快速检索 (省 Token & 极速响应) -----------------
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

                # ----------------- 模式 B：模型自主 3 轮检索 (云端/本地完全通用释放) -----------------
                elif request.web_search == "agent":
                    # 1. 声明自主检索 ReAct 系统提示词
                    agent_system_instruction = (
                        "你现在是一个具备联网搜索能力的智能调研专家。你需要自主判断并构建检索词，通过网络检索不断扩充、校准已有知识解答用户疑问。\n"
                        "【工具调用指令】\n"
                        "如果你需要获取最新信息（例如最新新闻、版本、详细配置或不确定事实），你必须在回答的开头输出且仅输出一行指令：\n"
                        "[SEARCH: 你的最优搜索词]\n"
                        "此指令发出后，后台会立即检索互联网并将数据返回在下一轮的 `[Observation]` 块中。你可以分析此数据并决定再次发出新的 `[SEARCH: 搜索词]` 扩展细节，或者如果信息足够，可以直接为用户生成最终解答。\n"
                        "注意：\n"
                        "1. 每次仅能输出一行 [SEARCH: 搜索词]，请不要一次发出多个 SEARCH 指令。\n"
                        "2. 一旦你输出最终答案，切记不得再包含 [SEARCH: ] 指令，并在最终回答中采用 [标题](URL) 格式标准引用信源。"
                    )

                    # 2. 规范组装对话上下文：合并连续 System
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
                    ai_content = ""
                    usage_dict = {}

                    # 开始多轮 ReAct 思维循环
                    for agent_round in range(1, max_agent_rounds + 1):
                        # 🌟 3. 调用合并好的通用推理接口。
                        # 它会在触发 LLM 推理的那一秒，在控制台中准确打印出【当时模型收到的全部上下文】，调试时序完美！
                        ai_choice, current_usage = await call_llm_api(request.model, agent_context, is_deepseek_model)
                        usage_dict = current_usage
                        
                        # 检测 AI 产生的生鲜 Output 中，是否输出了 [SEARCH: ] 指令
                        match = re.search(r"\[SEARCH:\s*(.*?)\]", ai_choice)
                        if match:
                            query_to_search = match.group(1).strip()
                            
                            # 模型确实决定搜索。触发 Tavily 调用并广播
                            await send_debug_log("TAVILY_CALL_TRIGGERED", {"query": query_to_search})

                            # 调用 Tavily 获取该轮次的检索信息
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

                            # 追加思维链和 Observation 事实背景，循环
                            agent_context.append({"role": "assistant", "content": f"[SEARCH: {query_to_search}]"})
                            agent_context.append({
                                "role": "user",
                                "content": f"[Observation (Round {agent_round})]:\n{round_content}\n以上是为您最新检索的事实背景，请仔细核对，如果事实足够请直接输出给用户的最终回答（回答中不得再带有 [SEARCH: ] ），如果事实依旧不够或者某些部分仍存疑，请发出下一轮 `[SEARCH: 扩展搜索词]` 检索新细节。"
                            })
                        else:
                            # 模型没有输出 [SEARCH: ]，说明事实已经足够。直接打破循环
                            ai_content = ai_choice
                            break
                    
                    # 达到上限时的防死循环防御
                    if match and agent_round == max_agent_rounds:
                        agent_context.append({"role": "user", "content": "您已达到检索上限（3轮），请直接结合已有的事实背景，为用户梳理、生成最完美的最终大Markdown解答。"})
                        ai_content, final_usage = await call_llm_api(request.model, agent_context, is_deepseek_model)
                        usage_dict = final_usage

                    return {
                        "content": ai_content,
                        "usage": usage_dict,
                        "sources": search_sources
                    }

            except Exception as e:
                # 出现异常优雅回退
                error_warning = f"\n\n[联网检索服务异常，已为您回退到无网解答模式: {str(e)}]\n\n"
                if isinstance(processed_messages[-1]["content"], list):
                    processed_messages[-1]["content"].insert(0, {"type": "text", "text": error_warning})
                else:
                    processed_messages[-1]["content"] = error_warning + processed_messages[-1]["content"]

    # ================= 走常规云端或本地模型的推理发送逻辑 =================
    try:
        ai_content, usage_dict = await call_llm_api(request.model, processed_messages, is_deepseek_model)
        return {
            "content": ai_content,
            "usage": usage_dict,
            "sources": search_sources
        }
    except Exception as e:
        await send_debug_log("ERROR_OCCURRED", {"detail": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5678)
