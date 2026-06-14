// src/components/Sidebar.tsx 的完整修改版
import { 
  Search, 
  SlidersHorizontal, 
  Plus, 
  Image as ImageIcon, 
  UserSquare2, 
  Settings, 
  HelpCircle, 
  Info 
} from "lucide-react";

interface Message {
  id: string;
  sender: "user" | "ai" | "system_err";
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, sessionId: string) => void;
  onCreateSession: () => void;
  onOpenSettings: () => void; // 👈 新增：开启设置按钮回调
}

export default function Sidebar({
  sessions,
  activeSessionId,
  setActiveSessionId,
  onContextMenu,
  onCreateSession,
  onOpenSettings // 👈 接收回调参数
}: SidebarProps) {
  return (
    <div className="w-[260px] bg-[#181818] flex flex-col border-r border-[#2d2d2d] shrink-0 justify-between">
      <div className="flex flex-col pt-4 px-3 overflow-hidden">
        <div className="flex items-center justify-between px-2 mb-4 shrink-0">
          <span className="text-xs text-gray-400 font-semibold tracking-wider">聊天</span>
          <div className="flex gap-3 text-gray-400">
            <Search size={15} className="hover:text-white cursor-pointer" />
            <SlidersHorizontal size={15} className="hover:text-white cursor-pointer" />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="space-y-[2px] overflow-y-auto flex-1 pr-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              onContextMenu={(e) => onContextMenu(e, session.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                session.id === activeSessionId 
                  ? 'bg-[#2c2c2c] text-white' 
                  : 'hover:bg-[#202020] text-gray-400'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                🤖
              </div>
              <span className="text-xs truncate font-medium">{session.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 底部功能区 */}
      <div className="p-3 border-t border-[#262626] space-y-3 bg-[#181818] shrink-0">
        <div className="space-y-2">
          <button 
            onClick={onCreateSession}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-[#253746] hover:bg-[#2d4355] text-[#4ea1db] border border-[#2d4558] transition-colors text-xs font-semibold"
          >
            <Plus size={14} />
            新对话
          </button>
          <button className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md bg-[#1e272e] hover:bg-[#253039] text-[#4ea1db]/80 border border-[#232f3a] transition-colors text-xs font-semibold">
            <ImageIcon size={14} />
            新自动化流程
          </button>
        </div>

        <div className="space-y-1 text-xs text-gray-400 pt-2 border-t border-[#252525]">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#252525] hover:text-white cursor-pointer transition-colors">
            <UserSquare2 size={15} />
            <span>我的角色</span>
          </div>
          
          <div className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#252525] hover:text-white cursor-pointer transition-colors">
            <HelpCircle size={15} />
            <span>我的文件</span>
          </div>
          {/* 设置按钮 👈 绑定点击事件 */}
          <div 
            onClick={onOpenSettings} 
            className="flex items-center gap-2.5 px-3 py-2 rounded hover:bg-[#252525] hover:text-white cursor-pointer transition-colors"
          >
            <Settings size={15} />
            <span>设置</span>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded text-[11px] text-gray-600">
            <Info size={13} />
            <span>当前版本 tangerine 1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
