// src/hooks/chat/useSessionManager.ts
// 负责管理会话列表、消息增删改查、分支切换、角色管理及 LocalStorage 持久化
import { useState, useEffect } from "react";
import { Message, ChatSession, Role } from "../../types/chat";

const STORAGE_KEY = "tangerine_chat_sessions";
const ROLES_STORAGE_KEY = "tangerine_roles";

export function useSessionManager(setWarningMessage: (msg: string | null) => void) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error("解析历史对话失败：", e); }
    }
    return [{ id: "1", title: "agent微框架编程助手", messages: [], type: "chat" }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || "1");

  const [roles, setRoles] = useState<Role[]>(() => {
    const saved = localStorage.getItem(ROLES_STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error("解析角色数据失败：", e); }
    }
    return [];
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const activeRole = roles.find(r => r.id === activeSession?.roleId);
  const isActiveSessionEmpty = !!activeSession && activeSession.messages.length === 0;

  // 持久化 Sessions
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // 监听 Roles 变更
  useEffect(() => {
    const handleStorageChange = () => {
      const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
      if (savedRoles) {
        try { setRoles(JSON.parse(savedRoles)); } catch (e) { console.error("同步角色数据失败：", e); }
      }
    };
    const handleRolesChanged = () => {
      const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
      if (savedRoles) {
        try { setRoles(JSON.parse(savedRoles)); } catch (e) { console.error("同步角色数据失败：", e); }
      } else { setRoles([]); }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("tangerine_roles_changed", handleRolesChanged as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("tangerine_roles_changed", handleRolesChanged as EventListener);
    };
  }, []);

  const getActiveSystemPrompt = (session?: ChatSession): string => {
    if (!session?.roleId) return "You are a helpful assistant";
    const role = roles.find(r => r.id === session.roleId);
    return role?.systemPrompt?.trim() || "You are a helpful assistant";
  };

  const handleCreateSession = () => {
    const newSession: ChatSession = { id: Date.now().toString(), title: "新对话", messages: [], type: "chat" };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleCreateAutomationSession = () => {
    const newSession: ChatSession = { id: Date.now().toString(), title: "新自动化流程", messages: [], type: "automation" };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    // contextMenu 状态在 UI 中管理
  };

  const handleMsgContextMenu = (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => {
    e.preventDefault();
    // msgContextMenu 状态在 UI 中管理
  };

  const handleSaveEdit = (messageId: string, newText: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      const updatedMessages = s.messages.map(m => m.id === messageId ? { ...m, text: newText, isEditing: false } : m);
      return { ...s, messages: updatedMessages };
    }));
  };

  const handleCancelEdit = (messageId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      const updatedMessages = s.messages.map(m => m.id === messageId ? { ...m, isEditing: false } : m);
      return { ...s, messages: updatedMessages };
    }));
  };

  const handleDeleteMessage = (messageId: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId) return session;
      const filterMsgs = (msgs: Message[]) => msgs.filter(m => m.id !== messageId);
      let newMessages = filterMsgs(session.messages);
      newMessages = newMessages.map(m => {
        if (!m.branches || m.branches.length === 0) return m;
        const newBranches = m.branches.map(branch => filterMsgs(branch));
        return { ...m, branches: newBranches };
      });
      return { ...session, messages: newMessages };
    }));
  };

  const handleSelectRole = (roleId: string) => {
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    if (session.messages.length > 0) {
      setWarningMessage("⚠️ 只能在空白对话中选择或切换角色。");
      setTimeout(() => setWarningMessage(null), 3000);
      return;
    }
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, roleId: roleId || undefined } : s));
  };

  const handleSwitchBranch = (messageId: string, direction: "prev" | "next") => {
    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId) return session;
      const idx = session.messages.findIndex(m => m.id === messageId);
      if (idx === -1) return session;

      const targetMsg = { ...session.messages[idx] };
      let branches = targetMsg.branches ? [...targetMsg.branches] : [];
      const currentIdx = targetMsg.activeBranchIndex ?? 0;

      let newIdx = currentIdx;
      if (direction === "prev" && currentIdx > 0) newIdx = currentIdx - 1;
      else if (direction === "next" && currentIdx < branches.length - 1) newIdx = currentIdx + 1;

      if (newIdx === currentIdx) return session;

      const currentBranchMessages = session.messages.slice(idx + 1);
      if (branches.length > currentIdx) branches[currentIdx] = currentBranchMessages;

      targetMsg.activeBranchIndex = newIdx;
      targetMsg.branches = branches;

      const baseMessages = session.messages.slice(0, idx);
      const newBranchMessages = branches[newIdx] || [];
      return { ...session, messages: [...baseMessages, targetMsg, ...newBranchMessages] };
    }));
  };

  return {
    sessions, setSessions,
    activeSessionId, setActiveSessionId,
    roles, setRoles,
    activeSession, activeRole, isActiveSessionEmpty,
    getActiveSystemPrompt,
    handleCreateSession, handleCreateAutomationSession,
    handleSaveEdit, handleCancelEdit, handleDeleteMessage,
    handleSelectRole, handleSwitchBranch
  };
}