import React from "react";
import { 
  Send, 
  ChevronUp, 
  Paperclip, 
  X,
  FileCode,
  FileText,
  FileAudio,
  FileSpreadsheet,
  FileImage,
  Globe,
  BrainCircuit,
  UserSquare2,
  Eye
} from "lucide-react";
import { AttachmentFile, Role } from "../types/chat";

interface ChatInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  attachments: AttachmentFile[];
  selectedModel: string;
  availableModels: string[];
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  setSelectedModel: (modelName: string) => void;
  onSelectFiles: () => void;
  onRemoveAttachment: (idx: number) => void;
  onPreviewImage: (file: AttachmentFile) => void;
  onSendMessage: () => void;
  webSearchMode: 'off' | 'direct' | 'agent';
  setWebSearchMode: (mode: 'off' | 'direct' | 'agent') => void;

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
  showModelDropdown,
  setShowModelDropdown,
  setSelectedModel,
  onSelectFiles,
  onRemoveAttachment,
  onPreviewImage,
  onSendMessage,
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

  const renderAttachmentIcon = (type: AttachmentFile['type']) => {
    switch(type) {
      case 'image': return <FileImage size={14} className="text-emerald-400" />;
      case 'audio': return <FileAudio size={14} className="text-purple-400" />;
      case 'code': return <FileCode size={14} className="text-blue-400" />;
      case 'office': return <FileSpreadsheet size={14} className="text-orange-400" />;
      default: return <FileText size={14} className="text-gray-400" />;
    }
  };

  const handleToggleSearchMode = () => {
    if (webSearchMode === 'off') {
      setWebSearchMode('direct');
    } else if (webSearchMode === 'direct') {
      setWebSearchMode('agent');
    } else {
      setWebSearchMode('off');
    }
  };

  const getSearchButtonStyles = () => {
    if (webSearchMode === 'direct') {
      return {
        classes: "bg-[#2d3a32] text-emerald-400 border border-[#1e4620] hover:bg-[#34463a]",
        title: "联网直接检索：直接利用您的输入搜索网络一轮，快速且省 Token",
        label: "直接检索"
      };
    }
    if (webSearchMode === 'agent') {
      return {
        classes: "bg-[#2b3a4a] text-sky-400 border border-[#1e3d4e] hover:bg-[#344a5e] animate-pulse",
        title: "模型自主检索：由大模型思考构建搜索词并自主判断，最多检索3轮",
        label: "模型检索"
      };
    }
    return {
      classes: "text-gray-400 hover:text-white hover:bg-[#3a3a3a] border border-transparent",
      title: "联网搜索关闭：纯模型直接回答",
      label: "联网关闭"
    };
  };

  const btnStyles = getSearchButtonStyles();

  const getModelLabel = (modelName: string): string => {
    const lower = modelName.toLowerCase();
    if (lower.includes("gemini")) {
      return "Gemini 云端模型";
    }
    if (lower.includes("deepseek")) {
      return "DeepSeek 云端模型";
    }
    return "Ollama 本地模型";
  };

  const getModelDotClass = (modelName: string) => {
    const lower = modelName.toLowerCase();
    if (lower.includes("gemini")) return "bg-blue-400 animate-pulse";
    if (lower.includes("deepseek") && lower.includes("pro")) return "bg-amber-500 animate-pulse";
    if (lower.includes("deepseek")) return "bg-[#f97316]";
    return "bg-emerald-400 animate-pulse";
  };

  const getRoleButtonText = () => {
    if (activeRole) return activeRole.name;
    return "未设角色";
  };

  return (
    <div className="p-5 md:p-6 bg-[#202020] border-t border-[#282828] shrink-0 relative">
      <div className="max-w-3xl mx-auto bg-[#2e2e2e] rounded-2xl border border-[#3e3e3e] shadow-[0_12px_40px_rgba(0,0,0,0.22)] flex flex-col px-3 pt-3 pb-2 focus-within:border-[#555] transition-all">
        
        {/* 附件预览框卡片栏 */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2 border-b border-[#3e3e3e] mb-2 animate-in fade-in duration-100">
            {attachments.map((file, idx) => (
              file.type === "image" && file.previewUrl ? (
                <div
                  key={idx}
                  className="relative group rounded-xl overflow-hidden border border-[#3e3e3e] bg-[#252526] w-[84px] h-[84px]"
                >
                  <button
                    type="button"
                    onClick={() => onPreviewImage(file)}
                    className="w-full h-full cursor-pointer"
                    title={`预览图片：${file.name}`}
                  >
                    <img
                      src={file.previewUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                      onError={(e) => {
                        console.error("图片缩略图加载失败：", {
                          name: file.name,
                          path: file.path,
                          previewUrl: file.previewUrl
                        });
                        const target = e.currentTarget;
                        target.style.display = "none";
                      }}
                    />
                  </button>

                  <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                    <div className="text-[9px] text-white truncate">{file.name}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onPreviewImage(file)}
                    className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="查看大图"
                  >
                    <Eye size={12} />
                  </button>

                  <button 
                    type="button"
                    onClick={() => onRemoveAttachment(idx)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                    title="移除此附件"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-[#252526] px-2 py-1 rounded-md border border-[#3e3e3e] text-[10px] text-gray-300 font-mono relative group max-w-[180px]"
                >
                  {renderAttachmentIcon(file.type)}
                  <span className="max-w-[120px] truncate">{file.name}</span>
                  <button 
                    type="button"
                    onClick={() => onRemoveAttachment(idx)}
                    className="ml-1 p-0.5 text-gray-500 hover:text-red-400 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              )
            ))}
          </div>
        )}

        <textarea
          rows={2}
          placeholder={isLoading ? "请等待当前回复完成..." : "在此处输入聊天内容，点击纸夹或直接拖拽文件到聊天区域..."}
          disabled={isLoading}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
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
              {webSearchMode === 'agent' ? (
                <BrainCircuit size={14} className="text-sky-400" />
              ) : (
                <Globe size={14} className={webSearchMode === 'direct' ? "animate-spin-slow text-emerald-400" : ""} />
              )}
              <span className="text-[10px] font-semibold select-none">{btnStyles.label}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (roles.length === 0) return;
                  setShowRoleDropdown(!showRoleDropdown);
                  setShowModelDropdown(false);
                }}
                title={
                  roles.length === 0
                    ? "暂无角色，请先到“我的角色”创建"
                    : canSelectRole
                    ? "选择会话角色设定"
                    : "当前会话已有内容，角色已锁定"
                }
                className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                  roles.length === 0
                    ? "bg-[#232323] border-[#353535] text-gray-600 cursor-not-allowed"
                    : canSelectRole
                    ? "bg-[#202020] border-[#353535] text-gray-300 hover:text-white"
                    : "bg-amber-500/[0.08] border-amber-500/20 text-amber-300"
                }`}
              >
                <UserSquare2 size={12} />
                <span className="max-w-[92px] truncate">{getRoleButtonText()}</span>
                <ChevronUp size={10} className={`transform transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showRoleDropdown && roles.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-60 max-h-72 overflow-y-auto scrollbar-thin bg-[#252526] border border-[#3e3e3e] rounded-xl shadow-2xl py-1.5 z-50">
                  <div className="px-3 pt-2 pb-1.5 text-[10px] text-gray-500 font-semibold tracking-wider">
                    角色设定
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectRole("");
                      setShowRoleDropdown(false);
                    }}
                    disabled={!canSelectRole}
                    className={`w-full text-left px-3 py-2 transition-colors flex flex-col ${
                      !canSelectRole
                        ? "text-gray-600 cursor-not-allowed"
                        : !activeRoleId
                        ? "text-amber-400 bg-amber-500/[0.06]"
                        : "text-gray-300 hover:bg-[#333]"
                    }`}
                  >
                    <span className="text-xs font-semibold">不使用角色</span>
                    <span className="text-[9px] text-gray-500 font-normal">
                      使用通用系统提示词与当前模型
                    </span>
                  </button>

                  <div className="my-1 border-t border-[#343434]" />

                  {roles.map((role) => (
                    <button
                      type="button"
                      key={role.id}
                      onClick={() => {
                        onSelectRole(role.id);
                        setShowRoleDropdown(false);
                      }}
                      disabled={!canSelectRole}
                      className={`w-full text-left px-3 py-2 transition-colors flex flex-col ${
                        !canSelectRole
                          ? "text-gray-600 cursor-not-allowed"
                          : activeRoleId === role.id
                          ? "text-amber-400 bg-amber-500/[0.06]"
                          : "text-gray-300 hover:bg-[#333]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${activeRoleId === role.id ? "bg-amber-400" : "bg-gray-600"}`} />
                        <span className="text-xs font-semibold truncate">{role.name}</span>
                      </div>
                      <span className="text-[9px] text-gray-500 font-normal mt-0.5 line-clamp-2">
                        {role.provider && role.model
                          ? `${role.provider} / ${role.model}`
                          : "未绑定模型，发送时跟随当前模型选择"}
                      </span>
                    </button>
                  ))}

                  {!canSelectRole && (
                    <div className="px-3 py-2 text-[10px] text-amber-400/80 border-t border-[#343434] mt-1">
                      当前会话已有消息，角色已锁定不可切换。
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowModelDropdown(!showModelDropdown);
                  setShowRoleDropdown(false);
                }}
                className="text-[10px] text-gray-400 hover:text-white font-semibold bg-[#202020] px-2.5 py-1.5 rounded-lg border border-[#353535] flex items-center gap-1.5 transition-colors cursor-pointer max-w-[190px]"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getModelDotClass(selectedModel)}`}></span>
                <span className="truncate">{selectedModel}</span>
                <ChevronUp size={10} className={`transform transition-transform shrink-0 ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showModelDropdown && (
                <div className="absolute bottom-full right-0 mb-2 w-56 max-h-64 overflow-y-auto scrollbar-thin bg-[#252526] border border-[#3e3e3e] rounded-xl shadow-2xl py-1 z-50">
                  {availableModels.map((modelName) => (
                    <button
                      type="button"
                      key={modelName}
                      onClick={() => {
                        setSelectedModel(modelName);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] transition-colors flex flex-col cursor-pointer ${
                        selectedModel === modelName ? "text-amber-400 font-semibold" : "text-gray-300"
                      }`}
                    >
                      <span className="truncate">{modelName}</span>
                      <span className="text-[9px] text-gray-500 font-normal">
                        {getModelLabel(modelName)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="button"
              onClick={onSendMessage}
              disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                (inputText.trim() || attachments.length > 0) && !isLoading
                  ? 'bg-white text-black hover:bg-gray-200 shadow-sm'
                  : 'bg-[#3e3e3e] text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={12} />
            </button>
          </div>
        </div>

        {activeRole && (
          <div className="mt-2 px-2 pt-2 border-t border-[#343434]">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/[0.06] border border-amber-500/15 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-amber-300">
                  <UserSquare2 size={12} />
                  <span className="text-[10px] font-semibold truncate">当前角色：{activeRole.name}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                  {activeRole.provider && activeRole.model
                    ? `绑定模型：${activeRole.provider} / ${activeRole.model}`
                    : "未绑定专属模型，将沿用当前模型选择"}
                </div>
              </div>
              {!canSelectRole && (
                <span className="text-[9px] text-gray-500 shrink-0">已锁定</span>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="text-center text-[10px] text-gray-500 mt-2">AI 的回答可能有误，请检查重要信息</div>
    </div>
  );
}