import { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Search, 
  SlidersHorizontal, 
  Plus, 
  Image as ImageIcon, 
  UserSquare2, 
  Settings, 
  HelpCircle, 
  Info,
  ChevronUp,
  PlusCircle,
  Hammer,
  Keyboard,
  Globe,
  FileText,
  Sliders,
  Loader,
  Trash2
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "ai" | "system_err";
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

// 本地存储的 key 键名
const STORAGE_KEY = "tangerine_chat_sessions";

export default function App() {
  // 1. 初始化时优先从 localStorage 读取历史对话，若没有则创建默认会话
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("解析历史对话失败：", e);
      }
    }
    return [
      {
        id: "1",
        title: "agent微框架编程助手",
        messages: [] 
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || "1";
  });
  
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // 模型选择
  const [selectedModel, setSelectedModel] = useState<"deepseek-v4-flash" | "deepseek-v4-pro">("deepseek-v4-flash");
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // 右键菜单状态管理
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetSessionId: string | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetSessionId: null
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 2. 状态改变时自动持久化到本地
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // 监听全局点击以关闭右键菜单和下拉菜单
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
      setShowModelDropdown(false);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isLoading]);

  // 处理右键触发
  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault(); // 阻止浏览器默认菜单
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetSessionId: sessionId
    });
  };

  // 执行删除会话
  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      // 至少保留一个会话，删除最后一个时则重置它
      const resetSession: ChatSession = {
        id: Date.now().toString(),
        title: "新对话",
        messages: []
      };
      setSessions([resetSession]);
      setActiveSessionId(resetSession.id);
      return;
    }

    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    
    // 如果删除的是当前激活的，切换到第一个
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userText = inputText;
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText
    };

    let currentMessages = [...activeSession.messages, userMessage];
    
    // 智能更新会话标题：如果是首条消息，用前12个字更新对话标题
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        const title = session.messages.length === 0 
          ? (userText.length > 12 ? userText.slice(0, 12) + "..." : userText)
          : session.title;
        return { 
          ...session, 
          title,
          messages: currentMessages 
        };
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: "You are a helpful assistant" },
            ...apiMessages
          ]
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "请求失败");
      }

      const data = await response.json();
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.content
      };

      setSessions(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          return { ...session, messages: [...session.messages, aiResponse] };
        }
        return session;
      }));

    } catch (error: any) {
      console.error(error);
      const systemError: Message = {
        id: (Date.now() + 1).toString(),
        sender: "system_err",
        text: `⚠️ 错误: ${error.message || "无法连接到本地 Python Sidecar"}`
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
      <div className="w-[260px] bg-[#181818] flex flex-col border-r border-[#2d2d2d] shrink-0 justify-between">
        <div className="flex flex-col pt-4 px-3 overflow-hidden">
          <div className="flex items-center justify-between px-2 mb-4 shrink-0">
            <span className="text-xs text-gray-400 font-semibold tracking-wider">聊天</span>
            <div className="flex gap-3 text-gray-400">
              <Search size={15} className="hover:text-white cursor-pointer" />
              <SlidersHorizontal size={15} className="hover:text-white cursor-pointer" />
            </div>
          </div>

          {/* 会话列表 */}
          <div className="space-y-[2px] overflow-y-auto flex-1 pr-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                onContextMenu={(e) => handleContextMenu(e, session.id)} // 绑定右键菜单事件
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  session.id === activeSessionId 
                    ? 'bg-[#2c2c2c] text-white' 
                    : 'hover:bg-[#202020] text-gray-400'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                  🤖
                </div>
                <span className="text-xs truncate font-medium">{session.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 底部功能区 */}
        <div className="p-3 border-t border-[#262626] space-y-3 bg-[#181818] shrink-0">
          <div className="space-y-2">
            <button 
              onClick={() => {
                const newId = Date.now().toString();
                setSessions(prev => [{ id: newId, title: "新对话", messages: [] }, ...prev]);
                setActiveSessionId(newId);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-[#253746] hover:bg-[#2d4355] text-[#4ea1db] border border-[#2d4558] transition-colors text-xs font-semibold"
            >
              <Plus size={14} />
              新对话
            </button>
            <button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-[#1e272e] hover:bg-[#253039] text-[#4ea1db]/80 border border-[#232f3a] transition-colors text-xs font-semibold">
              <ImageIcon size={14} />
              生成图片
            </button>
          </div>

          <div className="space-y-1 text-xs text-gray-400 pt-2 border-t border-[#252525]">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#252525] hover:text-white cursor-pointer transition-colors">
              <UserSquare2 size={15} />
              <span>我的搭档</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#252525] hover:text-white cursor-pointer transition-colors">
              <Settings size={15} />
              <span>设置</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#252525] hover:text-white cursor-pointer transition-colors">
              <HelpCircle size={15} />
              <span>帮助</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded text-[11px] text-gray-600">
              <Info size={13} />
              <span>关于 (1.21.1)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. 右侧主聊天区域 */}
      <div className="flex-1 flex flex-col bg-[#202020] h-full overflow-hidden">
        
        {/* 消息展示区 */}
        <div className="flex-1 overflow-y-auto px-12 py-6">
          {activeSession.messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-85">
              <div className="w-12 h-12 rounded-xl bg-[#2e2e2e] flex items-center justify-center mb-4 border border-[#3e3e3e]">
                <span className="text-2xl">💬</span>
              </div>
              <h2 className="text-base font-semibold text-white tracking-wide">
                今天我能为你提供什么帮助？
              </h2>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {activeSession.messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0">
                      🤖
                    </div>
                  )}
                  <div className={`max-w-[75%] p-3.5 rounded-xl text-xs leading-relaxed ${
                    msg.sender === 'user' 
                      ? 'bg-[#2b6cb0] text-white rounded-tr-none' 
                      : msg.sender === 'system_err'
                      ? 'bg-[#5c2d2d] text-red-200 border border-[#8c3d3d]'
                      : 'bg-[#2e2e2e] text-gray-200 border border-[#3a3a3a] rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0">
                    🤖
                  </div>
                  <div className="bg-[#2e2e2e] text-gray-400 border border-[#3a3a3a] p-3.5 rounded-xl text-xs flex items-center gap-2">
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
              placeholder={isLoading ? "请等待当前回复完成..." : "在这里输入你的问题..."}
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

            {/* 底部工具条 */}
            <div className="flex items-center justify-between border-t border-[#3a3a3a] pt-2 mt-2">
              <div className="flex items-center gap-1.5 text-gray-400">
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><PlusCircle size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Hammer size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Keyboard size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Globe size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><FileText size={14} /></button>
                <button className="p-1.5 hover:bg-[#383838] hover:text-white rounded transition-colors"><Sliders size={14} /></button>
              </div>

              {/* 模型选择器 */}
              <div className="flex items-center gap-2 relative">
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowModelDropdown(!showModelDropdown);
                    }}
                    className="text-[10px] text-gray-400 hover:text-white font-semibold bg-[#202020] px-2.5 py-1.5 rounded border border-[#353535] flex items-center gap-1.5 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedModel === "deepseek-v4-pro" ? "bg-amber-500 animate-pulse" : "bg-[#f97316]"}`}></span>
                    {selectedModel}
                    <ChevronUp size={10} className={`transform transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showModelDropdown && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-xl py-1 z-50">
                      <button
                        onClick={() => {
                          setSelectedModel("deepseek-v4-flash");
                          setShowModelDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] transition-colors flex flex-col ${selectedModel === "deepseek-v4-flash" ? "text-amber-400 font-semibold" : "text-gray-300"}`}
                      >
                        <span>deepseek-v4-flash</span>
                        <span className="text-[9px] text-gray-500 font-normal">快速且轻量的日常对话</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedModel("deepseek-v4-pro");
                          setShowModelDropdown(false);
                        }}
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
                    inputText.trim() && !isLoading
                      ? 'bg-white text-black hover:bg-gray-200' 
                      : 'bg-[#3e3e3e] text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-2">
            AI 生成的内容可能不准确。请核实重要信息。
          </div>
        </div>

      </div>

      {/* 3. 自定义右键上下文悬浮菜单 */}
      {contextMenu.visible && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed bg-[#232324] border border-[#38383a] rounded-lg shadow-2xl py-1 w-32 z-[9999] animate-in fade-in duration-100"
        >
          <button
            onClick={() => {
              if (contextMenu.targetSessionId) {
                handleDeleteSession(contextMenu.targetSessionId);
              }
              setContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300 transition-colors text-left"
          >
            <Trash2 size={13} />
            <span>删除对话</span>
          </button>
        </div>
      )}

    </div>
  );
}
