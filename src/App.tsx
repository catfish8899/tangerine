// src/App.tsx 的完整修改解耦版
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

  // 对话气泡右键多功能菜单
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

    const handleGlobalClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
      setMsgContextMenu(prev => ({ ...prev, visible: false }));
      setShowModelDropdown(false);
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSettings(false);
      }
    };

    const handleFontSizeChange = () => {
      const size = localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "12px";
      setChatFontSize(size);
    };

    const handleSettingsChange = () => {
      syncModelsFromSettings();
    };

    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("storage_font_size_changed", handleFontSizeChange);
    window.addEventListener("tangerine_api_settings_changed", handleSettingsChange);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("storage_font_size_changed", handleFontSizeChange);
      window.removeEventListener("tangerine_api_settings_changed", handleSettingsChange);
    };
  }, [selectedModel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const currentCount = activeSession?.messages?.length || 0;
    if (currentCount > prevMessagesCountRef.current || isLoading) {
      scrollToBottom();
    }
    prevMessagesCountRef.current = currentCount;
  }, [activeSession?.messages?.length, isLoading]);

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

  const handleMsgContextMenu = (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => {
    e.preventDefault();
    e.stopPropagation();
    setMsgContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetMessageId: messageId,
      targetMessageSender: sender
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

  const handleStartEdit = (messageId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: session.messages.map(m => m.id === messageId ? { ...m, isEditing: true } : m)
        };
      }
      return session;
    }));
  };

  const handleSaveEdit = (messageId: string, newText: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: session.messages.map(m => m.id === messageId ? { ...m, text: newText, isEditing: false } : m)
        };
      }
      return session;
    }));
  };

  const handleCancelEdit = (messageId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return {
          ...session,
          messages: session.messages.map(m => m.id === messageId ? { ...m, isEditing: false } : m)
        };
      }
      return session;
    }));
  };

  const handleSelectFiles = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5678/api/select-files", {
        method: "POST"
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.files) {
          const newAttachments: AttachmentFile[] = data.files.map((filePath: string) => {
            const name = filePath.split(/[/\\]/).pop() || filePath;
            return {
              name,
              path: filePath,
              type: getFileType(name)
            };
          });
          setAttachments(prev => [...prev, ...newAttachments]);
        }
      }
    } catch (err) {
      console.error("通过 Python 选取文件失败:", err);
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
          messages: [{ role: "system", content: "You are a helpful assistant" }, ...apiMessages],
          file_paths: filePathsToSend
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "请求失败");
      }

      const data = await response.json();
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
        provider: selectedModel.toLowerCase().includes("deepseek") ? "deepseek" : "ollama",
        model: selectedModel,
        tokensUsed: tokensUsed,
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const updatedMessages = s.messages.map(m => {
            if (m.id === messageId) {
              const updatedBranches = m.branches ? [...m.branches] : [];
              const activeIdx = m.activeBranchIndex ?? 0;
              updatedBranches[activeIdx] = [aiResponse];
              return { ...m, branches: updatedBranches };
            }
            return m;
          });
          return { ...s, messages: [...updatedMessages, aiResponse] };
        }
        return s;
      }));

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
          return { ...s, messages: [...updatedMessages, systemError] };
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
      let branches = targetMsg.branches ? [...targetMsg.branches] : [];
      let activeBranchIndex = targetMsg.activeBranchIndex ?? 0;

      if (branches.length <= 1) return session;

      const subsequentMessages = session.messages.slice(idx + 1);
      branches[activeBranchIndex] = subsequentMessages;

      let newIndex = activeBranchIndex;
      if (direction === "prev") {
        newIndex = activeBranchIndex === 0 ? branches.length - 1 : activeBranchIndex - 1;
      } else {
        newIndex = activeBranchIndex === branches.length - 1 ? 0 : activeBranchIndex + 1;
      }

      targetMsg.branches = branches;
      targetMsg.activeBranchIndex = newIndex;

      const nextMessages = [...session.messages.slice(0, idx), targetMsg, ...branches[newIndex]];

      return {
        ...session,
        messages: nextMessages
      };
    }));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && attachments.length === 0 || isLoading) return;

    const userText = inputText;
    const filePathsToSend = attachments.map(a => a.path);

    const userMessage: Message = { 
      id: Date.now().toString(), 
      sender: "user", 
      text: userText,
      timestamp: Date.now(),
      filePaths: filePathsToSend
    };

    const proposedMessages = [...activeSession.messages, userMessage];

    if (!validateAlternatingOrder(proposedMessages)) {
      setWarningMessage("⚠️ 对话未遵循 ai--用户 顺序结构，请删除对应气泡后再发送。");
      setTimeout(() => {
        setWarningMessage(null);
      }, 3000);
      return;
    }

    let currentMessages = [...activeSession.messages, userMessage];
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
          messages: [{ role: "system", content: "You are a helpful assistant" }, ...apiMessages],
          file_paths: filePathsToSend
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "请求失败");
      }

      const data = await response.json();
      
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
        provider: selectedModel.toLowerCase().includes("deepseek") ? "deepseek" : "ollama",
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
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  chatFontSize={chatFontSize}
                  onMsgContextMenu={handleMsgContextMenu}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onSwitchBranch={handleSwitchBranch}
                />
              ))}
              {isLoading && (
                <div className="flex gap-4 justify-start">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0 select-none">🤖</div>
                  <div 
                    style={{ fontSize: chatFontSize }}
                    className="bg-[#2e2e2e] text-gray-400 border border-[#3a3a3a] p-3.5 rounded-xl flex items-center gap-2"
                  >
                    <Loader size={12} className="animate-spin text-[#4ea1db]" />
                    <span>{selectedModel.toLowerCase().includes("deepseek") ? "DeepSeek 正在思考中..." : "本地模型正在推理中..."}</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* 底部输入框区 */}
        <ChatInput
          inputText={inputText}
          setInputText={setInputText}
          isLoading={isLoading}
          attachments={attachments}
          selectedModel={selectedModel}
          availableModels={availableModels}
          showModelDropdown={showModelDropdown}
          setShowModelDropdown={setShowModelDropdown}
          setSelectedModel={setSelectedModel}
          onSelectFiles={handleSelectFiles}
          onRemoveAttachment={handleRemoveAttachment}
          onSendMessage={handleSendMessage}
        />

      </div>

      {/* 3. 侧边栏对话删除菜单 */}
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
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300 transition-colors text-left cursor-pointer"
          >
            <Trash2 size={13} />
            <span>删除对话</span>
          </button>
        </div>
      )}

      {/* 4. 对话气泡右键多功能菜单 */}
      {msgContextMenu.visible && (
        <div 
          style={{ top: msgContextMenu.y, left: msgContextMenu.x }}
          className="fixed bg-[#232324] border border-[#38383a] rounded-lg shadow-2xl py-1 w-44 z-[9999] animate-in fade-in duration-100 font-sans"
        >
          <button
            onClick={() => {
              if (msgContextMenu.targetMessageId) {
                handleStartEdit(msgContextMenu.targetMessageId);
              }
              setMsgContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors text-left cursor-pointer"
          >
            <Edit3 size={13} className="text-blue-400" />
            <span>编辑此消息</span>
          </button>

          {msgContextMenu.targetMessageSender === "user" && (
            <button
              onClick={() => {
                if (msgContextMenu.targetMessageId) {
                  handleResendMessage(msgContextMenu.targetMessageId);
                }
                setMsgContextMenu(prev => ({ ...prev, visible: false }));
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-[#333] hover:text-white transition-colors text-left border-t border-[#303030] cursor-pointer"
            >
              <RefreshCw size={13} className="text-amber-400" />
              <span>发送这条消息 (新分支)</span>
            </button>
          )}

          <button
            onClick={() => {
              if (msgContextMenu.targetMessageId) {
                handleDeleteMessage(msgContextMenu.targetMessageId);
              }
              setMsgContextMenu(prev => ({ ...prev, visible: false }));
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-[#333] hover:text-red-300 transition-colors text-left border-t border-[#303030] cursor-pointer"
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
