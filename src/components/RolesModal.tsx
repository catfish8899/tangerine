// src/components/RolesModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit3, Check } from 'lucide-react';
import { Role } from '../types/chat';

interface RolesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RolesModal({ isOpen, onClose }: RolesModalProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. 挂载加载本地缓存角色
  useEffect(() => {
    if (isOpen) {
      const savedRoles = localStorage.getItem('tangerine_roles');
      if (savedRoles) {
        try {
          setRoles(JSON.parse(savedRoles));
        } catch (e) {
          console.error("加载角色模板失败:", e);
        }
      } else {
        const defaultRoles: Role[] = [
          { id: '1', name: '全能助手', systemPrompt: '你是一个得心应手的AI助手，请用专业、简洁的语言回答用户的问题。' },
          { id: '2', name: '微框架编程大师', systemPrompt: '你是一位精通微服务和高内聚低耦合系统架构的资深软件专家。请用简洁、可执行的代码片段指导开发。' }
        ];
        setRoles(defaultRoles);
        localStorage.setItem('tangerine_roles', JSON.stringify(defaultRoles));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 统一保存状态到本地存储
  const saveRoles = (newRoles: Role[]) => {
    setRoles(newRoles);
    localStorage.setItem('tangerine_roles', JSON.stringify(newRoles));
  };

  // 2. 添加新角色 (自动抗重名命名)
  const handleAddRole = () => {
    const baseName = "自定义角色";
    let candidateName = baseName;
    let index = 1;
    while (roles.some(r => r.name === candidateName)) {
      candidateName = `${baseName} ${index}`;
      index++;
    }

    const newRole: Role = {
      id: Date.now().toString(),
      name: candidateName,
      systemPrompt: '输入此角色的系统设定规则（System Prompt）...'
    };

    const updated = [...roles, newRole];
    saveRoles(updated);
    startEdit(newRole);
  };

  // 进入编辑
  const startEdit = (role: Role) => {
    setEditingId(role.id);
    setEditName(role.name);
    setEditPrompt(role.systemPrompt);
    setErrorMsg('');
  };

  // 3. 校验并保存编辑 (严格执行不能重名策略)
  const handleSaveEdit = (id: string) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setErrorMsg("角色名称不能为空");
      return;
    }

    const isDuplicate = roles.some(r => r.id !== id && r.name.toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicate) {
      setErrorMsg("已有名为“" + trimmedName + "”的角色，请更换名称以防冲突！");
      return;
    }

    const updated = roles.map(r => r.id === id ? { ...r, name: trimmedName, systemPrompt: editPrompt } : r);
    saveRoles(updated);
    setEditingId(null);
    setErrorMsg('');
  };

  // 4. 删除角色
  const handleDeleteRole = (id: string) => {
    const updated = roles.filter(r => r.id !== id);
    saveRoles(updated);
    if (editingId === id) setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-md select-none transition-all duration-300">
      <div className="relative w-full h-full max-w-5xl bg-[#1e1e1e]/90 border border-[#2d2d2d] rounded-xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* 头部条 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2d2d] bg-[#141414]/80">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-gray-200 tracking-wider">我的角色设置</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">SYSTEM PROMPT</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#2a2a2a] rounded text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 滚动卡片容器 */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 align-content-start">
          {roles.map((role) => {
            const isEditing = editingId === role.id;
            return (
              <div 
                key={role.id} 
                className={`flex flex-col justify-between p-4 rounded-lg border transition-all duration-200 min-h-[200px] ${
                  isEditing 
                    ? 'bg-[#282828] border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.08)]' 
                    : 'bg-[#1e1e1e] border-[#2d2d2d] hover:border-[#3d3d3d] hover:bg-[#222]'
                }`}
              >
                <div className="flex-1 flex flex-col">
                  {isEditing ? (
                    <div className="space-y-3 flex-1 flex flex-col">
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold uppercase">角色名称</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full mt-1 bg-[#141414] border border-[#3d3d3d] focus:border-amber-500 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          placeholder="角色名称"
                        />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <label className="text-[10px] text-gray-500 font-semibold uppercase">系统提示词 (System Prompt)</label>
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          className="w-full flex-1 mt-1 bg-[#141414] border border-[#3d3d3d] focus:border-amber-500 rounded px-2.5 py-1.5 text-xs text-gray-300 focus:outline-none resize-none min-h-[100px]"
                          placeholder="当用户对你发起会话时，AI 所预置扮演的身份和需要恪守的指令边界..."
                        />
                      </div>
                      {errorMsg && <p className="text-[10px] text-red-400 font-medium">{errorMsg}</p>}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        <h4 className="font-semibold text-xs text-gray-200 truncate">{role.name}</h4>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap flex-1 overflow-hidden line-clamp-6">
                        {role.systemPrompt}
                      </p>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#2d2d2d]/60 flex justify-end gap-2 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(role.id)}
                        className="flex items-center gap-1 text-[11px] bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded font-medium transition-colors cursor-pointer"
                      >
                        <Check size={12} /> 保存
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setErrorMsg(''); }}
                        className="text-[11px] bg-[#333] hover:bg-[#3d3d3d] text-gray-300 px-3 py-1.5 rounded transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(role)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-[#2d2d2d] rounded transition-colors cursor-pointer"
                        title="编辑角色信息"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#2d2d2d] rounded transition-colors cursor-pointer"
                        title="物理删除此卡片"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* 新增卡片虚线按钮 */}
          <button
            onClick={handleAddRole}
            className="flex flex-col items-center justify-center p-4 rounded-lg border border-dashed border-[#2d2d2d] hover:border-amber-500/40 bg-transparent hover:bg-amber-500/[0.02] transition-all duration-200 min-h-[200px] text-gray-500 hover:text-amber-500 group cursor-pointer"
          >
            <Plus className="w-6 h-6 mb-1.5 group-hover:scale-110 transition-transform duration-200" />
            <span className="text-xs font-semibold">创建新角色设定</span>
          </button>
        </div>
      </div>
    </div>
  );
}
