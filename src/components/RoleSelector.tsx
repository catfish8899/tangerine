import React from "react";
import { ChevronUp, UserSquare2 } from "lucide-react";
import { Role } from "../types/chat";

interface RoleSelectorProps {
  roles: Role[];
  activeRole?: Role;
  activeRoleId?: string;
  canSelectRole: boolean;
  showRoleDropdown: boolean;
  setShowRoleDropdown: (show: boolean) => void;
  onSelectRole: (roleId: string) => void;
  setShowModelDropdown: (show: boolean) => void; // 用于互斥关闭模型下拉框
}

export default function RoleSelector({
  roles,
  activeRole,
  activeRoleId,
  canSelectRole,
  showRoleDropdown,
  setShowRoleDropdown,
  onSelectRole,
  setShowModelDropdown
}: RoleSelectorProps) {
  const getRoleButtonText = () => {
    if (activeRole) return activeRole.name;
    return "未设角色";
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (roles.length === 0) return;
          setShowRoleDropdown(!showRoleDropdown);
          setShowModelDropdown(false);
        }}
        title={
          roles.length === 0
            ? "暂无角色，请先到“我的角色”创建"
            : canSelectRole
            ? "选择会话角色设定"
            : "当前会话已有内容，角色已锁定"
        }
        className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
          roles.length === 0
            ? "bg-[#232323] border-[#353535] text-gray-600 cursor-not-allowed"
            : activeRole
            ? "bg-amber-500/[0.08] border-amber-500/20 text-amber-300 hover:bg-amber-500/[0.15]"
            : "bg-[#202020] border-[#353535] text-gray-300 hover:text-white"
        }`}
      >
        <UserSquare2 size={12} />
        <span className="max-w-[92px] truncate">{getRoleButtonText()}</span>
        <ChevronUp size={10} className={`transform transition-transform ${showRoleDropdown ? "rotate-180" : ""}`} />
      </button>

      {showRoleDropdown && roles.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-60 max-h-72 overflow-y-auto scrollbar-thin bg-[#252526] border border-[#3e3e3e] rounded-xl shadow-2xl py-1.5 z-50">
          <div className="px-3 pt-2 pb-1.5 text-[10px] text-gray-500 font-semibold tracking-wider">
            角色设定
          </div>

          <button
            type="button"
            onClick={() => {
              onSelectRole("");
              setShowRoleDropdown(false);
            }}
            disabled={!canSelectRole}
            className={`w-full text-left px-3 py-2 transition-colors flex flex-col ${
              !canSelectRole
                ? "text-gray-600 cursor-not-allowed"
                : !activeRoleId
                ? "text-amber-400 bg-amber-500/[0.06]"
                : "text-gray-300 hover:bg-[#333]"
            }`}
          >
            <span className="text-xs font-semibold">不使用角色</span>
            <span className="text-[9px] text-gray-500 font-normal">
              使用通用系统提示词与当前模型
            </span>
          </button>

          <div className="my-1 border-t border-[#343434]" />

          {roles.map((role) => (
            <button
              type="button"
              key={role.id}
              onClick={() => {
                onSelectRole(role.id);
                setShowRoleDropdown(false);
              }}
              disabled={!canSelectRole}
              className={`w-full text-left px-3 py-2 transition-colors flex flex-col ${
                !canSelectRole
                  ? "text-gray-600 cursor-not-allowed"
                  : activeRoleId === role.id
                  ? "text-amber-400 bg-amber-500/[0.06]"
                  : "text-gray-300 hover:bg-[#333]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${activeRoleId === role.id ? "bg-amber-400" : "bg-gray-600"}`} />
                <span className="text-xs font-semibold truncate">{role.name}</span>
              </div>
              <span className="text-[9px] text-gray-500 font-normal mt-0.5 line-clamp-2">
                {role.provider && role.model
                  ? `画布绑定: ${role.provider} / ${role.model}`
                  : "未绑定画布专属模型"}
              </span>
            </button>
          ))}

          {!canSelectRole && (
            <div className="px-3 py-2 text-[10px] text-amber-400/80 border-t border-[#343434] mt-1">
              当前会话已有消息，角色已锁定不可切换
            </div>
          )}
        </div>
      )}
    </div>
  );
}