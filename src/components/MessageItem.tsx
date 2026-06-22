import React from "react";
import { 
  ChevronLeft, 
  ChevronRight,
  FileCode,
  FileText,
  FileAudio,
  FileSpreadsheet,
  FileImage
} from "lucide-react";
import { Message, getFileType, format12HourTime } from "../types/chat";
import MarkdownMessage from "./MarkdownMessage";

interface MessageItemProps {
  msg: Message;
  chatFontSize: string;
  onMsgContextMenu: (e: React.MouseEvent, messageId: string, sender: Message["sender"]) => void;
  onSaveEdit: (messageId: string, newText: string) => void;
  onCancelEdit: (messageId: string) => void;
  onSwitchBranch: (messageId: string, direction: "prev" | "next") => void;
}

export default function MessageItem({
  msg,
  chatFontSize,
  onMsgContextMenu,
  onSaveEdit,
  onCancelEdit,
  onSwitchBranch
}: MessageItemProps) {
  const isUser = msg.sender === 'user';
  const hasBranches = msg.branches && msg.branches.length > 1;
  const activeIdx = msg.activeBranchIndex ?? 0;
  const branchesCount = msg.branches ? msg.branches.length : 0;

  const renderAttachmentIcon = (type: 'image' | 'audio' | 'code' | 'office' | 'other') => {
    switch(type) {
      case 'image': return <FileImage size={14} className="text-emerald-400" />;
      case 'audio': return <FileAudio size={14} className="text-purple-400" />;
      case 'code': return <FileCode size={14} className="text-blue-400" />;
      case 'office': return <FileSpreadsheet size={14} className="text-orange-400" />;
      default: return <FileText size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && msg.sender !== 'system_err' && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-xs shrink-0 select-none">🤖</div>
      )}
      
      <div 
        onContextMenu={(e) => onMsgContextMenu(e, msg.id, msg.sender)}
        style={{ fontSize: chatFontSize }}
        className={`max-w-[85%] w-fit p-3.5 rounded-xl leading-relaxed flex flex-col gap-2 cursor-context-menu select-text transition-all duration-150 hover:ring-1 hover:ring-white/5 relative group ${
          isUser 
            ? 'bg-[#2b6cb0] text-white rounded-tr-none ml-auto' 
            : msg.sender === 'system_err'
            ? 'bg-[#5c2d2d] text-red-200 border border-[#8c3d3d]'
            : 'bg-[#2e2e2e] text-gray-200 border border-[#3a3a3a] rounded-tl-none'
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
              {msg.sender === 'ai' ? (
                <MarkdownMessage text={msg.text} fontSize={chatFontSize} />
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

        {msg.sender === 'ai' && !msg.isEditing && (
          <div className="mt-1 pt-1.5 border-t border-white/5 flex items-center gap-2 text-[10px] text-gray-500 font-mono select-none">
            <span>提供商: <strong className="text-gray-400 font-medium">{msg.provider || "未知"}</strong></span>
            <span className="opacity-30">•</span>
            <span>模型: <strong className="text-gray-400 font-medium">{msg.model || "未知"}</strong></span>
            <span className="opacity-30">•</span>
            <span>Token消耗: <strong className="text-gray-400 font-medium">{msg.tokensUsed !== undefined ? msg.tokensUsed : "未知"}</strong></span>
            <span className="opacity-30">•</span>
            <span>时间: <strong className="text-gray-400 font-medium">{format12HourTime(msg.timestamp)}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
