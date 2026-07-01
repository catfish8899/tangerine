// src/hooks/useChatManager.ts
import { useState, useEffect, useRef } from "react";
import { Message } from "../types/chat";
import { useChatUIState } from "./chat/useChatUIState";
import { useModelManager } from "./chat/useModelManager";
import { useAttachmentManager } from "./chat/useAttachmentManager";
import { useSessionManager } from "./chat/useSessionManager";
import { useStreamChat } from "./chat/useStreamChat";

const ROLES_STORAGE_KEY = "tangerine_roles";

export function useChatManager() {
  const uiState = useChatUIState();
  const sessionManager = useSessionManager(uiState.setWarningMessage);
  const modelManager = useModelManager(sessionManager.roles);
  
  const attachmentManager = useAttachmentManager(
    sessionManager.activeSessionId,
    uiState.setWarningMessage, 
    uiState.setIsDraggingFiles
  );

  const [isLoading, setIsLoading] = useState(false);

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

  const prevMessagesCountRef = useRef<number>(0);
  useEffect(() => {
    const currentMessagesCount = sessionManager.activeSession?.messages?.length || 0;
    if (currentMessagesCount > prevMessagesCountRef.current) {
      uiState.messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessagesCountRef.current = currentMessagesCount;
  }, [sessionManager.activeSession?.messages?.length]);

  useEffect(() => {
    if (!uiState.showSettings) {
      modelManager.syncModelsFromSettings();
    }
  }, [uiState.showSettings]);

  useEffect(() => {
    const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
    if (savedRoles) {
      try { sessionManager.setRoles(JSON.parse(savedRoles)); } 
      catch (e) { console.error("加载角色数据失败：", e); }
    } else {
      sessionManager.setRoles([]);
    }
  }, [uiState.showRoles]);

  const handleCreateSession = () => {
    sessionManager.handleCreateSession();
    uiState.setShowModelDropdown(false);
    uiState.setShowRoleDropdown(false);
  };

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    uiState.setContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetSessionId: sessionId });
  };

  const handleMsgContextMenu = (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => {
    e.preventDefault();
    uiState.setMsgContextMenu({ visible: true, x: e.clientX, y: e.clientY, targetMessageId: messageId, targetMessageSender: sender });
  };

  const handlePreviewImage = (file: any) => {
    if (file.type !== "image" || !file.previewUrl) { // 改回 previewUrl
      console.warn("当前附件不是可预览图片或预览生成失败：", file);
      if (file.previewError) {
        uiState.setWarningMessage(`⚠️ ${file.previewError}`);
        setTimeout(() => uiState.setWarningMessage(null), 4000);
      }
      return;
    }
    uiState.setPreviewImage({ url: file.previewUrl, name: file.name }); // 改回 previewUrl
  };

  return {
    state: {
      sessions: sessionManager.sessions, activeSessionId: sessionManager.activeSessionId,
      inputText: uiState.inputText, isLoading, attachments: attachmentManager.attachments,
      selectedModel: modelManager.selectedModel, availableModels: modelManager.availableModels,
      modelOptions: modelManager.modelOptions, showModelDropdown: uiState.showModelDropdown,
      showRoleDropdown: uiState.showRoleDropdown, showSettings: uiState.showSettings,
      showRoles: uiState.showRoles, warningMessage: uiState.warningMessage,
      webSearchMode: modelManager.webSearchMode, roles: sessionManager.roles,
      chatFontSize: uiState.chatFontSize, contextMenu: uiState.contextMenu,
      msgContextMenu: uiState.msgContextMenu, activeSession: sessionManager.activeSession,
      activeRole: sessionManager.activeRole, isActiveSessionEmpty: sessionManager.isActiveSessionEmpty,
      isDraggingFiles: uiState.isDraggingFiles, previewImage: uiState.previewImage
    },
    refs: { messagesEndRef: uiState.messagesEndRef },
    actions: {
      setSessions: sessionManager.setSessions, setActiveSessionId: sessionManager.setActiveSessionId,
      setInputText: uiState.setInputText, setSelectedModel: modelManager.setSelectedModel,
      setShowModelDropdown: uiState.setShowModelDropdown, setShowRoleDropdown: uiState.setShowRoleDropdown,
      setShowSettings: uiState.setShowSettings, setShowRoles: uiState.setShowRoles,
      setWarningMessage: uiState.setWarningMessage, setWebSearchMode: modelManager.setWebSearchMode,
      setContextMenu: uiState.setContextMenu, setMsgContextMenu: uiState.setMsgContextMenu,
      setIsDraggingFiles: uiState.setIsDraggingFiles,
      handleCreateSession, handleCreateAutomationSession: sessionManager.handleCreateAutomationSession,
      handleContextMenu, handleMsgContextMenu, handleSaveEdit: sessionManager.handleSaveEdit,
      handleCancelEdit: sessionManager.handleCancelEdit, handleDeleteMessage: sessionManager.handleDeleteMessage,
      handleSelectFiles: attachmentManager.handleSelectFiles, handleDropFiles: attachmentManager.handleDropFiles,
      handleRemoveAttachment: attachmentManager.handleRemoveAttachment, handlePreviewImage,
      handleCloseImagePreview: uiState.handleCloseImagePreview,
      handleSelectRole: sessionManager.handleSelectRole, handleSwitchBranch: sessionManager.handleSwitchBranch,
      handleResendMessage: streamChat.handleResendMessage, handleSendMessage: streamChat.handleSendMessage,
      handleStopGeneration: streamChat.handleStopGeneration, getModelOptionByName: modelManager.getModelOptionByName
    }
  };
}