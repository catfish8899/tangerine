// src/App.tsx 的完整修改解耦流式防御版
import { useState, useRef, useEffect } from "react";
import { 
  Loader,
  Trash2,
  AlertTriangle,
  Edit3,
  RefreshCw
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import SettingsModal, { ApiProviderConfig } from "./components/SettingsModal";
import MessageItem from "./components/MessageItem";
import ChatInput from "./components/ChatInput";
import { Message, ChatSession, AttachmentFile, getFileType } from "./types/chat";

const STORAGE_KEY = "tangerine_chat_sessions";
const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";
const SETTINGS_STORAGE_KEY = "tangerine_api_settings";

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
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("deepseek-v4-flash");
  const [availableModels, setAvailableModels] = useState<string[]>(["deepseek-v4-flash", "deepseek-v4-pro"]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  
  const [webSearchMode, setWebSearchMode] = useState<'off' | 'direct' | 'agent'>('off');

  const [chatFontSize, setChatFontSize] = useState<string>(() => {
    return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "12px";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (savedSize) setChatFontSize(savedSize);
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  useEffect(() => {
    if (!showSettings) {
      const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (savedSize) setChatFontSize(savedSize);
    }
  }, [showSettings]);

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetSessionId: string | null;
  }>({ visible: false, x: 0, y: 0, targetSessionId: null });

  const [msgContextMenu, setMsgContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetMessageId: string | null;
    targetMessageSender: Message["sender"] | null;
  }>({ visible: false, x: 0, y: 0, targetMessageId: null, targetMessageSender: null });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const getProviderByModel = (model: string): string => {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes("gemini")) return "gemini";
    if (lowerModel.includes("deepseek")) return "deepseek";
    return "ollama";
  };

  const syncModelsFromSettings = () => {
    const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedConfigs) {
      try {
        const parsed: ApiProviderConfig[] = JSON.parse(savedConfigs);
        const allModels = parsed.flatMap(cfg => cfg.models);
        if (allModels.length > 0) {
          setAvailableModels(allModels);
          if (!allModels.includes(selectedModel)) {
            setSelectedModel(allModels[0]);
          }
          return;
        }
      } catch (e) {
        console.error("加载模型列表失败：", e);
      }
    }
    setAvailableModels(["deepseek-v4-flash", "deepseek-v4-pro"]);
  };

  useEffect(() => {
    syncModelsFromSettings();
  }, [showSettings]);

  useEffect(() => {
    const currentMessagesCount = activeSession?.messages?.length || 0;
    if (currentMessagesCount > prevMessagesCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesCountRef.current = currentMessagesCount;
  }, [activeSession?.messages?.length]);

  const validateAlternatingOrder = (messages: Message[]): boolean => {
    const filtered = messages.filter(m => m.sender !== "system_err");
    for (let i = 0; i < filtered.length; i++) {
      const current = filtered[i].sender;
      const expected = i % 2 === 0 ? "user" : "ai";
      if (current !== expected) return false;
    }
    return true;
  };

  const handleCreateSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "新对话",
      messages: []
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetSessionId: sessionId
    });
  };

  const handleMsgContextMenu = (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => {
    e.preventDefault();
    setMsgContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetMessageId: messageId,
      targetMessageSender: sender
    });
  };

  const handleSaveEdit = (messageId: string, newText: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedMessages = s.messages.map(m => {
          if (m.id === messageId) {
            return { ...m, text: newText, isEditing: false };
          }
          return m;
        });
        return { ...s, messages: updatedMessages };
      }
      return s;
    }));
  };

  const handleCancelEdit = (messageId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedMessages = s.messages.map(m => {
          if (m.id === messageId) {
            return { ...m, isEditing: false };
          }
          return m;
        });
        return { ...s, messages: updatedMessages };
      }
      return s;
    }));
  };

  const handleSelectFiles = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5678/select_files", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        const selectedPaths: string[] = data.file_paths || [];
        const newAttachments: AttachmentFile[] = selectedPaths.map(p => {
          const parts = p.split(/[\\/]/);
          const name = parts[parts.length - 1] || "未命名文件";
          return {
            name,
            path: p,
            type: getFileType(name)
          };
        });
        setAttachments(prev => {
          const existingPaths = prev.map(a => a.path);
          const filteredNew = newAttachments.filter(a => !existingPaths.includes(a.path));
          return [...prev, ...filteredNew];
        });
      }
    } catch (e) {
      console.error("调用 Tauri 选择文件出错:", e);
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handleResendMessage = async (messageId: string) => {
    if (isLoading) return;

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    const msgIdx = session.messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;

    const targetMsg = { ...session.messages[msgIdx] };
    const precedingMessages = session.messages.slice(0, msgIdx + 1);
    const subsequentMessages = session.messages.slice(msgIdx + 1);

    if (!validateAlternatingOrder(precedingMessages)) {
      setWarningMessage("⚠️ 对话未遵循 ai--用户 顺序结构，请删除对应气泡后再发送。");
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }

    let branches = targetMsg.branches ? [...targetMsg.branches] : [];
    let activeBranchIndex = targetMsg.activeBranchIndex ?? 0;

    if (branches.length === 0) {
      branches = [subsequentMessages];
      activeBranchIndex = 0;
    } else {
      branches[activeBranchIndex] = subsequentMessages;
    }

    branches.push([]);
    activeBranchIndex = branches.length - 1;

    targetMsg.branches = branches;
    targetMsg.activeBranchIndex = activeBranchIndex;

    const newMessagesList = [...session.messages.slice(0, msgIdx), targetMsg];

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: newMessagesList };
      }
      return s;
    }));

    setIsLoading(true);

    const streamAiMessageId = (Date.now() + 1).toString();
    const currentProvider = getProviderByModel(selectedModel);
    
    const initialAiResponse: Message = { 
      id: streamAiMessageId, 
      sender: "ai", 
      text: "",
      provider: currentProvider,
      model: selectedModel,
      timestamp: Date.now(),
      sources: []
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedMessages = s.messages.map(m => {
          if (m.id === messageId) {
            const updatedBranches = m.branches ? [...m.branches] : [];
            const activeIdx = m.activeBranchIndex ?? 0;
            updatedBranches[activeIdx] = [initialAiResponse];
            return { ...m, branches: updatedBranches };
          }
          return m;
        });
        return { ...s, messages: [...updatedMessages, initialAiResponse] };
      }
      return s;
    }));

    try {
      const apiMessages = precedingMessages
        .filter(m => m.sender !== "system_err")
        .map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }));

      const filePathsToSend = targetMsg.filePaths || [];

      const response = await fetch("http://127.0.0.1:5678/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          provider: currentProvider,
          messages: [{ role: "system", content: "You are a helpful assistant" }, ...apiMessages],
          file_paths: filePathsToSend,
          web_search: webSearchMode
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "请求失败");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      if (!reader) {
        throw new Error("流式数据读取器初始化失败！");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const rawData = trimmed.slice(6).trim();
          if (rawData === "[DONE]") {
            break;
          }

          try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.error) {
              throw new Error(parsedData.error);
            }

            const textDelta = parsedData.choices?.[0]?.delta?.content || "";
            const sources = parsedData.sources || [];
            const tokensUsed = 
              parsedData.usage?.total_tokens ?? 
              parsedData.usage?.total_token ?? 
              undefined;

            setSessions(prev => prev.map(s => {
              if (s.id === activeSessionId) {
                const updatedMessages = s.messages.map(m => {
                  if (m.id === streamAiMessageId) {
                    return {
                      ...m,
                      text: m.text + textDelta,
                      sources: sources.length > 0 ? sources : m.sources,
                      tokensUsed: tokensUsed !== undefined ? tokensUsed : m.tokensUsed
                    };
                  }
                  if (m.id === messageId) {
                    const updatedBranches = m.branches ? [...m.branches] : [];
                    const activeIdx = m.activeBranchIndex ?? 0;
                    const branchList = updatedBranches[activeIdx] || [];
                    const updatedBranchList = branchList.map(bm => {
                      if (bm.id === streamAiMessageId) {
                        return {
                          ...bm,
                          text: bm.text + textDelta,
                          sources: sources.length > 0 ? sources : bm.sources,
                          tokensUsed: tokensUsed !== undefined ? tokensUsed : bm.tokensUsed
                        };
                      }
                      return bm;
                    });
                    updatedBranches[activeIdx] = updatedBranchList;
                    return { ...m, branches: updatedBranches };
                  }
                  return m;
                });
                return { ...s, messages: updatedMessages };
              }
              return s;
            }));
          } catch (e: any) {
            console.error("解析流式行失败:", e);
          }
        }
      }

    } catch (error: any) {
      const systemError: Message = {
        id: (Date.now() + 1).toString(),
        sender: "system_err",
        text: `⚠️ 错误: ${error.message || "无法连接到本地 Python Sidecar"}`,
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedMessages = s.messages.map(m => {
            if (m.id === messageId) {
              const updatedBranches = m.branches ? [...m.branches] : [];
              const activeIdx = m.activeBranchIndex ?? 0;
              updatedBranches[activeIdx] = [systemError];
              return { ...m, branches: updatedBranches };
            }
            return m;
          });
          const cleanMsgs = updatedMessages.filter(m => m.id !== streamAiMessageId);
          return { ...s, messages: [...cleanMsgs, systemError] };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchBranch = (messageId: string, direction: "prev" | "next") => {
    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId) return session;

      const idx = session.messages.findIndex(m => m.id === messageId);
      if (idx === -1) return session;

      const targetMsg = { ...session.messages[idx] };
      const branches = targetMsg.branches || [];
      const currentIdx = targetMsg.activeBranchIndex ?? 0;

      let newIdx = currentIdx;
      if (direction === "prev" && currentIdx > 0) {
        newIdx = currentIdx - 1;
      } else if (direction === "next" && currentIdx < branches.length - 1) {
        newIdx = currentIdx + 1;
      }

      if (newIdx === currentIdx) return session;

      targetMsg.activeBranchIndex = newIdx;

      const baseMessages = session.messages.slice(0, idx);
      const branchMessages = branches[newIdx] || [];

      return {
        ...session,
        messages: [...baseMessages, targetMsg, ...branchMessages]
      };
    }));
  };

  const handleSendMessage = async (customText?: any, filePathsOverride?: string[]) => {
    if (isLoading) return;

    let userText = "";
    if (customText && typeof customText === "string") {
      userText = customText;
    } else {
      userText = inputText;
    }

    const finalFilePaths = filePathsOverride !== undefined ? filePathsOverride : attachments.map(a => a.path);

    if (!userText.trim() && finalFilePaths.length === 0) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: Date.now(),
      filePaths: finalFilePaths
    };

    const currentMessages = [...activeSession.messages, userMessage];

    if (!validateAlternatingOrder(currentMessages)) {
      setWarningMessage("⚠️ 对话未遵循 [User-AI] 交替架构，请点击右键清理系统报错或多余消息。");
      setTimeout(() => setWarningMessage(null), 3500);
      return;
    }

    const filePathsToSend = [...finalFilePaths];

    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        const title = session.messages.length === 0 
          ? (userText.length > 12 ? userText.slice(0, 12) + "..." : userText || "包含文件的会话")
          : session.title;
        return { ...session, title, messages: currentMessages };
      }
      return session;
    }));

    setInputText("");
    setAttachments([]);
    setIsLoading(true);

    const streamAiMessageId = (Date.now() + 1).toString();
    const currentProvider = getProviderByModel(selectedModel);

    const initialAiResponse: Message = { 
      id: streamAiMessageId, 
      sender: "ai", 
      text: "",
      provider: currentProvider,
      model: selectedModel,
      timestamp: Date.now(),
      sources: []
    };

    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return { ...session, messages: [...session.messages, initialAiResponse] };
      }
      return session;
    }));

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
          provider: currentProvider,
          messages: [{ role: "system", content: "You are a helpful assistant" }, ...apiMessages],
          file_paths: filePathsToSend,
          web_search: webSearchMode
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "请求失败");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      if (!reader) {
        throw new Error("流式数据读取器初始化失败！");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const rawData = trimmed.slice(6).trim();
          if (rawData === "[DONE]") {
            break;
          }

          try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.error) {
              throw new Error(parsedData.error);
            }

            const textDelta = parsedData.choices?.[0]?.delta?.content || "";
            const sources = parsedData.sources || [];
            const tokensUsed = 
              parsedData.usage?.total_tokens ?? 
              parsedData.usage?.total_token ?? 
              undefined;

            setSessions(prev => prev.map(session => {
              if (session.id === activeSessionId) {
                const updatedMessages = session.messages.map(m => {
                  if (m.id === streamAiMessageId) {
                    return {
                      ...m,
                      text: m.text + textDelta,
                      sources: sources.length > 0 ? sources : m.sources,
                      tokensUsed: tokensUsed !== undefined ? tokensUsed : m.tokensUsed
                    };
                  }
                  return m;
                });
                return { ...session, messages: updatedMessages };
              }
              return session;
            }));
          } catch (e: any) {
            console.error("解析流式行失败:", e);
          }
        }
      }

    } catch (error: any) {
      const systemError: Message = {
        id: (Date.now() + 1).toString(),
        sender: "system_err",
        text: `⚠️ 错误: ${error.message || "无法连接到本地 Python Sidecar"}`,
        timestamp: Date.now()
      };
      setSessions(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          const cleanMsgs = session.messages.filter(m => m.id !== streamAiMessageId);
          return { ...session, messages: [...cleanMsgs, systemError] };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // 💡 交互优化：判定模型是否已经吐出字符或完成联网检索轨迹
  const lastMsg = activeSession.messages[activeSession.messages.length - 1];
  const isAiOutputStarted = lastMsg && lastMsg.sender === "ai" && (lastMsg.text.trim() !== "" || (lastMsg.sources && lastMsg.sources.length > 0));

  return (
    <div className="flex h-screen w-screen bg-[#202020] text-[#e3e3e3] overflow-hidden select-none font-sans">
      
      <Sidebar 
        sessions={sessions}
        activeSessionId={activeSessionId}
        setActiveSessionId={setActiveSessionId}
        onContextMenu={handleContextMenu}
        onCreateSession={handleCreateSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col bg-[#202020] h-full overflow-hidden relative">
        
        {warningMessage && (
          <div className="absolute inset-x-0 top-6 z-[9999] flex justify-center animate-in slide-in-from-top-4 fade-in duration-150">
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#4c1d1d]/95 text-red-200 border border-red-500/30 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold tracking-wide">
              <AlertTriangle size={14} className="text-red-400 animate-bounce" />
              <span>{warningMessage}</span>
            </div>
          </div>
        )}

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
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  chatFontSize={chatFontSize}
                  onMsgContextMenu={handleMsgContextMenu}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onSwitchBranch={handleSwitchBranch}
                  isParentLoading={isLoading}
                />
              ))}
              {/* 💡 只有处于 isLoading 且模型还没出字(isAiOutputStarted为false)时，才显示思考气泡 */}
              {isLoading && !isAiOutputStarted && (
                <div className="flex gap-4 justify-start animate-in fade-in duration-200">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0 select-none">🤖</div>
                  <div 
                    style={{ fontSize: chatFontSize }}
                    className="bg-[#2e2e2e] text-gray-400 border border-[#3a3a3a] p-3.5 rounded-xl flex items-center gap-2"
                  >
                    <Loader size={12} className="animate-spin text-[#4ea1db]" />
                    <span>
                      {webSearchMode === 'agent' 
                        ? "Tavily AI自主检索多轮决策中..." 
                        : webSearchMode === 'direct' 
                        ? "Tavily 正在直接抓取一轮中..." 
                        : selectedModel.toLowerCase().includes("deepseek") 
                        ? "DeepSeek 正在思考中..." 
                        : "模型正在思考中..."}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <ChatInput
          inputText={inputText}
          setInputText={setInputText}
          isLoading={isLoading}
          attachments={attachments}
          onSelectFiles={handleSelectFiles}
          onRemoveAttachment={handleRemoveAttachment}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          availableModels={availableModels}
          showModelDropdown={showModelDropdown}
          setShowModelDropdown={setShowModelDropdown}
          webSearchMode={webSearchMode}
          setWebSearchMode={setWebSearchMode}
          onSendMessage={handleSendMessage}
        />
        
      </div>

      {showSettings && (
        <SettingsModal 
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {contextMenu.visible && (
        <div 
          className="fixed bg-[#2b2b2b]/95 border border-[#444444]/60 text-xs text-red-300 rounded-lg shadow-2xl z-[9999] p-1.5 backdrop-blur-md min-w-[130px] transition-all animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => {
            const tid = contextMenu.targetSessionId;
            if (tid) {
              setSessions(prev => {
                const rest = prev.filter(s => s.id !== tid);
                if (rest.length === 0) {
                  return [{ id: Date.now().toString(), title: "新对话", messages: [] }];
                }
                return rest;
              });
              if (activeSessionId === tid) {
                setActiveSessionId(sessions.find(s => s.id !== tid)?.id || "1");
              }
            }
            setContextMenu(prev => ({ ...prev, visible: false }));
          }}
          onMouseLeave={() => setContextMenu(prev => ({ ...prev, visible: false }))}
        >
          <button className="flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 hover:bg-[#ff4d4d]/15 hover:text-red-200 rounded transition-colors font-medium">
            <Trash2 size={13} className="text-red-400" />
            <span>彻底删除此对话</span>
          </button>
        </div>
      )}

      {msgContextMenu.visible && (
        <div
          className="fixed bg-[#2b2b2b]/95 border border-[#444444]/60 text-xs text-[#e3e3e3] rounded-lg shadow-2xl z-[9999] p-1.5 backdrop-blur-md min-w-[150px] transition-all animate-in fade-in zoom-in-95 duration-100"
          style={{ top: msgContextMenu.y, left: msgContextMenu.x }}
          onMouseLeave={() => setMsgContextMenu(prev => ({ ...prev, visible: false }))}
        >
          {msgContextMenu.targetMessageSender === "user" && (
            <button
              className="flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 hover:bg-[#ffffff]/10 rounded transition-colors font-medium mb-1"
              onClick={() => {
                const mid = msgContextMenu.targetMessageId;
                setSessions(prev => prev.map(s => {
                  if (s.id === activeSessionId) {
                    return {
                      ...s,
                      messages: s.messages.map(m => m.id === mid ? { ...m, isEditing: true } : m)
                    };
                  }
                  return s;
                }));
                setMsgContextMenu(prev => ({ ...prev, visible: false }));
              }}
            >
              <Edit3 size={13} className="text-[#a1a1a1]" />
              <span>编辑此条消息</span>
            </button>
          )}

          {msgContextMenu.targetMessageSender === "user" && (
            <button
              className="flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 hover:bg-[#ffffff]/10 rounded transition-colors font-medium mb-1"
              onClick={() => {
                handleResendMessage(msgContextMenu.targetMessageId || "");
                setMsgContextMenu(prev => ({ ...prev, visible: false }));
              }}
            >
              <RefreshCw size={13} className="text-orange-400" />
              <span>重新生成回答</span>
            </button>
          )}

          <button
            className="flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 hover:bg-[#ff4d4d]/15 hover:text-red-200 rounded transition-colors font-medium text-red-300"
            onClick={() => {
              const mid = msgContextMenu.targetMessageId;
              setSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                  return { ...s, messages: s.messages.filter(m => m.id !== mid) };
                }
                return s;
              }));
              setMsgContextMenu(prev => ({ ...prev, visible: false }));
            }}
          >
            <Trash2 size={13} className="text-red-400" />
            <span>删除此消息气泡</span>
          </button>
        </div>
      )}

    </div>
  );
}
