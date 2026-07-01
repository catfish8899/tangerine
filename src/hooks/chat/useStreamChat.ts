// src/hooks/chat/useStreamChat.ts
// 负责处理 SSE 流式请求、数据解析、中断控制及消息发送/重发逻辑
import { useRef } from "react";
import { Message, ChatSession, AttachmentFile } from "../../types/chat";
import { ResolvedModelConfig } from "./useModelManager";
import { getAbsolutePath } from "../../utils/fileStorageService"; // 新增：引入路径转换工具

interface StreamChatDeps {
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeSessionId: string;
  activeSession: ChatSession;
  inputText: string;
  setInputText: React.Dispatch<React.SetStateAction<string>>;
  attachments: AttachmentFile[];
  setAttachments: React.Dispatch<React.SetStateAction<AttachmentFile[]>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  getRoleResolvedModelInfo: (session?: ChatSession) => ResolvedModelConfig;
  getActiveSystemPrompt: (session?: ChatSession) => string;
  setWarningMessage: (msg: string | null) => void;
  setShowModelDropdown: (show: boolean) => void;
  setShowRoleDropdown: (show: boolean) => void;
  webSearchMode: "off" | "agent";
}

export function useStreamChat(deps: StreamChatDeps) {
  const {
    sessions, setSessions, activeSessionId, activeSession,
    inputText, setInputText, attachments, setAttachments,
    isLoading, setIsLoading,
    getRoleResolvedModelInfo, getActiveSystemPrompt,
    setWarningMessage, setShowModelDropdown, setShowRoleDropdown,
    webSearchMode
  } = deps;

  const abortControllerRef = useRef<AbortController | null>(null);

  const validateAlternatingOrder = (messages: Message[]): boolean => {
    const filtered = messages.filter(m => m.sender !== "system_err");
    for (let i = 0; i < filtered.length; i++) {
      const expected = i % 2 === 0 ? "user" : "ai";
      if (filtered[i].sender !== expected) return false;
    }
    return true;
  };

  const extractTextDelta = (parsedData: any): string => {
    if (!parsedData) return "";
    if (typeof parsedData === "string") return parsedData;
    return parsedData.text ?? parsedData.delta ?? parsedData.content ?? parsedData.message ??
      parsedData.choices?.[0]?.delta?.content ?? parsedData.choices?.[0]?.message?.content ?? "";
  };

  const extractSources = (parsedData: any): Array<{ title: string; url: string }> | undefined => {
    if (!parsedData) return undefined;
    if (Array.isArray(parsedData.sources)) return parsedData.sources;
    if (Array.isArray(parsedData.references)) return parsedData.references;
    return undefined;
  };

  const extractTokensUsed = (parsedData: any): number | undefined => {
    return parsedData?.tokensUsed ?? parsedData?.tokens_used ?? 
      parsedData?.usage?.total_tokens ?? parsedData?.usage?.total_token ?? undefined;
  };

  const executeStreamChat = async (
    messageContext: Message[], filePathsToSend: string[], finalSystemPrompt: string,
    streamAiMessageId: string, branchParentId?: string, sessionSnapshot?: ChatSession
  ) => {
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      const apiMessages = messageContext.filter(m => m.sender !== "system_err").map(m => ({
        role: m.sender === "user" ? "user" : "assistant", content: m.text
      }));
      const resolvedModelInfo = getRoleResolvedModelInfo(sessionSnapshot || activeSession);

      const response = await fetch("http://127.0.0.1:5678/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: resolvedModelInfo.model, provider: resolvedModelInfo.provider,
          base_url: resolvedModelInfo.baseUrl, env_key_name: resolvedModelInfo.envKeyName,
          messages: [{ role: "system", content: finalSystemPrompt }, ...apiMessages],
          file_paths: filePathsToSend, web_search: webSearchMode
        }),
        signal
      });

      if (!response.ok) {
        let message = "请求失败";
        try { const errData = await response.json(); message = errData.detail || message; } catch {}
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
          if (rawData === "[DONE]") { streamDone = true; break; }

          try {
            const parsedData = JSON.parse(rawData);
            if (parsedData.error) { streamErrorMessage = parsedData.error; throw new Error(parsedData.error); }

            const textDelta = extractTextDelta(parsedData);
            const sources = extractSources(parsedData);
            const tokensUsed = extractTokensUsed(parsedData);
            if (!textDelta && !sources && tokensUsed === undefined) continue;

            setSessions(prev => prev.map(s => {
              if (s.id !== activeSessionId) return s;
              const updatedMessages = s.messages.map(m => {
                if (m.id === streamAiMessageId) {
                  return { ...m, text: textDelta ? m.text + textDelta : m.text, sources: sources?.length ? sources : m.sources, tokensUsed: tokensUsed ?? m.tokensUsed };
                }
                if (branchParentId && m.id === branchParentId) {
                  const updatedBranches = m.branches ? [...m.branches] : [];
                  const activeIdx = m.activeBranchIndex ?? 0;
                  const branchList = updatedBranches[activeIdx] || [];
                  updatedBranches[activeIdx] = branchList.map(bm => bm.id === streamAiMessageId ? { ...bm, text: textDelta ? bm.text + textDelta : bm.text, sources: sources?.length ? sources : bm.sources, tokensUsed: tokensUsed ?? bm.tokensUsed } : bm);
                  return { ...m, branches: updatedBranches };
                }
                return m;
              });
              return { ...s, messages: updatedMessages };
            }));
          } catch (e: any) {
            if (streamErrorMessage || String(e?.message || "").trim()) throw e;
            console.error("解析流式行失败:", e);
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        setSessions(prev => prev.map(session => {
          if (session.id === activeSessionId) {
            const updatedMessages = session.messages.map(m => {
              if (m.id === streamAiMessageId) return { ...m, isStopped: true } as any;
              if (branchParentId && m.id === branchParentId) {
                const updatedBranches = m.branches ? [...m.branches] : [];
                const activeIdx = m.activeBranchIndex ?? 0;
                updatedBranches[activeIdx] = (updatedBranches[activeIdx] || []).map(bm => bm.id === streamAiMessageId ? { ...bm, isStopped: true } as any : bm);
                return { ...m, branches: updatedBranches };
              }
              return m;
            });
            return { ...session, messages: updatedMessages };
          }
          return session;
        }));
        return;
      }

      const systemError: Message = { id: (Date.now() + 1).toString(), sender: "system_err", text: `⚠️ 错误: ${error.message || "无法连接到本地 Python Sidecar"}`, timestamp: Date.now() };
      setSessions(prev => prev.map(session => {
        if (session.id === activeSessionId) {
          if (branchParentId) {
            const updatedMessages = session.messages.map(m => {
              if (m.id === branchParentId) {
                const updatedBranches = m.branches ? [...m.branches] : [];
                updatedBranches[m.activeBranchIndex ?? 0] = [systemError];
                return { ...m, branches: updatedBranches };
              }
              return m;
            });
            return { ...session, messages: [...updatedMessages.filter(m => m.id !== streamAiMessageId), systemError] };
          }
          return { ...session, messages: [...session.messages.filter(m => m.id !== streamAiMessageId), systemError] };
        }
        return session;
      }));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
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

    // 修改：从历史消息的 attachments 中提取并转换绝对路径
    const filePathsToSend = await Promise.all(
      (targetMsg.attachments || []).map(async (a) => {
        if (a.localRelativePath) {
          return await getAbsolutePath(a.localRelativePath);
        }
        return a.path; // fallback
      })
    );

    await executeStreamChat(
      precedingMessages,
      filePathsToSend,
      getActiveSystemPrompt(session),
      streamAiMessageId,
      messageId,
      session
    );
  };

  const handleSendMessage = async (customText?: any, attachmentsOverride?: AttachmentFile[]) => {
    if (isLoading) return;

    const userText = typeof customText === "string" ? customText : inputText;
    // 修改：使用 attachments 替代 filePaths
    const finalAttachments = attachmentsOverride !== undefined ? attachmentsOverride : attachments;

    if (!userText.trim() && finalAttachments.length === 0) return;

    const currentSessionSnapshot = sessions.find(s => s.id === activeSessionId);
    if (!currentSessionSnapshot) return;

    // 修改：异步将相对路径转换为绝对路径，供 Python Sidecar 读取
    const filePathsToSend = await Promise.all(
      finalAttachments.map(async (a) => {
        if (a.localRelativePath) {
          return await getAbsolutePath(a.localRelativePath);
        }
        return a.path;
      })
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: Date.now(),
      attachments: finalAttachments // 修改：直接存储附件元数据数组
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
      filePathsToSend, // 传递转换后的绝对路径数组
      getActiveSystemPrompt(currentSessionSnapshot),
      streamAiMessageId,
      undefined,
      currentSessionSnapshot
    );
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  return {
    handleSendMessage,
    handleResendMessage,
    handleStopGeneration
  };
}