// src/hooks/useChatManager.ts
// 负责处理所有的聊天状态、流式请求和业务逻辑
import { useState, useRef, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Message, ChatSession, AttachmentFile, getFileType, Role } from "../types/chat";
import { ApiProviderConfig } from "../components/SettingsModal";

const STORAGE_KEY = "tangerine_chat_sessions";
const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";
const SETTINGS_STORAGE_KEY = "tangerine_api_settings";
const ROLES_STORAGE_KEY = "tangerine_roles";

interface ResolvedModelConfig {
  provider: string;
  model: string;
  baseUrl?: string;
  envKeyName?: string;
}

interface ModelOption {
  model: string;
  providerName: string;
  category: "ollama" | "cloud";
  baseUrl?: string;
  envKeyName?: string;
}

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

  // 默认模型不再固定绑定 deepseek，优先在同步配置时自动矫正
  const [selectedModel, setSelectedModel] = useState<string>("");

  // 兼容现有 ChatInput 逻辑，仍输出字符串数组
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  // 新增：给模型下拉展示 provider / category / baseUrl 等信息
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

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

    const handleRolesChanged = () => {
      const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
      if (savedRoles) {
        try {
          setRoles(JSON.parse(savedRoles));
        } catch (e) {
          console.error("同步角色数据失败：", e);
        }
      } else {
        setRoles([]);
      }
    };

    const handleApiSettingsChanged = () => {
      syncModelsFromSettings();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tangerine_roles_changed", handleRolesChanged as EventListener);
    window.addEventListener("tangerine_api_settings_changed", handleApiSettingsChanged as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tangerine_roles_changed", handleRolesChanged as EventListener);
      window.removeEventListener("tangerine_api_settings_changed", handleApiSettingsChanged as EventListener);
    };
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
    } else {
      setRoles([]);
    }
  }, [showRoles]);

  const getSavedApiConfigs = (): ApiProviderConfig[] => {
    const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedConfigs) return [];
    try {
      const parsed = JSON.parse(savedConfigs);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("读取 API 配置失败：", e);
      return [];
    }
  };

  // 仅归类为 ollama模型 / 云端模型，不再做 deepseek / gemini / 其他 的硬编码归属
  const getModelCategoryFromConfig = (config?: ApiProviderConfig): "ollama" | "cloud" => {
    if (!config) return "cloud";
    const providerLower = config.providerName.trim().toLowerCase();
    const baseUrlLower = config.baseUrl.trim().toLowerCase();

    if (
      providerLower === "ollama" ||
      baseUrlLower.includes("127.0.0.1:11434") ||
      baseUrlLower.includes("localhost:11434")
    ) {
      return "ollama";
    }

    return "cloud";
  };

  const findConfigByModel = (model: string): ApiProviderConfig | undefined => {
    const configs = getSavedApiConfigs();
    return configs.find(cfg => Array.isArray(cfg.models) && cfg.models.includes(model));
  };

  const inferProviderNameByModelFallback = (model: string): string => {
    const matchedConfig = findConfigByModel(model);
    if (matchedConfig?.providerName?.trim()) return matchedConfig.providerName.trim();
    return "未命名提供商";
  };

  const resolveModelConfig = (model: string, providerOverride?: string): ResolvedModelConfig => {
    const matchedConfig = findConfigByModel(model);

    if (matchedConfig) {
      return {
        provider: providerOverride?.trim() || matchedConfig.providerName,
        model,
        baseUrl: matchedConfig.baseUrl,
        envKeyName: matchedConfig.envKeyName
      };
    }

    return {
      provider: providerOverride?.trim() || inferProviderNameByModelFallback(model),
      model,
      baseUrl: undefined,
      envKeyName: undefined
    };
  };

  const getModelOptionByName = (model: string): ModelOption | undefined => {
    return modelOptions.find(item => item.model === model);
  };

  const syncModelsFromSettings = () => {
    const parsed = getSavedApiConfigs();

    const options: ModelOption[] = parsed.flatMap(cfg => {
      const models = Array.isArray(cfg.models) ? cfg.models.filter(Boolean) : [];
      const category = getModelCategoryFromConfig(cfg);

      return models.map(model => ({
        model,
        providerName: cfg.providerName || "未命名提供商",
        category,
        baseUrl: cfg.baseUrl,
        envKeyName: cfg.envKeyName
      }));
    });

    const allModels = options.map(item => item.model);

    if (allModels.length > 0) {
      setModelOptions(options);
      setAvailableModels(allModels);
      setSelectedModel(prev => {
        if (prev && allModels.includes(prev)) return prev;
        return allModels[0];
      });
      return;
    }

    const fallbackModels = ["deepseek-v4-flash", "deepseek-v4-pro"];
    setModelOptions(fallbackModels.map(model => ({
      model,
      providerName: "未命名提供商",
      category: "cloud"
    })));
    setAvailableModels(fallbackModels);
    setSelectedModel(prev => (prev && fallbackModels.includes(prev) ? prev : fallbackModels[0]));
  };

  const getRoleResolvedModelInfo = (session?: ChatSession): ResolvedModelConfig => {
    const fallbackResolved = resolveModelConfig(selectedModel);

    if (!session?.roleId) {
      return fallbackResolved;
    }

    const role = roles.find(r => r.id === session.roleId);
    if (role?.model?.trim()) {
      return resolveModelConfig(role.model.trim(), role.provider?.trim());
    }

    return fallbackResolved;
  };

  // 通过 Rust 命令直接读取图片并返回 data URL
  const createImagePreview = async (path: string, name: string): Promise<{ previewUrl?: string; previewError?: string }> => {
    try {
      const previewUrl = await invoke<string>("read_image_as_data_url", { path });
      return { previewUrl };
    } catch (error: any) {
      const message = error?.message || String(error) || "未知错误";
      console.error("调用 Rust 图片读取命令失败：", { path, name, error });
      return {
        previewError: `图片读取失败：${message}`
      };
    }
  };

  // 根据本地绝对路径构建附件对象
  const buildAttachmentFromPath = async (path: string): Promise<AttachmentFile> => {
    const parts = path.split(/[\\/]/);
    const name = parts[parts.length - 1] || "未命名文件";
    const type = getFileType(name);

    const attachment: AttachmentFile = {
      name,
      path,
      type
    };

    if (type === "image") {
      const previewResult = await createImagePreview(path, name);
      attachment.previewUrl = previewResult.previewUrl;
      attachment.previewError = previewResult.previewError;
    }

    return attachment;
  };

  const mergeAttachments = async (incomingPaths: string[]) => {
    const normalizedPaths = incomingPaths
      .filter(Boolean)
      .map(p => p.trim())
      .filter(Boolean);

    if (normalizedPaths.length === 0) return;

    const uniqueIncomingPaths = Array.from(new Set(normalizedPaths));
    const newAttachments = await Promise.all(uniqueIncomingPaths.map(buildAttachmentFromPath));

    const failedImages = newAttachments.filter(file => file.type === "image" && !file.previewUrl);
    if (failedImages.length > 0) {
      console.warn("以下图片未能生成预览：", failedImages);
      setWarningMessage("⚠️ 某些图片未能生成预览，请检查 Rust 终端输出。");
      setTimeout(() => setWarningMessage(null), 4000);
    }

    setAttachments(prev => {
      const existingPaths = new Set(prev.map(a => a.path));
      const filteredNew = newAttachments.filter(a => !existingPaths.has(a.path));
      return [...prev, ...filteredNew];
    });
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

  useEffect(() => {
    const closeDropdowns = () => {
      setShowModelDropdown(false);
      setShowRoleDropdown(false);
    };

    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const registerDragDropListener = async () => {
      try {
        const currentWindow = getCurrentWindow();
        unlisten = await currentWindow.onDragDropEvent(async (event) => {
          if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDraggingFiles(true);
            return;
          }

          if (event.payload.type === "leave") {
            setIsDraggingFiles(false);
            return;
          }

          if (event.payload.type === "drop") {
            setIsDraggingFiles(false);
            const paths = event.payload.paths || [];
            if (paths.length > 0) {
              await mergeAttachments(paths);
            }
          }
        });
      } catch (error) {
        console.error("注册 Tauri 原生拖放监听失败：", error);
      }
    };

    registerDragDropListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

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
    setShowModelDropdown(false);
    setShowRoleDropdown(false);
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
      const selected = await open({
        multiple: true,
        directory: false,
        title: "选择要附加到对话中的文件",
        filters: [
          {
            name: "支持的文件",
            extensions: [
              "txt", "md", "json", "yaml", "yml", "py", "js", "ts", "tsx", "jsx", "html", "css",
              "rs", "go", "java", "cpp", "c", "h", "hpp", "cs", "php", "sh", "bat", "ps1", "sql", "xml", "csv",
              "jpg", "jpeg", "png", "gif", "webp", "bmp",
              "mp3", "wav", "ogg", "m4a",
              "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"
            ]
          },
          {
            name: "所有文件",
            extensions: ["*"]
          }
        ]
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      await mergeAttachments(paths);
    } catch (e) {
      console.error("调用 Tauri 原生文件选择器失败:", e);
      setWarningMessage("⚠️ 打开系统文件选择器失败。");
      setTimeout(() => setWarningMessage(null), 3000);
    }
  };

  const handleDropFiles = async (paths: string[]) => {
    await mergeAttachments(paths);
    setIsDraggingFiles(false);
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePreviewImage = (file: AttachmentFile) => {
    if (file.type !== "image" || !file.previewUrl) {
      console.warn("当前附件不是可预览图片或预览生成失败：", file);
      if (file.previewError) {
        setWarningMessage(`⚠️ ${file.previewError}`);
        setTimeout(() => setWarningMessage(null), 4000);
      }
      return;
    }
    setPreviewImage({ url: file.previewUrl, name: file.name });
  };

  const handleCloseImagePreview = () => {
    setPreviewImage(null);
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
    const resolvedModelInfo = getRoleResolvedModelInfo(session);

    const initialAiResponse: Message = {
      id: streamAiMessageId,
      sender: "ai",
      text: "",
      provider: resolvedModelInfo.provider,
      model: resolvedModelInfo.model,
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

    await executeStreamChat(
      precedingMessages,
      targetMsg.filePaths || [],
      getActiveSystemPrompt(session),
      streamAiMessageId,
      messageId,
      session
    );
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
    setShowModelDropdown(false);
    setShowRoleDropdown(false);

    const streamAiMessageId = (Date.now() + 1).toString();
    const resolvedModelInfo = getRoleResolvedModelInfo(currentSessionSnapshot);

    const initialAiResponse: Message = {
      id: streamAiMessageId,
      sender: "ai",
      text: "",
      provider: resolvedModelInfo.provider,
      model: resolvedModelInfo.model,
      timestamp: Date.now(),
      sources: []
    };

    setSessions(prev => prev.map(session => {
      if (session.id === activeSessionId) {
        return { ...session, messages: [...session.messages, initialAiResponse] };
      }
      return session;
    }));

    await executeStreamChat(
      currentMessages,
      finalFilePaths,
      getActiveSystemPrompt(currentSessionSnapshot),
      streamAiMessageId,
      undefined,
      currentSessionSnapshot
    );
  };

  const executeStreamChat = async (
    messageContext: Message[],
    filePathsToSend: string[],
    finalSystemPrompt: string,
    streamAiMessageId: string,
    branchParentId?: string,
    sessionSnapshot?: ChatSession
  ) => {
    try {
      const apiMessages = messageContext
        .filter(m => m.sender !== "system_err")
        .map(m => ({
          role: m.sender === "user" ? "user" : "assistant",
          content: m.text
        }));

      const resolvedModelInfo = getRoleResolvedModelInfo(sessionSnapshot || activeSession);

      const response = await fetch("http://127.0.0.1:5678/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: resolvedModelInfo.model,
          provider: resolvedModelInfo.provider,
          base_url: resolvedModelInfo.baseUrl,
          env_key_name: resolvedModelInfo.envKeyName,
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
      let streamErrorMessage = "";

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

            // 修复：一旦后端通过 SSE 返回 error，不再只在局部 try 中吞掉，
            // 而是记录错误并抛到外层 catch，确保 system_err 气泡能被渲染。
            if (parsedData.error) {
              streamErrorMessage = parsedData.error;
              throw new Error(parsedData.error);
            }

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
            // 如果是模型/后端明确报错，立即中断并进入外层 catch
            if (streamErrorMessage || String(e?.message || "").trim()) {
              throw e;
            }
            console.error("解析流式行失败:", e);
          }
        }
      }

      // 修复：如果服务端在最后一段 buffer 中返回错误但未被 lines 完整消费，也要补解析一次
      if (buffer.trim().startsWith("data: ")) {
        const rawData = buffer.trim().slice(6).trim();
        if (rawData && rawData !== "[DONE]") {
          try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.error) {
              throw new Error(parsedData.error);
            }
          } catch (e: any) {
            throw e;
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
      sessions,
      activeSessionId,
      inputText,
      isLoading,
      attachments,
      selectedModel,
      availableModels,
      modelOptions,
      showModelDropdown,
      showRoleDropdown,
      showSettings,
      showRoles,
      warningMessage,
      webSearchMode,
      roles,
      chatFontSize,
      contextMenu,
      msgContextMenu,
      activeSession,
      activeRole,
      isActiveSessionEmpty,
      isDraggingFiles,
      previewImage
    },
    refs: { messagesEndRef },
    actions: {
      setSessions,
      setActiveSessionId,
      setInputText,
      setSelectedModel,
      setShowModelDropdown,
      setShowRoleDropdown,
      setShowSettings,
      setShowRoles,
      setWarningMessage,
      setWebSearchMode,
      setContextMenu,
      setMsgContextMenu,
      setIsDraggingFiles,
      handleCreateSession,
      handleCreateAutomationSession,
      handleContextMenu,
      handleMsgContextMenu,
      handleSaveEdit,
      handleCancelEdit,
      handleSelectFiles,
      handleDropFiles,
      handleRemoveAttachment,
      handlePreviewImage,
      handleCloseImagePreview,
      handleSelectRole,
      handleSwitchBranch,
      handleResendMessage,
      handleSendMessage,
      getModelOptionByName
    }
  };
}