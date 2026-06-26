// src/App.tsx
import React from "react";
import { Trash2, Edit3, RefreshCw } from "lucide-react";
import Sidebar from "./components/Sidebar";
import SettingsModal from "./components/SettingsModal";
import RolesModal from "./components/RolesModal";
import ChatWorkspace from "./components/ChatWorkspace";
import AutomationWorkspace from "./components/AutomationWorkspace";
import { useChatManager } from "./hooks/useChatManager";

export default function App() {
  // 通过自定义 Hook 引入所有的视图状态和方法
  const { state, actions, refs } = useChatManager();
  const {
    sessions, activeSessionId, activeSession, showSettings, showRoles,
    contextMenu, msgContextMenu
  } = state;

  return (
    <div className="flex h-screen w-screen bg-[#202020] text-[#e3e3e3] overflow-hidden select-none font-sans">
      
      {/* --- 左侧边栏 --- */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        setActiveSessionId={actions.setActiveSessionId}
        onContextMenu={actions.handleContextMenu}
        onCreateSession={actions.handleCreateSession}
        onCreateAutomationSession={actions.handleCreateAutomationSession}
        onOpenSettings={() => actions.setShowSettings(true)}
        onOpenRoles={() => actions.setShowRoles(true)}
      />

      {/* --- 右侧主工作区 --- */}
      <div className="flex-1 flex flex-col bg-[#202020] h-full overflow-hidden relative">
        {activeSession?.type === "automation" ? (
          <AutomationWorkspace />
        ) : (
          <ChatWorkspace state={state} actions={actions} refs={refs} />
        )}
      </div>

      {/* --- 模态框组 --- */}
      {showSettings && (
        <SettingsModal isOpen={showSettings} onClose={() => actions.setShowSettings(false)} />
      )}

      <RolesModal isOpen={showRoles} onClose={() => actions.setShowRoles(false)} />

      {/* --- 左侧会话右键菜单 --- */}
      {contextMenu.visible && (
        <div
          className="fixed bg-[#2b2b2b]/95 border border-[#444444]/60 text-xs text-red-300 rounded-lg shadow-2xl z-[9999] p-1.5 backdrop-blur-md min-w-[130px] transition-all animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={() => {
            const tid = contextMenu.targetSessionId;
            if (tid) {
              actions.setSessions((prev: any) => {
                const rest = prev.filter((s: any) => s.id !== tid);
                if (rest.length === 0) return [{ id: Date.now().toString(), title: "新对话", messages: [], type: "chat" }];
                return rest;
              });
              if (activeSessionId === tid) {
                actions.setActiveSessionId(sessions.find(s => s.id !== tid)?.id || "1");
              }
            }
            actions.setContextMenu((prev: any) => ({ ...prev, visible: false }));
          }}
          onMouseLeave={() => actions.setContextMenu((prev: any) => ({ ...prev, visible: false }))}
        >
          <button className="flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 hover:bg-[#ff4d4d]/15 hover:text-red-200 rounded transition-colors font-medium">
            <Trash2 size={13} className="text-red-400" />
            <span>彻底删除此对话</span>
          </button>
        </div>
      )}

      {/* --- 消息气泡右键菜单 --- */}
      {msgContextMenu.visible && (
        <div
          className="fixed bg-[#2b2b2b]/95 border border-[#444444]/60 text-xs text-[#e3e3e3] rounded-lg shadow-2xl z-[9999] p-1.5 backdrop-blur-md min-w-[150px] transition-all animate-in fade-in zoom-in-95 duration-100"
          style={{ top: msgContextMenu.y, left: msgContextMenu.x }}
          onMouseLeave={() => actions.setMsgContextMenu((prev: any) => ({ ...prev, visible: false }))}
        >
          {msgContextMenu.targetMessageSender === "user" && (
            <button
              className="flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 hover:bg-[#ffffff]/10 rounded transition-colors font-medium mb-1"
              onClick={() => {
                const mid = msgContextMenu.targetMessageId;
                actions.setSessions((prev: any) => prev.map((s: any) => {
                  if (s.id === activeSessionId) return { ...s, messages: s.messages.map((m: any) => m.id === mid ? { ...m, isEditing: true } : m) };
                  return s;
                }));
                actions.setMsgContextMenu((prev: any) => ({ ...prev, visible: false }));
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
                actions.handleResendMessage(msgContextMenu.targetMessageId || "");
                actions.setMsgContextMenu((prev: any) => ({ ...prev, visible: false }));
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
              actions.setSessions((prev: any) => prev.map((s: any) => {
                if (s.id === activeSessionId) return { ...s, messages: s.messages.filter((m: any) => m.id !== mid) };
                return s;
              }));
              actions.setMsgContextMenu((prev: any) => ({ ...prev, visible: false }));
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
