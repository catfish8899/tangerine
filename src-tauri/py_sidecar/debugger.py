# -*- coding: utf-8 -*-
import sys
import json
from fastapi import FastAPI, Request
import uvicorn

app = FastAPI()

def print_banner():
    print("\n" + "="*80)
    print(" 🍊 tangerine 桌面 AI 助手 - 开发者实时调试监控面板 (Hardcore Debugger) ")
    print(" 监听地址: http://127.0.0.1:9999 | 正在等待框架发送上下文中... ")
    print("="*80 + "\n")

@app.post("/log")
async def receive_log(request: Request):
    try:
        data = await request.json()
        log_type = data.get("type", "INFO")
        
        # 彩色打印终端控制字符
        BLUE = "\033[94m"
        GREEN = "\033[92m"
        YELLOW = "\033[93m"
        RED = "\033[91m"
        CYAN = "\033[96m"
        MAGENTA = "\033[95m"
        BOLD = "\033[1m"
        RESET = "\033[0m"

        if log_type == "REQUEST_INCOMING":
            print(f"\n{BLUE}{BOLD}[⏱️  FRAMEWORK: 收到新聊天请求]{RESET}")
            print(f"  ├─ 请求模型: {data.get('model')}")
            print(f"  └─ 联网搜索模式: {data.get('web_search')}")
            if data.get('file_paths'):
                print(f"  └─ 挂载文件绝对路径:")
                for fp in data.get('file_paths', []):
                    print(f"      └─ {fp}")

        elif log_type == "LLM_CALL_PREPARED":
            # 忠实展示 LLM 这一步调用的全部上下文
            print(f"\n{YELLOW}{BOLD}[🚀 FRAMEWORK ────> LLM: 发起一次大模型推理调用]{RESET}")
            print(f"{YELLOW}====== 大模型在此刻接收到的完整上下文 (ALL CONTEXT) ======{RESET}")
            messages = data.get("messages", [])
            for msg in messages:
                role = msg.get("role", "").lower()
                content = msg.get("content", "")
                
                # 严格区分且打上标准人声标签
                if role == "system":
                    print(f"{MAGENTA}{BOLD}[SYSTEM]{RESET}: {content}")
                elif role == "user":
                    if isinstance(content, list):
                        print(f"{GREEN}{BOLD}[USER]{RESET}:")
                        for item in content:
                            if item.get("type") == "text":
                                print(item.get("text"))
                            else:
                                print(f"  [多模态数据: {item.get('type')}]")
                    else:
                        print(f"{GREEN}{BOLD}[USER]{RESET}: {content}")
                elif role in ["assistant", "model"]:
                    print(f"{BLUE}{BOLD}[ASSISTANT]{RESET}: {content}")
                else:
                    print(f"{CYAN}[UNKNOWN ROLE: {role}]{RESET}: {content}")
                print("-" * 50)
            print(f"{YELLOW}====== 上下文投递完毕 (TOTAL MESSAGES: {len(messages)}) ======{RESET}\n")

        elif log_type == "LLM_RESPONSE_RECEIVED":
            # 记录大模型推理出来的生鲜 Output 
            print(f"{GREEN}{BOLD}[✨ LLM ────> FRAMEWORK: 推理成功返回结果]{RESET}")
            print(f"{BLUE}{BOLD}[ASSISTANT OUTPUT]{RESET}:")
            print(data.get("content"))
            print(f"{CYAN}* 本次调用 Token 消耗: {data.get('usage')}{RESET}")
            print("="*80)

        elif log_type == "TAVILY_CALL_TRIGGERED":
            print(f"\n{MAGENTA}{BOLD}[🔍 TAVILY LOG: 监测到模型 SEARCH 动作，触发网络检索]{RESET}")
            print(f"  └─ 检索关键词 (Query): {data.get('query')}")

        elif log_type == "TAVILY_CALL_COMPLETED":
            print(f"{MAGENTA}{BOLD}[🌐 TAVILY LOG: 第 {data.get('round')} 轮搜索检索完成]{RESET}")
            sources = data.get("sources", [])
            print(f"  └─ 采信的网页源 ({len(sources)}个):")
            for idx, src in enumerate(sources):
                print(f"      [{idx+1}] {src.get('title')} -> {src.get('url')}")
            print("="*80)

        elif log_type == "ERROR_OCCURRED":
            print(f"\n{RED}{BOLD}[⚠️  FRAMEWORK: 核心调用报错]{RESET}")
            print(data.get("detail"))
            print("="*80)

    except Exception as e:
        print(f"解析调试信息失败: {str(e)}")
    
    return {"status": "ok"}

if __name__ == "__main__":
    print_banner()
    uvicorn.run(app, host="127.0.0.1", port=9999, log_level="warning")
