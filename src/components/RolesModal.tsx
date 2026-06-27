// src/components/RolesModal.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Check, UserSquare2, Sparkles, ChevronDown } from 'lucide-react';
import { Role } from '../types/chat';
import { ApiProviderConfig } from './SettingsModal';

interface RolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROLES_STORAGE_KEY = 'tangerine_roles';
const SETTINGS_STORAGE_KEY = 'tangerine_api_settings';

export default function RolesModal({ isOpen, onClose }: RolesModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [providerConfigs, setProviderConfigs] = useState<ApiProviderConfig[]>([]);

  const defaultRoles: Role[] = [
    {
      id: '1',
      name: '全能助手',
      systemPrompt: '你是一个得心应手的AI助手，请用专业、简洁的语言回答用户的问题。',
      provider: 'deepseek',
      model: 'deepseek-v4-flash'
    },
    {
      id: '2',
      name: '微框架编程大师',
      systemPrompt: '你是一位精通微服务和高内聚低耦合系统架构的资深软件专家。请用简洁、可执行的代码片段指导开发。',
      provider: 'deepseek',
      model: 'deepseek-v4-pro'
    }
  ];

  useEffect(() => {
    if (!isOpen) return;

    const savedRoles = localStorage.getItem(ROLES_STORAGE_KEY);
    if (savedRoles) {
      try {
        const parsed: Role[] = JSON.parse(savedRoles);
        setRoles(parsed);
        const firstRole = parsed[0] || null;
        setSelectedRoleId(firstRole?.id || null);
        setEditRole(firstRole ? { ...firstRole } : null);
      } catch (e) {
        console.error("加载角色模板失败:", e);
        setRoles(defaultRoles);
        localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(defaultRoles));
        setSelectedRoleId(defaultRoles[0].id);
        setEditRole({ ...defaultRoles[0] });
      }
    } else {
      setRoles(defaultRoles);
      localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(defaultRoles));
      setSelectedRoleId(defaultRoles[0].id);
      setEditRole({ ...defaultRoles[0] });
    }

    const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedConfigs) {
      try {
        const parsedConfigs = JSON.parse(savedConfigs);
        setProviderConfigs(Array.isArray(parsedConfigs) ? parsedConfigs : []);
      } catch (e) {
        console.error("加载模型配置失败:", e);
        setProviderConfigs([]);
      }
    } else {
      setProviderConfigs([]);
    }

    setErrorMsg('');
    setSavedMsg('');
  }, [isOpen]);

  const availableProviders = useMemo(() => {
    return providerConfigs
      .map(cfg => cfg.providerName?.trim())
      .filter((name): name is string => !!name);
  }, [providerConfigs]);

  const availableModelsForSelectedProvider = useMemo(() => {
    if (!editRole?.provider) return [];
    const matched = providerConfigs.find(
      cfg => cfg.providerName.toLowerCase() === editRole.provider?.toLowerCase()
    );
    return matched?.models || [];
  }, [providerConfigs, editRole?.provider]);

  const persistedSelectedRole = useMemo(() => {
    if (!selectedRoleId) return null;
    return roles.find(role => role.id === selectedRoleId) || null;
  }, [roles, selectedRoleId]);

  // 判断当前编辑内容是否已发生未保存修改
  const hasUnsavedChanges = useMemo(() => {
    if (!editRole || !persistedSelectedRole) return false;

    return (
      (editRole.name ?? '') !== (persistedSelectedRole.name ?? '') ||
      (editRole.systemPrompt ?? '') !== (persistedSelectedRole.systemPrompt ?? '') ||
      (editRole.provider ?? '') !== (persistedSelectedRole.provider ?? '') ||
      (editRole.model ?? '') !== (persistedSelectedRole.model ?? '')
    );
  }, [editRole, persistedSelectedRole]);

  // 一旦继续编辑，立即取消“已保存”视觉状态
  useEffect(() => {
    if (hasUnsavedChanges && savedMsg) {
      setSavedMsg('');
    }
  }, [hasUnsavedChanges, savedMsg]);

  if (!isOpen) return null;

  const persistRoles = (newRoles: Role[]) => {
    setRoles(newRoles);
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(newRoles));
    window.dispatchEvent(new Event("tangerine_roles_changed"));
  };

  const selectRole = (role: Role | null) => {
    setSelectedRoleId(role?.id || null);
    setEditRole(role ? { ...role } : null);
    setErrorMsg('');
    setSavedMsg('');
  };

  const handleAddRole = () => {
    const baseName = "自定义角色";
    let candidateName = baseName;
    let index = 1;

    while (roles.some(r => r.name.toLowerCase() === candidateName.toLowerCase())) {
      candidateName = `${baseName} ${index}`;
      index++;
    }

    const defaultProvider = availableProviders[0] || "";
    const defaultModels = providerConfigs.find(
      c => c.providerName.toLowerCase() === defaultProvider.toLowerCase()
    )?.models || [];

    const newRole: Role = {
      id: Date.now().toString(),
      name: candidateName,
      systemPrompt: '输入此角色的系统设定规则（System Prompt）...',
      provider: defaultProvider || undefined,
      model: defaultModels[0] || undefined
    };

    const updated = [newRole, ...roles];
    persistRoles(updated);
    selectRole(newRole);
  };

  const handleDeleteRole = (id: string) => {
    const updated = roles.filter(r => r.id !== id);
    persistRoles(updated);

    if (selectedRoleId === id) {
      const nextRole = updated[0] || null;
      selectRole(nextRole);
    }
  };

  const handleSaveEdit = () => {
    if (!editRole) return;

    const trimmedName = editRole.name.trim();
    if (!trimmedName) {
      setErrorMsg("角色名称不能为空");
      return;
    }

    const isDuplicate = roles.some(
      r => r.id !== editRole.id && r.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setErrorMsg(`已有名为“${trimmedName}”的角色，请更换名称以防冲突！`);
      return;
    }

    const nextRole: Role = {
      ...editRole,
      name: trimmedName,
      systemPrompt: editRole.systemPrompt.trim(),
      provider: editRole.provider || undefined,
      model: editRole.model || undefined
    };

    const updated = roles.map(r => r.id === nextRole.id ? nextRole : r);
    persistRoles(updated);
    setEditRole(nextRole);
    setSavedMsg("已保存");
    setErrorMsg('');
    setTimeout(() => setSavedMsg(''), 1500);
  };

  const handleProviderChange = (providerName: string) => {
    const matched = providerConfigs.find(
      cfg => cfg.providerName.toLowerCase() === providerName.toLowerCase()
    );
    const firstModel = matched?.models?.[0] || "";

    setEditRole(prev => prev ? {
      ...prev,
      provider: providerName || undefined,
      model: firstModel || undefined
    } : prev);
  };

  const handleModelChange = (modelName: string) => {
    setEditRole(prev => prev ? {
      ...prev,
      model: modelName || undefined
    } : prev);
  };

  const isSaveSuccess = !!savedMsg && !hasUnsavedChanges;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full h-full max-w-7xl bg-[#171718]/95 border border-[#2d2d2d] rounded-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* 头部条 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d2d] bg-[#121213]/90">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <UserSquare2 size={16} className="text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-gray-100 tracking-wide">我的角色设置</span>
                <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
                  SYSTEM PROMPT
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                为不同角色配置系统提示词，并可绑定默认模型提供商与模型。
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr]">
          {/* 左侧角色列表 */}
          <div className="border-r border-[#2a2a2a] bg-[#141415] flex flex-col min-h-0">
            <div className="p-4 border-b border-[#242424] shrink-0">
              <button
                onClick={handleAddRole}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#253746] hover:bg-[#2d4355] text-[#4ea1db] border border-[#2d4558] transition-colors text-xs font-semibold cursor-pointer"
              >
                <Plus size={14} />
                新建角色
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {roles.map((role) => {
                const isActive = role.id === selectedRoleId;
                return (
                  <button
                    key={role.id}
                    onClick={() => selectRole(role)}
                    className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500/[0.08] border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.06)]'
                        : 'bg-[#1b1b1c] border-[#2a2a2a] hover:bg-[#202021] hover:border-[#353535]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-amber-400" : "bg-gray-600"}`} />
                          <span className={`text-xs font-semibold truncate ${isActive ? "text-amber-300" : "text-gray-200"}`}>
                            {role.name}
                          </span>
                        </div>

                        <div className="mt-2 text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                          {role.systemPrompt}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-gray-400">
                            {role.provider || "未绑定提供商"}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-gray-400 max-w-[150px] truncate">
                            {role.model || "未绑定模型"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRole(role.id);
                        }}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="删除角色"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </button>
                );
              })}

              {roles.length === 0 && (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 text-gray-500">
                  <Sparkles size={18} className="mb-2 text-gray-600" />
                  <div className="text-xs">暂无角色，点击上方按钮创建</div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧编辑面板 */}
          <div className="min-h-0 overflow-y-auto bg-[#1a1a1b]">
            {editRole ? (
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
                      onClick={handleSaveEdit}
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
                      onChange={(e) => {
                        setEditRole(prev => prev ? { ...prev, name: e.target.value } : prev);
                        setErrorMsg('');
                      }}
                      className="w-full mt-2 bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
                      placeholder="例如：美食大师"
                    />
                  </div>

                  <div className="col-span-12 md:col-span-3">
                    <label className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">模型提供商</label>
                    <div className="relative mt-2">
                      <select
                        value={editRole.provider || ""}
                        onChange={(e) => {
                          handleProviderChange(e.target.value);
                          setErrorMsg('');
                        }}
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
                        onChange={(e) => {
                          handleModelChange(e.target.value);
                          setErrorMsg('');
                        }}
                        disabled={!editRole.provider}
                        className="w-full appearance-none bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-xl px-3 py-2.5 pr-10 text-sm text-white outline-none transition-colors cursor-pointer disabled:text-gray-600 disabled:cursor-not-allowed"
                      >
                        <option value="">不绑定</option>
                        {availableModelsForSelectedProvider.map(model => (
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
                    onChange={(e) => {
                      setEditRole(prev => prev ? { ...prev, systemPrompt: e.target.value } : prev);
                      setErrorMsg('');
                    }}
                    className="w-full mt-2 bg-[#121213] border border-[#303033] focus:border-amber-500 rounded-2xl px-4 py-3 text-sm text-gray-200 focus:outline-none resize-none min-h-[360px] leading-relaxed transition-colors"
                    placeholder="定义这个角色的人设、风格、行为边界、回答规则..."
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
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500">
                <Sparkles size={22} className="mb-3 text-gray-600" />
                <div className="text-sm font-medium text-gray-400">请选择一个角色开始编辑</div>
                <div className="text-xs mt-2">或者点击左侧按钮创建新的角色设定</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}