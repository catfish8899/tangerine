// src/types/chat.ts
export interface Message {
  id: string;
  sender: "user" | "ai" | "system_err";
  text: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  timestamp?: number;
  attachments?: AttachmentFile[]; 
  isStopped?: boolean;
  isEditing?: boolean;
  activeBranchIndex?: number;
  branches?: Message[][];
  sources?: Array<{ title: string; url: string }>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  roleId?: string;
  type?: "chat" | "automation";
}

export interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  provider?: string;
  model?: string;
}

export interface AttachmentFile {
  name: string;
  path: string; 
  type: "image" | "audio" | "code" | "office" | "other";
  
  localRelativePath?: string; // 用于 JSON 持久化和发给后端
  previewUrl?: string;        // 改回 previewUrl，用于前端 <img> 渲染 (Base64 Data URL)
  
  previewError?: string; 
}

export function getFileType(fileName: string): "image" | "audio" | "code" | "office" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (["py", "js", "ts", "tsx", "jsx", "rs", "go", "cpp", "c", "html", "css", "json", "yaml", "yml", "sh"].includes(ext)) return "code";
  if (["docx", "doc", "xlsx", "xls", "pptx", "ppt", "pdf", "rtf", "epub", "mobi", "csv"].includes(ext)) return "office";
  return "other";
}

export function getImageMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  return "application/octet-stream";
}

export function format12HourTime(timestamp?: number): string {
  if (!timestamp) return "未知";
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "下午" : "上午";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? "0" + minutes : minutes;
  return `${ampm} ${hours}:${minutesStr}`;
}