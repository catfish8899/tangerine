import React from "react";
import {
  Send,
  Square,
  Paperclip,
  Globe
} from "lucide-react";
import { AttachmentFile, Role } from "../types/chat";
import AttachmentPreviewList from "./AttachmentPreviewList";
import RoleSelector from "./RoleSelector";
import ModelSelector from "./ModelSelector";

interface ModelOption {
  model: string;
  providerName: string;
  category: "ollama" | "cloud";
  baseUrl?: string;
  envKeyName?: string;
}

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  attachments: AttachmentFile[];
  selectedModel: string;
  availableModels: string[];
  modelOptions?: ModelOption[];
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  setSelectedModel: (modelName: string) => void;
  onSelectFiles: () => void;
  onRemoveAttachment: (idx: number) => void;
  onPreviewImage: (file: AttachmentFile) => void;
  onSendMessage: () => void;
  onStopGeneration: () => void; 
  webSearchMode: "off" | "agent";
  setWebSearchMode: (mode: "off" | "agent") => void;

  // 角色选择相关
  roles: Role[];
  activeRole?: Role;
  activeRoleId?: string;
  canSelectRole: boolean;
  showRoleDropdown: boolean;
  setShowRoleDropdown: (show: boolean) => void;
  onSelectRole: (roleId: string) => void;
}

export default function ChatInput({
  inputText,
  setInputText,
  isLoading,
  attachments,
  selectedModel,
  availableModels,
  modelOptions = [],
  showModelDropdown,
  setShowModelDropdown,
  setSelectedModel,
  onSelectFiles,
  onRemoveAttachment,
  onPreviewImage,
  onSendMessage,
  onStopGeneration,
  webSearchMode,
  setWebSearchMode,
  roles,
  activeRole,
  activeRoleId,
  canSelectRole,
  showRoleDropdown,
  setShowRoleDropdown,
  onSelectRole
}: ChatInputProps) {
  const handleToggleSearchMode = () => {
    setWebSearchMode(webSearchMode === "off" ? "agent" : "off");
  };

  const getSearchButtonStyles = () => {
    if (webSearchMode === "agent") {
      return {
        classes: "bg-[#2b3a4a] text-sky-400 border border-[#1e3d4e] hover:bg-[#344a5e]",
        title: "Tavily网络搜索：由模型构建搜索提示词，调用 Tavily 网络搜索服务",
        label: "Tavily网络搜索"
      };
    }

    return {
      classes: "text-gray-400 hover:text-white hover:bg-[#3a3a3a] border border-transparent",
      title: "联网搜索关闭",
      label: "联网关闭"
    };
  };

  const btnStyles = getSearchButtonStyles();

  return (
    <div className="p-5 md:p-6 bg-[#202020] border-t border-[#282828] shrink-0 relative">
      <div className="max-w-3xl mx-auto bg-[#2e2e2e] rounded-2xl border border-[#3e3e3e] shadow-[0_12px_40px_rgba(0,0,0,0.22)] flex flex-col px-3 pt-3 pb-2 focus-within:border-[#555] transition-all">
        
        {/* 附件预览框卡片栏 (解耦组件) */}
        <AttachmentPreviewList 
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
          onPreviewImage={onPreviewImage}
        />

        <textarea
          rows={2}
          placeholder={isLoading ? "AI 正在思考中... (可点击右侧按钮停止)" : "在此处输入聊天内容，点击别针或拖拽文件到聊天区域..."}
          disabled={isLoading}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isLoading) onSendMessage();
            }
          }}
          className="w-full bg-transparent border-none outline-none resize-none text-xs text-[#e3e3e3] placeholder-gray-500 px-2 leading-relaxed"
        />

        <div className="flex items-center justify-between border-t border-[#3a3a3a] pt-2 mt-2 gap-3">
          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={onSelectFiles}
              disabled={isLoading}
              title="选择本地代码、图片或 Office 文档作为上下文"
              className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#3a3a3a] transition-all cursor-pointer"
            >
              <Paperclip size={14} />
            </button>

            <button
              type="button"
              onClick={handleToggleSearchMode}
              title={btnStyles.title}
              className={`p-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer text-xs ${btnStyles.classes}`}
            >
              <Globe size={14} />
              <span className="text-[10px] font-semibold select-none">{btnStyles.label}</span>
            </button>

            {/* 角色选择器 (解耦组件) */}
            <RoleSelector
              roles={roles}
              activeRole={activeRole}
              activeRoleId={activeRoleId}
              canSelectRole={canSelectRole}
              showRoleDropdown={showRoleDropdown}
              setShowRoleDropdown={setShowRoleDropdown}
              onSelectRole={onSelectRole}
              setShowModelDropdown={setShowModelDropdown}
            />
          </div>

          <div className="flex items-center gap-2 relative">
            {/* 模型选择器 (解耦组件) */}
            <ModelSelector
              selectedModel={selectedModel}
              availableModels={availableModels}
              modelOptions={modelOptions}
              showModelDropdown={showModelDropdown}
              setShowModelDropdown={setShowModelDropdown}
              setSelectedModel={setSelectedModel}
              setShowRoleDropdown={setShowRoleDropdown}
            />

            {/* 发送 / 停止 按钮动态切换 */}
            {isLoading ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer bg-red-500 text-white hover:bg-red-600 shadow-sm animate-in fade-in zoom-in-95 duration-150"
                title="停止生成"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSendMessage}
                disabled={!inputText.trim() && attachments.length === 0}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  inputText.trim() || attachments.length > 0
                    ? "bg-white text-black hover:bg-gray-200 shadow-sm"
                    : "bg-[#3e3e3e] text-gray-500 cursor-not-allowed"
                }`}
              >
                <Send size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}