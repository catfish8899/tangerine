// src/hooks/chat/useModelManager.ts
// 负责管理模型配置、API 提供商解析、模型列表同步及角色模型推断
import { useState, useEffect } from "react";
import { ChatSession, Role } from "../../types/chat";
import { ApiProviderConfig } from "../../components/settings/types";

const SETTINGS_STORAGE_KEY = "tangerine_api_settings";

export interface ResolvedModelConfig {
  provider: string;
  model: string;
  baseUrl?: string;
  envKeyName?: string;
}

export interface ModelOption {
  model: string;
  providerName: string;
  category: "ollama" | "cloud";
  baseUrl?: string;
  envKeyName?: string;
}

export function useModelManager(roles: Role[]) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [webSearchMode, setWebSearchMode] = useState<"off" | "agent">("off");

  const getSavedApiConfigs = (): ApiProviderConfig[] => {
    const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedConfigs) return [];
    try {
      const parsed = JSON.parse(savedConfigs);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("读取 API 配置失败：", e);
      return [];
    }
  };

  const getModelCategoryFromConfig = (config?: ApiProviderConfig): "ollama" | "cloud" => {
    if (!config) return "cloud";
    const providerLower = config.providerName.trim().toLowerCase();
    const baseUrlLower = config.baseUrl.trim().toLowerCase();

    if (
      providerLower === "ollama" ||
      baseUrlLower.includes("127.0.0.1:11434") ||
      baseUrlLower.includes("localhost:11434")
    ) {
      return "ollama";
    }
    return "cloud";
  };

  const findConfigByModel = (model: string): ApiProviderConfig | undefined => {
    const configs = getSavedApiConfigs();
    return configs.find(cfg => Array.isArray(cfg.models) && cfg.models.includes(model));
  };

  const inferProviderNameByModelFallback = (model: string): string => {
    const matchedConfig = findConfigByModel(model);
    if (matchedConfig?.providerName?.trim()) return matchedConfig.providerName.trim();
    return "未命名提供商";
  };

  const resolveModelConfig = (model: string, providerOverride?: string): ResolvedModelConfig => {
    const matchedConfig = findConfigByModel(model);
    if (matchedConfig) {
      return {
        provider: providerOverride?.trim() || matchedConfig.providerName,
        model,
        baseUrl: matchedConfig.baseUrl,
        envKeyName: matchedConfig.envKeyName
      };
    }
    return {
      provider: providerOverride?.trim() || inferProviderNameByModelFallback(model),
      model,
      baseUrl: undefined,
      envKeyName: undefined
    };
  };

  const getModelOptionByName = (model: string): ModelOption | undefined => {
    return modelOptions.find(item => item.model === model);
  };

  const syncModelsFromSettings = () => {
    const parsed = getSavedApiConfigs();
    const options: ModelOption[] = parsed.flatMap(cfg => {
      const models = Array.isArray(cfg.models) ? cfg.models.filter(Boolean) : [];
      const category = getModelCategoryFromConfig(cfg);
      return models.map((model: string) => ({
        model,
        providerName: cfg.providerName || "未命名提供商",
        category,
        baseUrl: cfg.baseUrl,
        envKeyName: cfg.envKeyName
      }));
    });

    const allModels = options.map(item => item.model);

    if (allModels.length > 0) {
      setModelOptions(options);
      setAvailableModels(allModels);
      setSelectedModel(prev => (prev && allModels.includes(prev) ? prev : allModels[0]));
      return;
    }

    const fallbackModels = ["deepseek-v4-flash", "deepseek-v4-pro"];
    setModelOptions(fallbackModels.map(model => ({
      model, providerName: "未命名提供商", category: "cloud" as const
    })));
    setAvailableModels(fallbackModels);
    setSelectedModel(prev => (prev && fallbackModels.includes(prev) ? prev : fallbackModels[0]));
  };

  const getRoleResolvedModelInfo = (session?: ChatSession): ResolvedModelConfig => {
    const fallbackResolved = resolveModelConfig(selectedModel);
    if (!session || session.type !== "automation" || !session.roleId) {
      return fallbackResolved;
    }
    const role = roles.find(r => r.id === session.roleId);
    if (role?.model?.trim()) {
      return resolveModelConfig(role.model.trim(), role.provider?.trim());
    }
    return fallbackResolved;
  };

  // 监听 API 设置变更自定义事件
  useEffect(() => {
    const handleApiSettingsChanged = () => syncModelsFromSettings();
    window.addEventListener("tangerine_api_settings_changed", handleApiSettingsChanged as EventListener);
    return () => window.removeEventListener("tangerine_api_settings_changed", handleApiSettingsChanged as EventListener);
  }, []);

  // 初始化时同步一次
  useEffect(() => {
    syncModelsFromSettings();
  }, []);

  return {
    selectedModel, setSelectedModel,
    availableModels, setAvailableModels,
    modelOptions, setModelOptions,
    webSearchMode, setWebSearchMode,
    syncModelsFromSettings,
    getRoleResolvedModelInfo,
    getModelOptionByName
  };
}