// src/hooks/useChatManager.ts
// 聊天核心状态管理主入口：组合子 Hooks，处理跨模块副作用，对外提供统一接口
import { useState, useEffect, useRef } from "react";
import { Message } from "../types/chat";

// 导入解耦后的子 Hooks
import { useChatUIState } from "./chat/useChatUIState";
import { useModelManager } from "./chat/useModelManager";
import { useAttachmentManager } from "./chat/useAttachmentManager";
import { useSessionManager } from "./chat/useSessionManager";
import { useStreamChat } from "./chat/useStreamChat";

const ROLES_STORAGE_KEY = "tangerine_roles";

export function useChatManager() {
  // 1. 初始化 UI 状态管理
  const uiState = useChatUIState();

  // 2. 初始化会话与角色管理 (依赖 UI 的 warning 提示)
  const sessionManager = useSessionManager(uiState.setWarningMessage);

  // 3. 初始化模型管理 (依赖会话中的 roles 数据)
  const modelManager = useModelManager(sessionManager.roles);

  // 4. 初始化附件管理 (依赖 UI 的 warning 提示和拖拽状态)
  const attachmentManager = useAttachmentManager(
    uiState.setWarningMessage, 
    uiState.setIsDraggingFiles
  );

  // 5. 独立管理 Loading 状态 (因为流式请求和 UI 都需要频繁读写)
  const [isLoading, setIsLoading] = useState(false);

  // 6. 初始化流式聊天管理 (注入所有必要的依赖)
  const streamChat = useStreamChat({
    sessions: sessionManager.sessions,
    setSessions: sessionManager.setSessions,
    activeSessionId: sessionManager.activeSessionId,
    activeSession: sessionManager.activeSession,
    inputText: uiState.inputText,
    setInputText: uiState.setInputText,
    attachments: attachmentManager.attachments,
    setAttachments: attachmentManager.setAttachments,
    isLoading,
    setIsLoading,
    getRoleResolvedModelInfo: modelManager.getRoleResolvedModelInfo,
    getActiveSystemPrompt: sessionManager.getActiveSystemPrompt,
    setWarningMessage: uiState.setWarningMessage,
    setShowModelDropdown: uiState.setShowModelDropdown,
    setShowRoleDropdown: uiState.setShowRoleDropdown,
    webSearchMode: modelManager.webSearchMode
  });

  // ================= 跨模块副作用与联动逻辑 =================

  // 自动滚动到底部逻辑
  const prevMessagesCountRef = useRef<number>(0);
  useEffect(() => {
    const currentMessagesCount = sessionManager.activeSession?.messages?.length || 0;
    if (currentMessagesCount > prevMessagesCountRef.current) {
      uiState.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesCountRef.current = currentMessagesCount;
  }, [sessionManager.activeSession?.messages?.length]);

  // 设置面板关闭时同步模型列表
  useEffect(() => {
    if (!uiState.showSettings) {
      modelManager.syncModelsFromSettings();
    }
  }, [uiState.showSettings]);

  // 角色面板打开/关闭时同步角色数据
  useEffect(() => {
    const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
    if (savedRoles) {
      try {
        sessionManager.setRoles(JSON.parse(savedRoles));
      } catch (e) {
        console.error("加载角色数据失败：", e);
      }
    } else {
      sessionManager.setRoles([]);
    }
  }, [uiState.showRoles]);

  // ================= 封装需要跨模块调用的 Actions =================

  // 创建新会话时关闭下拉菜单
  const handleCreateSession = () => {
    sessionManager.handleCreateSession();
    uiState.setShowModelDropdown(false);
    uiState.setShowRoleDropdown(false);
  };

  // 处理会话右键菜单 (状态存储在 UI 中)
  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    uiState.setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetSessionId: sessionId
    });
  };

  // 处理消息右键菜单 (状态存储在 UI 中)
  const handleMsgContextMenu = (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => {
    e.preventDefault();
    uiState.setMsgContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetMessageId: messageId,
      targetMessageSender: sender
    });
  };

  // 处理图片预览 (状态存储在 UI 中)
  const handlePreviewImage = (file: any) => {
    if (file.type !== "image" || !file.previewUrl) {
      console.warn("当前附件不是可预览图片或预览生成失败：", file);
      if (file.previewError) {
        uiState.setWarningMessage(`⚠️ ${file.previewError}`);
        setTimeout(() => uiState.setWarningMessage(null), 4000);
      }
      return;
    }
    uiState.setPreviewImage({ url: file.previewUrl, name: file.name });
  };

  // ================= 对外暴露统一接口 (保持与原文件 100% 兼容) =================

  return {
    state: {
      sessions: sessionManager.sessions,
      activeSessionId: sessionManager.activeSessionId,
      inputText: uiState.inputText,
      isLoading,
      attachments: attachmentManager.attachments,
      selectedModel: modelManager.selectedModel,
      availableModels: modelManager.availableModels,
      modelOptions: modelManager.modelOptions,
      showModelDropdown: uiState.showModelDropdown,
      showRoleDropdown: uiState.showRoleDropdown,
      showSettings: uiState.showSettings,
      showRoles: uiState.showRoles,
      warningMessage: uiState.warningMessage,
      webSearchMode: modelManager.webSearchMode,
      roles: sessionManager.roles,
      chatFontSize: uiState.chatFontSize,
      contextMenu: uiState.contextMenu,
      msgContextMenu: uiState.msgContextMenu,
      activeSession: sessionManager.activeSession,
      activeRole: sessionManager.activeRole,
      isActiveSessionEmpty: sessionManager.isActiveSessionEmpty,
      isDraggingFiles: uiState.isDraggingFiles,
      previewImage: uiState.previewImage
    },
    refs: { 
      messagesEndRef: uiState.messagesEndRef 
    },
    actions: {
      setSessions: sessionManager.setSessions,
      setActiveSessionId: sessionManager.setActiveSessionId,
      setInputText: uiState.setInputText,
      setSelectedModel: modelManager.setSelectedModel,
      setShowModelDropdown: uiState.setShowModelDropdown,
      setShowRoleDropdown: uiState.setShowRoleDropdown,
      setShowSettings: uiState.setShowSettings,
      setShowRoles: uiState.setShowRoles,
      setWarningMessage: uiState.setWarningMessage,
      setWebSearchMode: modelManager.setWebSearchMode,
      setContextMenu: uiState.setContextMenu,
      setMsgContextMenu: uiState.setMsgContextMenu,
      setIsDraggingFiles: uiState.setIsDraggingFiles,
      
      handleCreateSession,
      handleCreateAutomationSession: sessionManager.handleCreateAutomationSession,
      handleContextMenu,
      handleMsgContextMenu,
      handleSaveEdit: sessionManager.handleSaveEdit,
      handleCancelEdit: sessionManager.handleCancelEdit,
      handleDeleteMessage: sessionManager.handleDeleteMessage,
      
      handleSelectFiles: attachmentManager.handleSelectFiles,
      handleDropFiles: attachmentManager.handleDropFiles,
      handleRemoveAttachment: attachmentManager.handleRemoveAttachment,
      handlePreviewImage,
      handleCloseImagePreview: uiState.handleCloseImagePreview,
      
      handleSelectRole: sessionManager.handleSelectRole,
      handleSwitchBranch: sessionManager.handleSwitchBranch,
      handleResendMessage: streamChat.handleResendMessage,
      handleSendMessage: streamChat.handleSendMessage,
      handleStopGeneration: streamChat.handleStopGeneration,
      
      getModelOptionByName: modelManager.getModelOptionByName
    }
  };
}