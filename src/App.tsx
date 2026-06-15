// src/App.tsx 的完整修改版
import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  ChevronUp,
  PlusCircle,
  Hammer,
  Keyboard,
  Globe,
  FileText,
  Sliders,
  Loader,
  Trash2,
  AlertTriangle
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import MarkdownMessage from "./components/MarkdownMessage";
import SettingsModal from "./components/SettingsModal";

interface Message {
  id: string;
  sender: "user" | "ai" | "system_err";
  text: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  timestamp?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

const STORAGE_KEY = "tangerine_chat_sessions";
const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";

// 辅助函数：将时间戳格式化为 12 小时制
function format12HourTime(timestamp?: number): string {
  if (!timestamp) return "未知";
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "下午" : "上午";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 点应该显示为 12 点
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;
  return `${ampm} ${hours}:${minutesStr}`;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("解析历史对话失败：", e);
      }
    }
    return [{ id: "1", title: "agent微框架编程助手", messages: [] }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || "1";
  });
  
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"deepseek-v4-flash" | "deepseek-v4-pro">("deepseek-v4-flash");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 警示弹窗状态
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // 主页面对话文字大小状态
  const [chatFontSize, setChatFontSize] = useState<string>(() => {
    return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "12px";
  });

  // 侧边栏对话删除菜单
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetSessionId: string | null;
  }>({ visible: false, x: 0, y: 0, targetSessionId: null });

  // 👇 新增：对话气泡右键删除菜单状态
  const [msgContextMenu, setMsgContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetMessageId: string | null;
  }>({ visible: false, x: 0, y: 0, targetMessageId: null });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // 监听全局点击、键盘 ESC 按键和字号设置修改
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
      setMsgContextMenu(prev => ({ ...prev, visible: false })); // 全局点击关闭消息气泡右键菜单
      setShowModelDropdown(false);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSettings(false); // 按 ESC 键关闭设置窗口
      }
    };

    const handleFontSizeChange = () => {
      const size = localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "12px";
      setChatFontSize(size);
    };

    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("storage_font_size_changed", handleFontSizeChange);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("storage_font_size_changed", handleFontSizeChange);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isLoading]);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetSessionId: sessionId
    });
  };

  // 👇 新增：呼出对话气泡删除菜单的回调
  const handleMsgContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMsgContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetMessageId: messageId
    });
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      const resetSession: ChatSession = { id: Date.now().toString(), title: "新对话", messages: [] };
      setSessions([resetSession]);
      setActiveSessionId(resetSession.id);
      return;
    }
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  // 👇 新增：物理删除单个消息气泡，直接从 messages 过滤，确保之后发送不计入上下文
  const handleDeleteMessage = (messageId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: session.messages.filter(m => m.id !== messageId)
        };
      }
      return session;
    }));
  };

  const handleCreateSession = () => {
    const newId = Date.now().toString();
    setSessions(prev => [{ id: newId, title: "新对话", messages: [] }, ...prev]);
    setActiveSessionId(newId);
  };

  // 👇 严格守卫校验：过滤系统错误后，消息列表必须完美呈现 [user, ai, user, ai ...] 的交替结构
  const validateAlternatingOrder = (tempMessagesList: Message[]): boolean => {
    const chatOnly = tempMessagesList.filter(m => m.sender !== "system_err");
    if (chatOnly.length === 0) return true;
    for (let i = 0; i < chatOnly.length; i++) {
      const expectedSender = i % 2 === 0 ? "user" : "ai";
      if (chatOnly[i].sender !== expectedSender) {
        return false;
      }
    }
    return true;
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText;
    const userMessage: Message = { 
      id: Date.now().toString(), 
      sender: "user", 
      text: userText,
      timestamp: Date.now()
    };

    // 拼装用于校验的新临时列表 (排除系统错误，新追加的消息必须和旧消息形成严密的 user-ai 交替关系)
    const proposedMessages = [...activeSession.messages, userMessage];

    // 👇 校验：如果不满足交替顺序
    if (!validateAlternatingOrder(proposedMessages)) {
      setWarningMessage("⚠️ 对话未遵循 ai--用户 顺序结构，请删除对应气泡后再发送。");
      setTimeout(() => {
        setWarningMessage(null);
      }, 3000); // 持续 3 秒警示
      return;
    }

    let currentMessages = [...activeSession.messages, userMessage];
    
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        const title = session.messages.length === 0 
          ? (userText.length > 12 ? userText.slice(0, 12) + "..." : userText)
          : session.title;
        return { ...session, title, messages: currentMessages };
      }
      return session;
    }));

    setInputText("");
    setIsLoading(true);

    try {
      const apiMessages = currentMessages
        .filter(m => m.sender !== "system_err")
        .map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }));

      const response = await fetch("http://127.0.0.1:5678/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "system", content: "You are a helpful assistant" }, ...apiMessages]
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "请求失败");
      }

      const data = await response.json();
      
      // 👇 升级 Token 捕获机制：全方位覆盖各种可能的 Python 返回格式，绝不漏掉 usage 信息
      const tokensUsed = 
        data.usage?.total_tokens ?? 
        data.usage?.total_token ?? 
        data.usage_metadata?.total_tokens ?? 
        data.total_tokens ?? 
        data.tokens_used ?? 
        data.response?.usage?.total_tokens ??
        undefined;

      const aiResponse: Message = { 
        id: (Date.now() + 1).toString(), 
        sender: "ai", 
        text: data.content,
        provider: "deepseek",
        model: selectedModel,
        tokensUsed: tokensUsed,
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          return { ...session, messages: [...session.messages, aiResponse] };
        }
        return session;
      }));

    } catch (error: any) {
      const systemError: Message = {
        id: (Date.now() + 1).toString(),
        sender: "system_err",
        text: `⚠️ 错误: ${error.message || "无法连接到本地 Python Sidecar"}`,
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          return { ...session, messages: [...session.messages, systemError] };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#202020] text-[#e3e3e3] overflow-hidden select-none font-sans">
      
      {/* 1. 左侧侧边栏 */}
      <Sidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        setActiveSessionId={setActiveSessionId}
        onContextMenu={handleContextMenu}
        onCreateSession={handleCreateSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* 2. 右侧主聊天区域 */}
      <div className="flex-1 flex flex-col bg-[#202020] h-full overflow-hidden relative">
        
        {/* 👇 3秒遮罩警示弹窗 (Fluent微光质感) */}
        {warningMessage && (
          <div className="absolute inset-x-0 top-6 z-[9999] flex justify-center animate-in slide-in-from-top-4 fade-in duration-150">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#4c1d1d]/95 text-red-200 border border-red-500/30 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold tracking-wide">
              <AlertTriangle size={14} className="text-red-400 animate-bounce" />
              <span>{warningMessage}</span>
            </div>
          </div>
        )}

        {/* 消息展示区 */}
        <div className="flex-1 overflow-y-auto px-12 py-6">
          {activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-85">
              <div className="w-12 h-12 rounded-xl bg-[#2e2e2e] flex items-center justify-center mb-4 border border-[#3e3e3e]">
                <span className="text-2xl">💬</span>
              </div>
              <h2 className="text-base font-semibold text-white tracking-wide">等待用户输入...📓✍️🧐</h2>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {activeSession.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0 select-none">🤖</div>
                  )}
                  {/* 应用动态字号，并绑定 `onContextMenu` 支持气泡右键删除消息 */}
                  <div 
                    onContextMenu={(e) => handleMsgContextMenu(e, msg.id)}
                    style={{ fontSize: chatFontSize }}
                    className={`max-w-[85%] p-3.5 rounded-xl leading-relaxed flex flex-col gap-2.5 cursor-context-menu select-text transition-all duration-150 hover:ring-1 hover:ring-white/5 ${
                      msg.sender === 'user' 
                        ? 'bg-[#2b6cb0] text-white rounded-tr-none' 
                        : msg.sender === 'system_err'
                        ? 'bg-[#5c2d2d] text-red-200 border border-[#8c3d3d]'
                        : 'bg-[#2e2e2e] text-gray-200 border border-[#3a3a3a] rounded-tl-none'
                    }`}
                  >
                    <div className="flex-1">
                      {msg.sender === 'ai' ? (
                        <MarkdownMessage text={msg.text} fontSize={chatFontSize} />
                      ) : (
                        <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                      )}
                    </div>

                    {/* AI 消息元数据 */}
                    {msg.sender === 'ai' && (
                      <div className="mt-1 pt-1.5 border-t border-white/5 flex items-center gap-2 text-[10px] text-gray-500 font-mono select-none">
                        <span>提供商: <strong className="text-gray-400 font-medium">{msg.provider || "未知"}</strong></span>
                        <span className="opacity-30">•</span>
                        <span>模型: <strong className="text-gray-400 font-medium">{msg.model || "未知"}</strong></span>
                        <span className="opacity-30">•</span>
                        <span>Token消耗: <strong className="text-gray-400 font-medium">{msg.tokensUsed !== undefined ? msg.tokensUsed : "未知"}</strong></span>
                        <span className="opacity-30">•</span>
                        <span>时间: <strong className="text-gray-400 font-medium">{format12HourTime(msg.timestamp)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0 select-none">🤖</div>
                  <div 
                    style={{ fontSize: chatFontSize }}
                    className="bg-[#2e2e2e] text-gray-400 border border-[#3a3a3a] p-3.5 rounded-xl flex items-center gap-2"
                  >
                    <Loader size={12} className="animate-spin text-[#4ea1db]" />
                    <span>DeepSeek 正在思考中...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 底部输入框区 */}
        <div className="p-6 bg-[#202020] border-t border-[#282828] shrink-0 relative">
          <div className="max-w-3xl mx-auto bg-[#2e2e2e] rounded-xl border border-[#3e3e3e] shadow-lg flex flex-col px-3 pt-3 pb-2 focus-within:border-[#4d4d4d] transition-all">
            <textarea
              rows={2}
              placeholder={isLoading ? "请等待当前回复完成..." : "在此处输入聊天内容..."}
              disabled={isLoading}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="w-full bg-transparent border-none outline-none resize-none text-xs text-[#e3e3e3] placeholder-gray-500 px-2"
            />

            <div className="flex items-center justify-between border-t border-[#3a3a3a] pt-2 mt-2">
              <div className="flex items-center gap-1.5 text-gray-400">
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><PlusCircle size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Hammer size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Keyboard size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Globe size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><FileText size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Sliders size={14} /></button>
              </div>

              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowModelDropdown(!showModelDropdown); }}
                    className="text-[10px] text-gray-400 hover:text-white font-semibold bg-[#202020] px-2.5 py-1.5 rounded border border-[#353535] flex items-center gap-1.5 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedModel === "deepseek-v4-pro" ? "bg-amber-500 animate-pulse" : "bg-[#f97316]"}`}></span>
                    {selectedModel}
                    <ChevronUp size={10} className={`transform transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showModelDropdown && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-xl py-1 z-50">
                      <button
                        onClick={() => { setSelectedModel("deepseek-v4-flash"); setShowModelDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] transition-colors flex flex-col ${selectedModel === "deepseek-v4-flash" ? "text-amber-400 font-semibold" : "text-gray-300"}`}
                      >
                        <span>deepseek-v4-flash</span>
                        <span className="text-[9px] text-gray-500 font-normal">快速且轻量的日常对话</span>
                      </button>
                      <button
                        onClick={() => { setSelectedModel("deepseek-v4-pro"); setShowModelDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] transition-colors flex flex-col ${selectedModel === "deepseek-v4-pro" ? "text-amber-400 font-semibold" : "text-gray-300"}`}
                      >
                        <span>deepseek-v4-pro</span>
                        <span className="text-[9px] text-amber-500 font-normal">支持深度思考 (Reasoning)</span>
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleSendMessage}
                  disabled={!inputText.trim() || isLoading}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                    inputText.trim() && !isLoading ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#3e3e3e] text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-2">AI 的回答可能有误，请检查重要信息</div>
        </div>

      </div>

      {/* 3. 侧边栏对话删除菜单 (原有) */}
      {contextMenu.visible && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-[#232324] border border-[#38383a] rounded-lg shadow-2xl py-1 w-32 z-[9999] animate-in fade-in duration-100"
        >
          <button
            onClick={() => {
              if (contextMenu.targetSessionId) { handleDeleteSession(contextMenu.targetSessionId); }
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300 transition-colors text-left"
          >
            <Trash2 size={13} />
            <span>删除对话</span>
          </button>
        </div>
      )}

      {/* 👇 4. 新增：对话气泡右键上下文删除菜单 */}
      {msgContextMenu.visible && (
        <div 
          style={{ top: msgContextMenu.y, left: msgContextMenu.x }}
          className="fixed bg-[#232324] border border-[#38383a] rounded-lg shadow-2xl py-1 w-32 z-[9999] animate-in fade-in duration-100"
        >
          <button
            onClick={() => {
              if (msgContextMenu.targetMessageId) {
                handleDeleteMessage(msgContextMenu.targetMessageId);
              }
              setMsgContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300 transition-colors text-left"
          >
            <Trash2 size={13} />
            <span>删除此消息</span>
          </button>
        </div>
      )}

      {/* 5. 模型 API 设置弹窗 */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />

    </div>
  );
}
