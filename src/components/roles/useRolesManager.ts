// src/components/roles/useRolesManager.ts
import { useEffect, useMemo, useState } from 'react';
import { Role } from '../../types/chat';
import { ApiProviderConfig } from '../settings/types';

const ROLES_STORAGE_KEY = 'tangerine_roles';
const SETTINGS_STORAGE_KEY = 'tangerine_api_settings';

const defaultRoles: Role[] = [
  {
    id: '1',
    name: '美食大师',
    systemPrompt: '你是一个美食大师，你的回答必须具有美食大师的气质。',
    provider: 'deepseek',
    model: 'deepseek-v4-flash'
  },
  {
    id: '2',
    name: '微框架编程大师',
    systemPrompt: '你是一个微框架编程大师，使用简体中文编写代码注释。',
    provider: 'deepseek',
    model: 'deepseek-v4-pro'
  }
];

export function useRolesManager(isOpen: boolean) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [providerConfigs, setProviderConfigs] = useState<ApiProviderConfig[]>([]);

  // 初始化加载角色与 API 配置
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

  const availableModelsForSelectedProvider = useMemo<string[]>(() => {
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

  const updateEditRoleField = (field: 'name' | 'systemPrompt', value: string) => {
    setEditRole(prev => prev ? { ...prev, [field]: value } : prev);
    setErrorMsg('');
  };

  return {
    roles,
    selectedRoleId,
    editRole,
    errorMsg,
    availableProviders,
    availableModelsForSelectedProvider,
    isSaveSuccess: !!savedMsg && !hasUnsavedChanges,
    selectRole,
    handleAddRole,
    handleDeleteRole,
    handleSaveEdit,
    handleProviderChange,
    handleModelChange,
    updateEditRoleField
  };
}