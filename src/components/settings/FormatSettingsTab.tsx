// 对话格式设置 Tab 内容

import { Check, ChevronDown } from "lucide-react";
import { PRESET_FONT_SIZES } from "./constants";

interface FormatSettingsTabProps {
  fontSize: string;
  fontSizeSaved: boolean;
  onSaveFontSize: (size: string) => void;
}

export default function FormatSettingsTab({ fontSize, fontSizeSaved, onSaveFontSize }: FormatSettingsTabProps) {
  return (
    <div className="p-6 rounded-xl border border-white/5 bg-[#141415] shadow-lg max-w-2xl">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
        <span className="text-xs font-bold text-amber-400 tracking-wider uppercase font-mono">
          排版与外观
        </span>
        {fontSizeSaved && (
          <span className="text-xs text-green-400 flex items-center gap-1">
            <Check size={12} /> 字号已应用
          </span>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-200 font-semibold">调整字号</label>
            <span className="text-[10px] text-gray-400 font-mono bg-[#1d1d1e] px-2 py-0.5 rounded border border-white/5">
              当前大小: {fontSize}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            仅缩放对话消息框内部的消息文字及 AI 回复内容。不影响按钮、输入框、侧边栏等应用框架元素。
          </p>

          <div className="relative mt-2 max-w-xs">
            <select
              value={fontSize}
              onChange={(e) => onSaveFontSize(e.target.value)}
              className="w-full bg-[#1d1d1e] border border-white/10 rounded-md px-3.5 py-2.5 text-xs text-white font-medium outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-all cursor-pointer appearance-none"
            >
              {PRESET_FONT_SIZES.map((size) => (
                <option key={size.value} value={size.value} className="bg-[#1c1c1d] py-2 text-xs">
                  {size.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>

        <div className="border border-white/5 rounded-lg bg-[#19191a] p-4 mt-4">
          <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-2.5">效果预览 (以选定字号渲染)：</span>
          <div className="space-y-3">
            <div className="flex justify-end">
              <div
                style={{ fontSize: fontSize }}
                className="max-w-[85%] p-3 rounded-lg bg-[#2b6cb0] text-white rounded-tr-none leading-relaxed"
              >
                热狗🌭的起源是什么
              </div>
            </div>
            <div className="flex justify-start">
              <div
                style={{ fontSize: fontSize }}
                className="max-w-[85%] p-3 rounded-lg bg-[#2e2e2e] text-gray-200 border border-[#3a3a3a] rounded-tl-none leading-relaxed"
              >
                热狗的起源主要与德国和奥地利的香肠传统有关，后来在美国演变成如今常见的“面包夹香肠”形式...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}