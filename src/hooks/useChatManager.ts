// src/hooks/useChatManager.ts
// 负责处理所有的聊天状态、流式请求和业务逻辑
import { useState, useRef, useEffect } from "react";
import { Message, ChatSession, AttachmentFile, getFileType, Role } from "../types/chat";
import { ApiProviderConfig } from "../components/SettingsModal";

const STORAGE_KEY = "tangerine_chat_sessions";
const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";
const SETTINGS_STORAGE_KEY = "tangerine_api_settings";
const ROLES_STORAGE_KEY = "tangerine_roles";

export function useChatManager() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("解析历史对话失败：", e);
      }
    }
    return [{ id: "1", title: "agent微框架编程助手", messages: [], type: "chat" }];
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
  const [showRoles, setShowRoles] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const [webSearchMode, setWebSearchMode] = useState<"off" | "direct" | "agent">("off");

  const [roles, setRoles] = useState<Role[]>(() => {
    const saved = localStorage.getItem(ROLES_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("解析角色数据失败：", e);
      }
    }
    return [];
  });

  const [chatFontSize, setChatFontSize] = useState<string>(() => {
    return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "12px";
  });

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
  const activeRole = roles.find(r => r.id === activeSession?.roleId);
  const isActiveSessionEmpty = !!activeSession && activeSession.messages.length === 0;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCountRef = useRef<number>(0);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    const handleStorageChange = () => {
      const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (savedSize) setChatFontSize(savedSize);

      const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
      if (savedRoles) {
        try {
          setRoles(JSON.parse(savedRoles));
        } catch (e) {
          console.error("同步角色数据失败：", e);
        }
      }
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

  useEffect(() => {
    const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
    if (savedRoles) {
      try {
        setRoles(JSON.parse(savedRoles));
      } catch (e) {
        console.error("加载角色数据失败：", e);
      }
    }
  }, [showRoles]);

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

  const getActiveSystemPrompt = (session?: ChatSession): string => {
    if (!session?.roleId) return "You are a helpful assistant";
    const role = roles.find(r => r.id === session.roleId);
    return role?.systemPrompt?.trim() || "You are a helpful assistant";
  };

  const extractTextDelta = (parsedData: any): string => {
    if (!parsedData) return "";
    if (typeof parsedData === "string") return parsedData;
    return (
      parsedData.text ??
      parsedData.delta ??
      parsedData.content ??
      parsedData.message ??
      parsedData.choices?.[0]?.delta?.content ??
      parsedData.choices?.[0]?.message?.content ??
      ""
    );
  };

  const extractSources = (parsedData: any): Array<{ title: string; url: string }> | undefined => {
    if (!parsedData) return undefined;
    if (Array.isArray(parsedData.sources)) return parsedData.sources;
    if (Array.isArray(parsedData.references)) return parsedData.references;
    return undefined;
  };

  const extractTokensUsed = (parsedData: any): number | undefined => {
    return (
      parsedData?.tokensUsed ??
      parsedData?.tokens_used ??
      parsedData?.usage?.total_tokens ??
      parsedData?.usage?.total_token ??
      undefined
    );
  };

  const handleCreateSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "新对话",
      messages: [],
      type: "chat"
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleCreateAutomationSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "新自动化流程",
      messages: [],
      type: "automation"
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
      if (s.id !== activeSessionId) return s;
      const updatedMessages = s.messages.map(m => {
        if (m.id === messageId) return { ...m, text: newText, isEditing: false };
        return m;
      });
      return { ...s, messages: updatedMessages };
    }));
  };

  const handleCancelEdit = (messageId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      const updatedMessages = s.messages.map(m => {
        if (m.id === messageId) return { ...m, isEditing: false };
        return m;
      });
      return { ...s, messages: updatedMessages };
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
          return { name, path: p, type: getFileType(name) };
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

  const handleSelectRole = (roleId: string) => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    if (session.messages.length > 0) {
      setWarningMessage("⚠️ 只能在空白对话中选择或切换角色。");
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) return { ...s, roleId: roleId || undefined };
      return s;
    }));
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
      if (s.id === activeSessionId) return { ...s, messages: newMessagesList };
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
      if (s.id !== activeSessionId) return s;

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
    }));

    await executeStreamChat(precedingMessages, targetMsg.filePaths || [], getActiveSystemPrompt(session), streamAiMessageId, messageId);
  };

  const handleSendMessage = async (customText?: any, filePathsOverride?: string[]) => {
    if (isLoading) return;

    let userText = typeof customText === "string" ? customText : inputText;
    const finalFilePaths = filePathsOverride !== undefined ? filePathsOverride : attachments.map(a => a.path);

    if (!userText.trim() && finalFilePaths.length === 0) return;

    const currentSessionSnapshot = sessions.find(s => s.id === activeSessionId);
    if (!currentSessionSnapshot) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: Date.now(),
      filePaths: finalFilePaths
    };

    const currentMessages = [...currentSessionSnapshot.messages, userMessage];

    if (!validateAlternatingOrder(currentMessages)) {
      setWarningMessage("⚠️ 对话未遵循 [User-AI] 交替架构，请点击右键清理系统报错或多余消息。");
      setTimeout(() => setWarningMessage(null), 3500);
      return;
    }

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

    await executeStreamChat(currentMessages, finalFilePaths, getActiveSystemPrompt(currentSessionSnapshot), streamAiMessageId);
  };

  // 内部辅助函数：处理流式读取及错误熔断
  const executeStreamChat = async (messageContext: Message[], filePathsToSend: string[], finalSystemPrompt: string, streamAiMessageId: string, branchParentId?: string) => {
    try {
      const apiMessages = messageContext
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
          provider: getProviderByModel(selectedModel),
          messages: [{ role: "system", content: finalSystemPrompt }, ...apiMessages],
          file_paths: filePathsToSend,
          web_search: webSearchMode
        })
      });

      if (!response.ok) {
        let message = "请求失败";
        try {
          const errData = await response.json();
          message = errData.detail || message;
        } catch {}
        throw new Error(message);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      if (!reader) throw new Error("流式数据读取器初始化失败！");

      let streamDone = false;
      while (!streamDone) {
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
            streamDone = true;
            break;
          }

          try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.error) throw new Error(parsedData.error);

            const textDelta = extractTextDelta(parsedData);
            const sources = extractSources(parsedData);
            const tokensUsed = extractTokensUsed(parsedData);

            if (!textDelta && !sources && tokensUsed === undefined) continue;

            setSessions(prev => prev.map(s => {
              if (s.id !== activeSessionId) return s;

              const updatedMessages = s.messages.map(m => {
                if (m.id === streamAiMessageId) {
                  return {
                    ...m,
                    text: textDelta ? m.text + textDelta : m.text,
                    sources: sources && sources.length > 0 ? sources : m.sources,
                    tokensUsed: tokensUsed !== undefined ? tokensUsed : m.tokensUsed
                  };
                }

                if (branchParentId && m.id === branchParentId) {
                  const updatedBranches = m.branches ? [...m.branches] : [];
                  const activeIdx = m.activeBranchIndex ?? 0;
                  const branchList = updatedBranches[activeIdx] || [];

                  const updatedBranchList = branchList.map(bm => {
                    if (bm.id === streamAiMessageId) {
                      return {
                        ...bm,
                        text: textDelta ? bm.text + textDelta : bm.text,
                        sources: sources && sources.length > 0 ? sources : bm.sources,
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
          if (branchParentId) {
            const updatedMessages = session.messages.map(m => {
              if (m.id === branchParentId) {
                const updatedBranches = m.branches ? [...m.branches] : [];
                const activeIdx = m.activeBranchIndex ?? 0;
                updatedBranches[activeIdx] = [systemError];
                return { ...m, branches: updatedBranches };
              }
              return m;
            });
            const cleanMsgs = updatedMessages.filter(m => m.id !== streamAiMessageId);
            return { ...session, messages: [...cleanMsgs, systemError] };
          }

          const cleanMsgs = session.messages.filter(m => m.id !== streamAiMessageId);
          return { ...session, messages: [...cleanMsgs, systemError] };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    state: {
      sessions, activeSessionId, inputText, isLoading, attachments, selectedModel, availableModels,
      showModelDropdown, showSettings, showRoles, warningMessage, webSearchMode, roles, chatFontSize,
      contextMenu, msgContextMenu, activeSession, activeRole, isActiveSessionEmpty
    },
    refs: { messagesEndRef },
    actions: {
      setSessions, setActiveSessionId, setInputText, setSelectedModel, setShowModelDropdown, setShowSettings,
      setShowRoles, setWarningMessage, setWebSearchMode, setContextMenu, setMsgContextMenu,
      handleCreateSession, handleCreateAutomationSession, handleContextMenu, handleMsgContextMenu,
      handleSaveEdit, handleCancelEdit, handleSelectFiles, handleRemoveAttachment, handleSelectRole,
      handleSwitchBranch, handleResendMessage, handleSendMessage
    }
  };
}
