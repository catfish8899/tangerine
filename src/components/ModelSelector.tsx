import React from "react";
import { ChevronUp } from "lucide-react";

interface ModelOption {
  model: string;
  providerName: string;
  category: "ollama" | "cloud";
  baseUrl?: string;
  envKeyName?: string;
}

interface ModelSelectorProps {
  selectedModel: string;
  availableModels: string[];
  modelOptions?: ModelOption[];
  showModelDropdown: boolean;
  setShowModelDropdown: (show: boolean) => void;
  setSelectedModel: (modelName: string) => void;
  setShowRoleDropdown: (show: boolean) => void; // 用于互斥关闭角色下拉框
}

export default function ModelSelector({
  selectedModel,
  availableModels,
  modelOptions = [],
  showModelDropdown,
  setShowModelDropdown,
  setSelectedModel,
  setShowRoleDropdown
}: ModelSelectorProps) {
  const getModelOption = (modelName: string): ModelOption | undefined => {
    return modelOptions.find(item => item.model === modelName);
  };

  const getModelLabel = (modelName: string): string => {
    const option = getModelOption(modelName);
    if (!option) return "云端模型";
    return option.category === "ollama" ? "ollama模型" : "云端模型";
  };

  const getModelDotClass = (modelName: string) => {
    const option = getModelOption(modelName);
    if (!option) return "bg-sky-400";

    return option.category === "ollama"
      ? "bg-emerald-400"
      : "bg-sky-400";
  };

  const getModelDisplayText = (modelName: string): string => {
    const option = getModelOption(modelName);
    if (!option) return modelName;
    return `${option.providerName}/${option.model}`;
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowModelDropdown(!showModelDropdown);
          setShowRoleDropdown(false);
        }}
        className="text-[10px] text-gray-400 hover:text-white font-semibold bg-[#202020] px-2.5 py-1.5 rounded-lg border border-[#353535] flex items-center gap-1.5 transition-colors cursor-pointer max-w-[230px]"
        title={getModelDisplayText(selectedModel)}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getModelDotClass(selectedModel)}`}></span>
        <span className="truncate">{getModelDisplayText(selectedModel)}</span>
        <ChevronUp size={10} className={`transform transition-transform shrink-0 ${showModelDropdown ? "rotate-180" : ""}`} />
      </button>

      {showModelDropdown && (
        <div className="absolute bottom-full right-0 mb-2 w-72 max-h-64 overflow-y-auto scrollbar-thin bg-[#252526] border border-[#3e3e3e] rounded-xl shadow-2xl py-1 z-50">
          {availableModels.map((modelName) => {
            const displayText = getModelDisplayText(modelName);

            return (
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
                title={displayText}
              >
                <span className="truncate">{displayText}</span>
                <span className="text-[9px] text-gray-500 font-normal">
                  {getModelLabel(modelName)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}