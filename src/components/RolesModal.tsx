// src/components/RolesModal.tsx
import React from 'react';
import { X, UserSquare2 } from 'lucide-react';
import RolesList from './roles/RolesList';
import RoleEditor from './roles/RoleEditor';
import { useRolesManager } from './roles/useRolesManager';

interface RolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RolesModal({ isOpen, onClose }: RolesModalProps) {
  const {
    roles,
    selectedRoleId,
    editRole,
    errorMsg,
    availableProviders,
    availableModelsForSelectedProvider,
    isSaveSuccess,
    selectRole,
    handleAddRole,
    handleDeleteRole,
    handleSaveEdit,
    handleProviderChange,
    handleModelChange,
    updateEditRoleField
  } = useRolesManager(isOpen);

  if (!isOpen) return null;

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
                <span className="text-sm font-semibold text-gray-100 tracking-wide">模型角色设置</span>
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
          <RolesList 
            roles={roles}
            selectedRoleId={selectedRoleId}
            onSelect={selectRole}
            onAdd={handleAddRole}
            onDelete={handleDeleteRole}
          />

          {/* 右侧编辑面板 */}
          <RoleEditor
            editRole={editRole}
            availableProviders={availableProviders}
            availableModels={availableModelsForSelectedProvider}
            errorMsg={errorMsg}
            isSaveSuccess={isSaveSuccess}
            onSave={handleSaveEdit}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
            onFieldChange={updateEditRoleField}
          />
        </div>
      </div>
    </div>
  );
}