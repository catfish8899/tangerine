// src/types/chat.ts
export interface Message {
  id: string;
  sender: "user" | "ai" | "system_err";
  text: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  timestamp?: number;
  filePaths?: string[]; // 记录本次消息关联的文件绝对路径列表
  
  // 👇 编辑和分支管理字段
  isEditing?: boolean;
  activeBranchIndex?: number;
  branches?: Message[][]; // 存储该用户消息发起的分支（每个分支包含该节点之后的所有后续消息数组）

  // 👇 新增：保存 Tavily 联网检索的来源网页列表（每个来源包括标题和跳转链接）
  sources?: Array<{ title: string; url: string }>;
}

// 👇 修改：增加角色 ID 绑定支持
export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  roleId?: string; // 👈 绑定到当前会话的角色 ID
}

// 👇 新增：角色系统提示词接口定义
export interface Role {
  id: string;
  name: string;
  systemPrompt: string;
}

export interface AttachmentFile {
  name: string;
  path: string;
  type: 'image' | 'audio' | 'code' | 'office' | 'other';
}

// 辅助函数：根据文件名推断附件卡片展示类型
export function getFileType(fileName: string): 'image' | 'audio' | 'code' | 'office' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (['py', 'js', 'ts', 'tsx', 'jsx', 'rs', 'go', 'cpp', 'c', 'html', 'css', 'json', 'yaml', 'sh'].includes(ext)) return 'code';
  if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf', 'rtf', 'epub', 'mobi'].includes(ext)) return 'office';
  return 'other';
}

// 辅助函数：将时间戳格式化为 12 小时制
export function format12HourTime(timestamp?: number): string {
  if (!timestamp) return "未知";
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "下午" : "上午";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 点应该显示为 12 点
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;
  return `${ampm} ${hours}:${minutesStr}`;
}
