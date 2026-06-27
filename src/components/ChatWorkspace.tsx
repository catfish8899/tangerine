// src/components/ChatWorkspace.tsx
import React from "react";
import { AlertTriangle, Sparkles, Upload, Image as ImageIcon, X } from "lucide-react";
import MessageItem from "./MessageItem";
import ChatInput from "./ChatInput";

interface ChatWorkspaceProps {
  state: any;
  actions: any;
  refs: any;
}

export default function ChatWorkspace({ state, actions, refs }: ChatWorkspaceProps) {
  const {
    warningMessage,
    activeRole,
    isActiveSessionEmpty,
    activeSession,
    roles,
    chatFontSize,
    isLoading,
    inputText,
    attachments,
    selectedModel,
    availableModels,
    showModelDropdown,
    webSearchMode,
    showRoleDropdown,
    isDraggingFiles,
    previewImage
  } = state;

  const {
    handleSelectRole,
    handleMsgContextMenu,
    handleSaveEdit,
    handleCancelEdit,
    handleSwitchBranch,
    setInputText,
    handleSelectFiles,
    handleRemoveAttachment,
    handlePreviewImage,
    handleCloseImagePreview,
    setSelectedModel,
    setShowModelDropdown,
    setWebSearchMode,
    handleSendMessage,
    setShowRoleDropdown
  } = actions;

  const { messagesEndRef } = refs;

  return (
    <>
      {warningMessage && (
        <div className="absolute inset-x-0 top-6 z-[9999] flex justify-center animate-in slide-in-from-top-4 fade-in duration-150">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#4c1d1d]/95 text-red-200 border border-red-500/30 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold tracking-wide">
            <AlertTriangle size={14} className="text-red-400 animate-bounce" />
            <span>{warningMessage}</span>
          </div>
        </div>
      )}

      <div
        className={`relative flex-1 overflow-y-auto px-6 md:px-10 py-6 transition-all ${
          isDraggingFiles ? "bg-sky-500/[0.03]" : ""
        }`}
      >
        {isDraggingFiles && (
          <div className="absolute inset-4 z-20 rounded-3xl border-2 border-dashed border-sky-400/50 bg-sky-500/[0.06] backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-400/20 flex items-center justify-center mx-auto mb-3">
                <Upload size={24} className="text-sky-300" />
              </div>
              <div className="text-sm font-semibold text-sky-200">拖拽文件到这里即可附加到本轮对话</div>
              <div className="text-xs text-sky-200/70 mt-1">支持图片、音频、代码与 Office / PDF 文档</div>
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-6">

          {activeRole && activeSession.messages.length > 0 && (
            <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3 shadow-[0_0_24px_rgba(245,158,11,0.035)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 text-amber-400">
                  <Sparkles size={14} />
                  <span className="text-[11px] font-bold tracking-wide">
                    当前会话角色：{activeRole.name}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-gray-400 leading-relaxed whitespace-pre-wrap italic select-text line-clamp-2">
                “{activeRole.systemPrompt}”
              </div>
            </div>
          )}

          {activeSession.messages.length === 0 ? (
            <div className="min-h-[calc(100vh-280px)] flex flex-col items-center justify-center text-center opacity-95">
              <div className="w-14 h-14 rounded-2xl bg-[#2b2b2b] flex items-center justify-center mb-4 border border-[#3e3e3e] shadow-inner">
                <Sparkles size={24} className="text-amber-400" />
              </div>

              <h2 className="text-base font-semibold text-white tracking-wide mb-2">
                开始一段新对话
              </h2>

              <p className="text-xs text-gray-500 max-w-md leading-relaxed">
                你可以直接输入消息，也可以通过输入框左下区域选择附件、联网模式与角色设定。
                {roles.length > 0
                  ? " 当前支持在空白会话中为该对话绑定角色。"
                  : " 也可以先到侧边栏“我的角色”创建专属角色。"}
              </p>

              <div className="mt-5 flex items-center gap-2 px-3 py-2 rounded-xl border border-[#333] bg-[#1f1f1f] text-[11px] text-gray-400">
                <ImageIcon size={14} className="text-sky-400" />
                也支持将文件直接拖拽到聊天区域
              </div>

              {activeRole && (
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 max-w-lg w-full">
                  <div className="text-[11px] text-amber-300 font-semibold mb-1">
                    已预选角色：{activeRole.name}
                  </div>
                  <div className="text-[11px] text-gray-400 leading-relaxed line-clamp-3">
                    {activeRole.systemPrompt}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {activeSession.messages.map((msg: any) => (
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
            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        inputText={inputText}
        setInputText={setInputText}
        isLoading={isLoading}
        attachments={attachments}
        onSelectFiles={handleSelectFiles}
        onRemoveAttachment={handleRemoveAttachment}
        onPreviewImage={handlePreviewImage}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        availableModels={availableModels}
        showModelDropdown={showModelDropdown}
        setShowModelDropdown={setShowModelDropdown}
        webSearchMode={webSearchMode}
        setWebSearchMode={setWebSearchMode}
        onSendMessage={handleSendMessage}
        roles={roles}
        activeRole={activeRole}
        activeRoleId={activeSession?.roleId}
        canSelectRole={isActiveSessionEmpty}
        showRoleDropdown={showRoleDropdown}
        setShowRoleDropdown={setShowRoleDropdown}
        onSelectRole={handleSelectRole}
      />

      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] bg-black/78 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={handleCloseImagePreview}
        >
          <div
            className="relative max-w-[92vw] max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseImagePreview}
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-[#202020]/95 border border-white/10 text-white hover:text-red-400 flex items-center justify-center shadow-lg cursor-pointer"
              title="关闭预览"
            >
              <X size={18} />
            </button>

            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#141414]">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-[92vw] max-h-[82vh] object-contain bg-[#111]"
                draggable={false}
              />
              <div className="px-4 py-3 text-xs text-gray-300 border-t border-white/5 bg-[#181818] truncate">
                {previewImage.name}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}