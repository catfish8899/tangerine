// src/components/roles/RolesList.tsx
import React from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import { Role } from '../../types/chat';

interface RolesListProps {
  roles: Role[];
  selectedRoleId: string | null;
  onSelect: (role: Role | null) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

export default function RolesList({ roles, selectedRoleId, onSelect, onAdd, onDelete }: RolesListProps) {
  return (
    <div className="border-r border-[#2a2a2a] bg-[#141415] flex flex-col min-h-0">
      <div className="p-4 border-b border-[#242424] shrink-0">
        <button
          onClick={onAdd}
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
              onClick={() => onSelect(role)}
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
                    onDelete(role.id);
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
  );
}