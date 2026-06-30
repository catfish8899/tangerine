// 设置面板顶部标题与关闭按钮

import { X } from "lucide-react";
import { SettingsTab } from "./types";

interface SettingsHeaderProps {
  activeTab: SettingsTab;
  onClose: () => void;
}

export default function SettingsHeader({ activeTab, onClose }: SettingsHeaderProps) {
  return (
    <div className="p-6 border-b border-white/5 shrink-0 flex items-center justify-between bg-[#19191a]">
      <div>
        <h1 className="text-lg font-bold text-white tracking-wide">
          {activeTab === "api" && "云端模型提供商配置"}
          {activeTab === "local" && "Ollama 模型配置"}
          {activeTab === "format" && "对话格式配置"}
        </h1>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
          {activeTab === "api" && "管理和修改您部署在云端的商业大语言模型 API 路由和环境变量密钥。"}
          {activeTab === "local" && "检测 Ollama 接口可用性、同步模型列表，并统一维护该接口下可调用的模型配置。"}
          {activeTab === "format" && "定制主界面聊天窗口中对话文本的排版与呈现细节。"}
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="text-[10px] text-gray-500 font-mono select-none bg-white/5 px-2.5 py-1.5 rounded">按ESC键关闭</span>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 text-gray-300 hover:text-white cursor-pointer"
          title="返回聊天"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}