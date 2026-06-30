// 设置面板左侧导航栏

import { Settings as SettingsIcon, Cpu, Type } from "lucide-react";
import { SettingsTab } from "./types";

interface SettingsSidebarProps {
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}

export default function SettingsSidebar({ activeTab, setActiveTab }: SettingsSidebarProps) {
  return (
    <div className="w-[240px] bg-[#141415] border-r border-[#2d2d2e] p-6 flex flex-col justify-between shrink-0">
      <div>
        <div className="flex items-center gap-3 px-2 py-2 mb-8">
          <SettingsIcon size={18} className="text-amber-400 shrink-0" />
          <span className="text-sm font-bold text-white tracking-wider uppercase">应用设置</span>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setActiveTab("api")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
              activeTab === "api"
                ? "bg-[#2b2b2c] text-amber-400 font-bold border border-amber-500/20 shadow-sm shadow-amber-500/5"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <SettingsIcon size={15} className="shrink-0" />
            <span>云端模型设置</span>
          </button>

          <button
            onClick={() => setActiveTab("local")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
              activeTab === "local"
                ? "bg-[#2b2b2c] text-amber-400 font-bold border border-amber-500/20 shadow-sm shadow-amber-500/5"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <Cpu size={15} className="shrink-0" />
            <span>ollama模型设置</span>
          </button>

          <button
            onClick={() => setActiveTab("format")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
              activeTab === "format"
                ? "bg-[#2b2b2c] text-amber-400 font-bold border border-amber-500/20 shadow-sm shadow-amber-500/5"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <Type size={15} className="shrink-0" />
            <span>对话格式设置</span>
          </button>
        </div>
      </div>

      <div className="text-[10px] text-gray-500 font-mono px-4">
        Tangerine Config v1.1
      </div>
    </div>
  );
}