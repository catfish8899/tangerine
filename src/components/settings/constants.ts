// 设置面板相关的常量配置

import { ApiProviderConfig } from "./types";

export const SETTINGS_STORAGE_KEY = "tangerine_api_settings";
export const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";

/**
 * 默认配置说明：
 * 1. 保留现有 DeepSeek / Gemini 默认入口；
 * 2. 后续业务逻辑不再依赖提供商名称硬编码判断能力；
 * 3. 真正调用时以 baseUrl / envKeyName / providerName 综合决定；
 * 4. 用户可自行将 providerName 改成任意名称，系统会按用户填写名称展示。
 */
export const DEFAULT_CONFIGS: ApiProviderConfig[] = [
  {
    id: "deepseek-default",
    providerName: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    envKeyName: "DEEPSEEK_API_KEY",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  },
  {
    id: "gemini-default",
    providerName: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    envKeyName: "GEMINI_API_KEY",
    models: ["gemini-2.5-flash"],
  }
];

export const PRESET_FONT_SIZES = [
  { label: "12px (默认)", value: "12px" },
  { label: "13px", value: "13px" },
  { label: "14px", value: "14px" },
  { label: "15px", value: "15px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
];