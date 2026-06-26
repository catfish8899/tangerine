// src/components/ChatWorkspace.tsx
import React from "react";
import { AlertTriangle, UserSquare2, Sparkles } from "lucide-react";
import MessageItem from "./MessageItem";
import ChatInput from "./ChatInput";

interface ChatWorkspaceProps {
  state: any;
  actions: any;
  refs: any;
}

export default function ChatWorkspace({ state, actions, refs }: ChatWorkspaceProps) {
  const {
    warningMessage, activeRole, isActiveSessionEmpty, activeSession, roles,
    chatFontSize, isLoading, inputText, attachments, selectedModel,
    availableModels, showModelDropdown, webSearchMode
  } = state;

  const {
    handleSelectRole, handleMsgContextMenu, handleSaveEdit, handleCancelEdit,
    handleSwitchBranch, setInputText, handleSelectFiles, handleRemoveAttachment,
    setSelectedModel, setShowModelDropdown, setWebSearchMode, handleSendMessage
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

      <div className="flex-1 overflow-y-auto px-12 py-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {activeRole && (
            <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4 shadow-[0_0_24px_rgba(245,158,11,0.04)] backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <UserSquare2 size={15} />
                  <span className="text-xs font-bold tracking-wide">
                    已加载角色系统设定：{activeRole.name}
                  </span>
                </div>

                {isActiveSessionEmpty && (
                  <button
                    onClick={() => handleSelectRole("")}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                  >
                    卸载设定
                  </button>
                )}
              </div>

              <div className="pl-6 text-[12px] text-gray-400 leading-relaxed whitespace-pre-wrap italic select-text">
                “{activeRole.systemPrompt}”
              </div>
            </div>
          )}

          {activeSession.messages.length === 0 ? (
            <div className="min-h-[calc(100vh-260px)] flex flex-col items-center justify-center text-center opacity-95">
              {roles.length > 0 ? (
                <div className="w-full max-w-2xl">
                  <div className="w-12 h-12 rounded-xl bg-[#2e2e2e] flex items-center justify-center mb-4 border border-[#3e3e3e] mx-auto">
                    <Sparkles size={22} className="text-amber-400" />
                  </div>
                  <h2 className="text-base font-semibold text-white tracking-wide mb-2">
                    选择一个角色开始对话 🧐
                  </h2>
                  <p className="text-xs text-gray-500 mb-5">
                    只有空白对话可以选择角色；对话产生内容后将锁定当前角色。
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roles.map((role: any) => (
                      <button
                        key={role.id}
                        onClick={() => handleSelectRole(role.id)}
                        className={`text-left rounded-xl border p-4 transition-all ${
                          activeSession.roleId === role.id
                            ? "bg-amber-500/[0.08] border-amber-500/50 text-amber-300"
                            : "bg-[#1b1b1b]/80 border-[#333] text-gray-300 hover:border-amber-500/30 hover:bg-[#242424]"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`w-2 h-2 rounded-full ${activeSession.roleId === role.id ? "bg-amber-400" : "bg-gray-600"}`} />
                          <span className="text-xs font-bold truncate">{role.name}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 line-clamp-3 leading-relaxed">
                          {role.systemPrompt}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-[#2e2e2e] flex items-center justify-center mb-4 border border-[#3e3e3e]">
                    <span className="text-2xl">💬</span>
                  </div>
                  <h2 className="text-base font-semibold text-white tracking-wide">
                    等待用户输入...📓✍️🧐
                  </h2>
                  <p className="text-xs text-gray-500 mt-2">
                    也可以点击侧边栏“我的角色”创建专属系统提示词。
                  </p>
                </>
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
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        availableModels={availableModels}
        showModelDropdown={showModelDropdown}
        setShowModelDropdown={setShowModelDropdown}
        webSearchMode={webSearchMode}
        setWebSearchMode={setWebSearchMode}
        onSendMessage={handleSendMessage}
      />
    </>
  );
}
