// src/hooks/chat/useChatUIState.ts
// 负责管理聊天界面的纯 UI 状态（输入框、菜单、弹窗、警告等）及相关的 Window 事件监听
import { useState, useRef, useEffect } from "react";
import { Message } from "../../types/chat";

const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";

export function useChatUIState() {
  const [inputText, setInputText] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

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

  const [chatFontSize, setChatFontSize] = useState<string>(() => {
    return localStorage.getItem(FONT_SIZE_STORAGE_KEY) || "12px";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 监听 localStorage 变化以同步字体大小
  useEffect(() => {
    const handleStorageChange = () => {
      const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (savedSize) setChatFontSize(savedSize);
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // 关闭设置面板时同步字体大小
  useEffect(() => {
    if (!showSettings) {
      const savedSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (savedSize) setChatFontSize(savedSize);
    }
  }, [showSettings]);

  // 点击空白处关闭下拉菜单
  useEffect(() => {
    const closeDropdowns = () => {
      setShowModelDropdown(false);
      setShowRoleDropdown(false);
    };
    window.addEventListener("click", closeDropdowns);
    return () => window.removeEventListener("click", closeDropdowns);
  }, []);

  const handleCloseImagePreview = () => setPreviewImage(null);

  return {
    inputText, setInputText,
    showModelDropdown, setShowModelDropdown,
    showRoleDropdown, setShowRoleDropdown,
    showSettings, setShowSettings,
    showRoles, setShowRoles,
    warningMessage, setWarningMessage,
    isDraggingFiles, setIsDraggingFiles,
    previewImage, setPreviewImage,
    contextMenu, setContextMenu,
    msgContextMenu, setMsgContextMenu,
    chatFontSize, setChatFontSize,
    messagesEndRef,
    handleCloseImagePreview
  };
}