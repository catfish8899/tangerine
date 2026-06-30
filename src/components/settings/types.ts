// 设置面板相关的类型定义

export interface ApiProviderConfig {
  id: string;
  providerName: string;
  baseUrl: string;
  envKeyName: string;
  models: string[];
}

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type SettingsTab = "api" | "local" | "format";
export type OllamaStatus = "unknown" | "online" | "offline" | "checking";