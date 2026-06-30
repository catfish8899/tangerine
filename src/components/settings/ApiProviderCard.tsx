// 单个 API 提供商配置卡片（复用于云端和 Ollama）

import { Save, Plus, Trash2, ChevronDown, ChevronUp, Check, X } from "lucide-react";
import { ApiProviderConfig } from "./types";

interface ApiProviderCardProps {
  config: ApiProviderConfig;
  isOllama?: boolean;
  canDelete?: boolean;
  isSaved: boolean;
  isCollapsed: boolean;
  onSave: () => void;
  onDelete?: () => void;
  onFieldChange: (field: keyof ApiProviderConfig, value: any) => void;
  onModelChange: (index: number, value: string) => void;
  onAddModel: () => void;
  onRemoveModel: (index: number) => void;
  onToggleCollapse: () => void;
}

export default function ApiProviderCard({
  config,
  isOllama = false,
  canDelete = false,
  isSaved,
  isCollapsed,
  onSave,
  onDelete,
  onFieldChange,
  onModelChange,
  onAddModel,
  onRemoveModel,
  onToggleCollapse
}: ApiProviderCardProps) {
  
  const titleColor = isOllama ? "text-emerald-400" : "text-amber-400";
  const disabledInputClass = "bg-[#1d1d1e]/50 border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-gray-400 font-medium cursor-not-allowed outline-none";
  const normalInputClass = "bg-[#1d1d1e] border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-white font-medium placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-colors";
  const monoInputClass = "bg-[#1d1d1e] border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-colors";
  const disabledMonoClass = "bg-[#1d1d1e]/50 border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-gray-400 font-mono cursor-not-allowed outline-none";

  return (
    <div className="p-6 rounded-xl border border-white/5 bg-[#141415] shadow-lg hover:border-white/10 transition-all">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
        <span className={`text-xs font-bold ${titleColor} tracking-wider uppercase font-mono`}>
          {config.providerName || (isOllama ? "Ollama" : "未命名提供商")}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
              isSaved
                ? "bg-green-500/20 border-green-500/30 text-green-400"
                : "bg-[#253746] border-[#2d4558] text-[#4ea1db] hover:bg-[#2d4355]"
            }`}
          >
            {isSaved ? <Check size={12} /> : <Save size={12} />}
            <span>{isSaved ? "已保存" : "保存本配置"}</span>
          </button>

          {!isOllama && canDelete && onDelete && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-all cursor-pointer"
              title="删除此 API 信息块"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-4 items-center">
          <label className="col-span-3 text-xs text-gray-200 font-semibold">提供商名称</label>
          <input
            type="text"
            disabled={isOllama}
            value={config.providerName}
            onChange={(e) => onFieldChange("providerName", e.target.value)}
            className={`col-span-9 ${isOllama ? disabledInputClass : normalInputClass}`}
          />
        </div>

        <div className="grid grid-cols-12 gap-4 items-center">
          <label className="col-span-3 text-xs text-gray-200 font-semibold">Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => onFieldChange("baseUrl", e.target.value)}
            className={`col-span-9 ${isOllama ? "bg-[#1d1d1e] border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-colors" : monoInputClass}`}
          />
        </div>

        <div className="grid grid-cols-12 gap-4 items-center">
          <label className="col-span-3 text-xs text-gray-200 font-semibold">环境变量名称</label>
          <input
            type="text"
            disabled={isOllama}
            value={config.envKeyName}
            onChange={(e) => onFieldChange("envKeyName", e.target.value)}
            className={`col-span-9 ${isOllama ? disabledMonoClass : monoInputClass}`}
          />
        </div>

        <div className="border border-white/5 rounded-lg bg-[#19191a] overflow-hidden mt-4">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <span className="font-semibold">可调用模型列表 ({config.models.length})</span>
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>

          {!isCollapsed && (
            <div className="p-4 border-t border-white/5 space-y-3 bg-[#111112]">
              {config.models.map((model, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => onModelChange(idx, e.target.value)}
                    className="flex-1 bg-[#1d1d1e] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30"
                  />
                  <button
                    onClick={() => onRemoveModel(idx)}
                    className="text-gray-400 hover:text-red-400 p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                    title="移除此模型"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={onAddModel}
                className="flex items-center gap-1.5 text-xs text-[#4ea1db] hover:text-blue-300 font-bold mt-2 transition-colors cursor-pointer"
              >
                <Plus size={13} />
                <span>增加模型</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}