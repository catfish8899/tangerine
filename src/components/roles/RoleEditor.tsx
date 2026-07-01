// src/components/roles/RoleEditor.tsx
import React from 'react';
import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { Role } from '../../types/chat';

interface RoleEditorProps {
  editRole: Role | null;
  availableProviders: string[];
  availableModels: string[];
  errorMsg: string;
  isSaveSuccess: boolean;
  onSave: () => void;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onFieldChange: (field: 'name' | 'systemPrompt', value: string) => void;
}

export default function RoleEditor({
  editRole,
  availableProviders,
  availableModels,
  errorMsg,
  isSaveSuccess,
  onSave,
  onProviderChange,
  onModelChange,
  onFieldChange
}: RoleEditorProps) {
  if (!editRole) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
        <Sparkles size={22} className="mb-3 text-gray-600" />
        <div className="text-sm font-medium text-gray-400">请选择一个角色开始编辑</div>
        <div className="text-xs mt-2">或者点击左侧按钮创建新的角色设定</div>
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-y-auto bg-[#1a1a1b]">
      <div className="max-w-4xl p-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white tracking-wide">
              编辑角色
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              当前角色会话绑定后，其系统提示词将通过 system 通道注入，且可指定默认模型。
            </p>
          </div>

          <div className="flex items-center gap-3">
            {errorMsg && (
              <span className="text-xs text-red-400 font-medium">{errorMsg}</span>
            )}

            <button
              onClick={onSave}
              className={`flex items-center px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                isSaveSuccess
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : "bg-[#253746] border-[#2d4558] text-[#4ea1db] hover:bg-[#2d4355]"
              } ${isSaveSuccess ? "gap-1.5" : ""}`}
            >
              {isSaveSuccess && <Check size={12} />}
              <span>{isSaveSuccess ? "已保存" : "保存角色"}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 md:col-span-5">
            <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">角色名称</label>
            <input
              type="text"
              value={editRole.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              className="w-full mt-2 bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
              placeholder="例如：美食大师"
            />
          </div>

          <div className="col-span-12 md:col-span-3">
            <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">模型提供商</label>
            <div className="relative mt-2">
              <select
                value={editRole.provider || ""}
                onChange={(e) => onProviderChange(e.target.value)}
                className="w-full appearance-none bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-xl px-3 py-2.5 pr-10 text-sm text-white outline-none transition-colors cursor-pointer"
              >
                <option value="">不绑定</option>
                {availableProviders.map(provider => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <ChevronDown size={15} />
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">模型</label>
            <div className="relative mt-2">
              <select
                value={editRole.model || ""}
                onChange={(e) => onModelChange(e.target.value)}
                disabled={!editRole.provider}
                className="w-full appearance-none bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-xl px-3 py-2.5 pr-10 text-sm text-white outline-none transition-colors cursor-pointer disabled:text-gray-600 disabled:cursor-not-allowed"
              >
                <option value="">不绑定</option>
                {availableModels.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                <ChevronDown size={15} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">
            系统提示词（System Prompt）
          </label>
          <textarea
            value={editRole.systemPrompt}
            onChange={(e) => onFieldChange('systemPrompt', e.target.value)}
            className="w-full mt-2 bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-gray-200 focus:outline-none resize-none min-h-[360px] leading-relaxed transition-colors"
            placeholder="定义角色的人设、风格等..."
          />
        </div>

        <div className="rounded-2xl border border-[#2b2b2e] bg-[#141415] p-4">
          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2">
            当前绑定效果预览
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">角色：</span>
              <span className="text-gray-200">{editRole.name || "未命名角色"}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">提供商：</span>
              <span className="text-gray-200">{editRole.provider || "未绑定，跟随主界面当前模型"}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">模型：</span>
              <span className="text-gray-200 break-all">{editRole.model || "未绑定，跟随主界面当前模型"}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 shrink-0">提示词：</span>
              <span className="text-gray-400 leading-relaxed line-clamp-4">{editRole.systemPrompt}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}