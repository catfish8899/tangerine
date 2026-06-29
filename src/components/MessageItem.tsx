// src/components/MessageItem.tsx
import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileCode,
  FileText,
  FileAudio,
  FileSpreadsheet,
  FileImage,
  Globe,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  ExternalLink,
  StopCircle // 新增：停止图标
} from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { Message, getFileType, format12HourTime } from "../types/chat";
import MarkdownMessage from "./MarkdownMessage";

interface MessageItemProps {
  msg: Message;
  chatFontSize: string;
  onMsgContextMenu: (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => void;
  onSaveEdit: (messageId: string, newText: string) => void;
  onCancelEdit: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
  isParentLoading?: boolean;
}

export default function MessageItem({
  msg,
  chatFontSize,
  onMsgContextMenu,
  onSaveEdit,
  onCancelEdit,
  onSwitchBranch,
  isParentLoading = false
}: MessageItemProps) {
  const isUser = msg.sender === "user";
  const isAi = msg.sender === "ai";
  const isSystemError = msg.sender === "system_err";

  const hasBranches = msg.branches && msg.branches.length > 1;
  const activeIdx = msg.activeBranchIndex ?? 0;
  const branchesCount = msg.branches ? msg.branches.length : 0;

  // 控制网络搜索抽屉的展开与折叠状态
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);

  const renderAttachmentIcon = (type: "image" | "audio" | "code" | "office" | "other") => {
    switch (type) {
      case "image":
        return <FileImage size={14} className="text-emerald-400" />;
      case "audio":
        return <FileAudio size={14} className="text-purple-400" />;
      case "code":
        return <FileCode size={14} className="text-blue-400" />;
      case "office":
        return <FileSpreadsheet size={14} className="text-orange-400" />;
      default:
        return <FileText size={14} className="text-gray-400" />;
    }
  };

  // 通过默认浏览器打开 URL
  const handleOpenUrl = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.error("无法调用默认浏览器打开 URL: ", err);
    }
  };

  const hasText = !!msg.text?.trim();
  const hasSources = !!(msg.sources && msg.sources.length > 0);

  // 【修改点】：如果消息已被手动停止，则不应再显示“正在处理”动画
  const isCurrentlyThinking = isAi && !hasText && !hasSources && !msg.isStopped && isParentLoading;
  
  // 【修改点】：如果消息被手动停止，即使没有文本也不应被隐藏
  const isMessageTrulyEmpty = isAi && !hasText && !hasSources && !isParentLoading && !msg.isStopped;
  
  const shouldShowMarkdown = isAi && hasText;

  // 【修改点】：只要有文本或者被手动停止了，就显示底部元数据区域
  const shouldShowMetadata = isAi && !msg.isEditing && (hasText || msg.isStopped);

  if (isMessageTrulyEmpty) {
    return null;
  }

  return (
    <div className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-200`}>
      {!isUser && !isSystemError && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0 select-none shadow-md">
          🤖
        </div>
      )}

      <div
        onContextMenu={(e) => onMsgContextMenu(e, msg.id, msg.sender)}
        style={{ fontSize: chatFontSize }}
        className={`max-w-[85%] w-fit p-3.5 rounded-xl leading-relaxed flex flex-col gap-2 cursor-context-menu select-text transition-all duration-150 hover:ring-1 hover:ring-white/5 relative group ${
          isUser
            ? "bg-[#2b6cb0] text-white rounded-tr-none ml-auto"
            : isSystemError
            ? "bg-[#5c2d2d] text-red-200 border border-[#8c3d3d]"
            : "bg-[#2e2e2e] text-gray-200 border border-[#3a3a3a] rounded-tl-none"
        }`}
      >
        <div className="w-fit max-w-full">
          {msg.isEditing ? (
            <div className="flex flex-col gap-2 w-[320px] max-w-full">
              <textarea
                defaultValue={msg.text}
                id={`edit-area-${msg.id}`}
                className="w-full bg-[#1e1e1e] text-white text-xs border border-[#444] rounded p-2 focus:outline-none focus:border-blue-500 resize-y"
                rows={3}
              />
              <div className="flex justify-end gap-1.5">
                <button
                  onClick={() => {
                    const textVal = (document.getElementById(`edit-area-${msg.id}`) as HTMLTextAreaElement)?.value || "";
                    onSaveEdit(msg.id, textVal);
                  }}
                  className="px-2 py-1 bg-green-700 hover:bg-green-600 rounded text-[10px] font-medium transition-colors cursor-pointer"
                >
                  保存
                </button>
                <button
                  onClick={() => onCancelEdit(msg.id)}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-[10px] font-medium transition-colors cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <>
              {isAi ? (
                <div className="flex flex-col gap-2 min-w-[150px]">
                  {/* AI 处理阶段：仅对当前空 AI 消息展示 */}
                  {isCurrentlyThinking && (
                    <div className="flex items-center gap-2 text-xs text-amber-500/80 font-mono py-1 select-none">
                      <div className="flex space-x-1 items-center">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[10px] tracking-wider ml-1">AI 正在处理...</span>
                    </div>
                  )}

                  {/* 网页链接折叠区 */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mb-2 border border-[#3d4a3e] bg-[#232b24]/50 rounded-lg p-2 text-xs text-[#a9d1b1] w-full font-sans shadow-sm select-none">
                      <button
                        onClick={() => setIsSourcesOpen(!isSourcesOpen)}
                        className="w-full flex items-center justify-between text-left font-semibold focus:outline-none cursor-pointer group/btn"
                      >
                        <div className="flex items-center gap-1.5">
                          <Globe size={13} className="text-emerald-400 shrink-0" />
                          <span className="text-emerald-300">Tavily 网络搜索已完成</span>
                          <span className="px-1.5 py-0.5 bg-emerald-950/80 text-emerald-400 text-[9px] rounded font-mono border border-emerald-800/40">
                            {msg.sources.length} 个网页
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[#8fb997] group-hover/btn:text-emerald-200 transition-colors">
                          <span>{isSourcesOpen ? "折叠过程" : "查看检索轨迹"}</span>
                          {isSourcesOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </div>
                      </button>

                      {isSourcesOpen && (
                        <div className="mt-2 pt-2 border-t border-[#344035] space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex flex-col gap-1 text-[10px] text-[#8cb096]">
                            <div className="flex items-center gap-1.5">
                              <Search size={10} className="text-emerald-400 shrink-0" />
                              <span>动作过程: 基于 Tavily 网络搜索服务提取检索结果并整理网页信息</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                              <span>结果处理: 完成网页去重、摘要整理与链接输出</span>
                            </div>
                          </div>

                          <div className="text-[10px] font-semibold text-emerald-400 mt-1.5">搜索到的网页（点击以默认浏览器查看）：</div>
                          <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto scrollbar-thin pr-1">
                            {msg.sources.map((src, index) => (
                              <button
                                key={index}
                                onClick={() => handleOpenUrl(src.url)}
                                className="flex items-center justify-between text-left gap-2 p-1.5 rounded bg-[#1e2520] hover:bg-[#28322a] border border-[#2d3a31] text-[#9ec5a6] hover:text-white transition-all group/link cursor-pointer w-full"
                              >
                                <span className="truncate max-w-[420px] font-medium text-[10px]">{src.title || src.url}</span>
                                <ExternalLink size={10} className="opacity-60 group-hover/link:opacity-100 shrink-0" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 只要 AI 有文本，就立即渲染 */}
                  {shouldShowMarkdown && (
                    <MarkdownMessage text={msg.text} fontSize={chatFontSize} />
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="whitespace-pre-wrap select-text break-all">{msg.text}</p>
                  {msg.filePaths && msg.filePaths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1 pt-1.5 border-t border-white/10">
                      {msg.filePaths.map((fp, i) => {
                        const fn = fp.split(/[/\\]/).pop() || fp;
                        return (
                          <div key={i} className="flex items-center gap-1 bg-white/10 text-white/95 px-1.5 py-0.5 rounded text-[9px] font-mono select-none">
                            {renderAttachmentIcon(getFileType(fn))}
                            <span>{fn}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {isUser && hasBranches && !msg.isEditing && (
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-blue-200/80 font-mono select-none">
            <button
              onClick={() => onSwitchBranch(msg.id, "prev")}
              className="p-0.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
            >
              <ChevronLeft size={10} />
            </button>
            <span>{`${activeIdx + 1} / ${branchesCount}`}</span>
            <button
              onClick={() => onSwitchBranch(msg.id, "next")}
              className="p-0.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
            >
              <ChevronRight size={10} />
            </button>
          </div>
        )}

        {/* 【修改点】：底部元数据区域，支持渲染“已手动停止”标识 */}
        {shouldShowMetadata && (
          <div className="mt-1 pt-1.5 border-t border-white/5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500 font-mono select-none animate-in fade-in duration-500">
            {msg.isStopped && (
              <>
                <span className="text-red-400 flex items-center gap-1 font-semibold">
                  <StopCircle size={11} /> 已手动停止
                </span>
                {hasText && <span className="opacity-30 text-[8px]">•</span>}
              </>
            )}
            
            {hasText && (
              <>
                <span>提供商: <strong className="text-gray-400 font-medium">{msg.provider || "未知"}</strong></span>
                <span className="opacity-30 text-[8px]">•</span>
                <span>模型: <strong className="text-gray-400 font-medium">{msg.model || "未知"}</strong></span>
                <span className="opacity-30 text-[8px]">•</span>
                <span>Token消耗: <strong className="text-gray-400 font-medium">{msg.tokensUsed !== undefined ? msg.tokensUsed : "未知"}</strong></span>
                <span className="opacity-30 text-[8px]">•</span>
              </>
            )}
            
            <span>时间: <strong className="text-gray-400 font-medium">{format12HourTime(msg.timestamp)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}