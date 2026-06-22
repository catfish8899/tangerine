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
  FileImage
} from "lucide-react";
import { AttachmentFile, getFileType } from "../types/chat";

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
  onSendMessage: () => void;
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
  onSendMessage
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

  return (
    <div className="p-6 bg-[#202020] border-t border-[#282828] shrink-0 relative">
      <div className="max-w-3xl mx-auto bg-[#2e2e2e] rounded-xl border border-[#3e3e3e] shadow-lg flex flex-col px-3 pt-3 pb-2 focus-within:border-[#4d4d4d] transition-all">
        
        {/* 附件预览框卡片栏 */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pb-2 border-b border-[#3e3e3e] mb-2 animate-in fade-in duration-100">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-1.5 bg-[#252526] px-2 py-1 rounded-md border border-[#3e3e3e] text-[10px] text-gray-300 font-mono relative group">
                {renderAttachmentIcon(file.type)}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button 
                  onClick={() => onRemoveAttachment(idx)}
                  className="ml-1 p-0.5 text-gray-500 hover:text-red-400 rounded-full transition-colors cursor-pointer"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          rows={2}
          placeholder={isLoading ? "请等待当前回复完成..." : "在此处输入聊天内容，点击纸夹按钮选择文件..."}
          disabled={isLoading}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSendMessage();
            }
          }}
          className="w-full bg-transparent border-none outline-none resize-none text-xs text-[#e3e3e3] placeholder-gray-500 px-2"
        />

        <div className="flex items-center justify-between border-t border-[#3a3a3a] pt-2 mt-2">
          
          {/* 左侧增加附件按钮 */}
          <button 
            onClick={onSelectFiles}
            disabled={isLoading}
            title="选择本地代码、图片或Office文档作为上下文"
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-[#3a3a3a] transition-all cursor-pointer"
          >
            <Paperclip size={14} />
          </button>

          {/* 右侧发送及模型下拉选择器 */}
          <div className="flex items-center gap-2 relative">
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowModelDropdown(!showModelDropdown); }}
                className="text-[10px] text-gray-400 hover:text-white font-semibold bg-[#202020] px-2.5 py-1.5 rounded border border-[#353535] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  selectedModel.includes("pro") 
                    ? "bg-amber-500 animate-pulse" 
                    : selectedModel.includes("deepseek") 
                    ? "bg-[#f97316]" 
                    : "bg-emerald-400 animate-pulse"
                }`}></span>
                {selectedModel}
                <ChevronUp size={10} className={`transform transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showModelDropdown && (
                <div className="absolute bottom-full right-0 mb-2 w-48 max-h-60 overflow-y-auto scrollbar-thin bg-[#252526] border border-[#3e3e3e] rounded-lg shadow-xl py-1 z-50">
                  {availableModels.map((modelName) => (
                    <button
                      key={modelName}
                      onClick={() => { setSelectedModel(modelName); setShowModelDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[#333] transition-colors flex flex-col cursor-pointer ${
                        selectedModel === modelName ? "text-amber-400 font-semibold" : "text-gray-300"
                      }`}
                    >
                      <span>{modelName}</span>
                      <span className="text-[9px] text-gray-500 font-normal">
                        {modelName.includes("deepseek") ? "云端部署模型" : "Ollama 本地模型"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={onSendMessage}
              disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                (inputText.trim() || attachments.length > 0) && !isLoading ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#3e3e3e] text-gray-500 cursor-not-allowed'
              }`}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>
      <div className="text-center text-[10px] text-gray-500 mt-2">AI 的回答可能有误，请检查重要信息</div>
    </div>
  );
}
