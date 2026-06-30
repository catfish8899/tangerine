// 设置面板核心状态管理与业务逻辑 Hook

import { useState, useEffect } from "react";
import { ApiProviderConfig, SettingsTab, OllamaStatus } from "./types";
import { SETTINGS_STORAGE_KEY, FONT_SIZE_STORAGE_KEY, DEFAULT_CONFIGS } from "./constants";

export function useSettingsManager(isOpen: boolean) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("api");
  const [configs, setConfigs] = useState<ApiProviderConfig[]>([]);
  const [savedStatus, setSavedStatus] = useState<{ [key: string]: boolean }>({});
  const [collapsedModels, setCollapsedModels] = useState<{ [key: string]: boolean }>({});

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("unknown");
  const [ollamaStatusMsg, setOllamaStatusMsg] = useState<string>("尚未检测");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [fontSize, setFontSize] = useState<string>("12px");
  const [fontSizeSaved, setFontSizeSaved] = useState(false);

  // 初始化加载本地存储的设置
  useEffect(() => {
    const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedConfigs) {
      try {
        const parsed = JSON.parse(savedConfigs);
        if (Array.isArray(parsed)) {
          setConfigs(parsed);
        } else {
          setConfigs(DEFAULT_CONFIGS);
        }
      } catch (e) {
        console.error("加载设置失败：", e);
        setConfigs(DEFAULT_CONFIGS);
      }
    } else {
      setConfigs(DEFAULT_CONFIGS);
    }

    const savedFontSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (savedFontSize) {
      setFontSize(savedFontSize);
    } else {
      setFontSize("12px");
    }
  }, [isOpen]);

  // 检测 Ollama 状态
  const checkOllamaStatus = async () => {
    setOllamaStatus("checking");
    setOllamaStatusMsg("正在连接本地后端代理...");
    try {
      const res = await fetch("http://127.0.0.1:5678/api/ollama/status");
      const data = await res.json();
      if (data.status === "online") {
        setOllamaStatus("online");
        setOllamaStatusMsg("服务在线 (Online)");
      } else {
        setOllamaStatus("offline");
        setOllamaStatusMsg(data.message || "服务不可用 (Unavailable)");
      }
    } catch (err) {
      setOllamaStatus("offline");
      setOllamaStatusMsg("连接 Python Sidecar 失败，请检查后端运行状态");
    }
  };

  // 同步 Ollama 模型
  const syncOllamaModels = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("http://127.0.0.1:5678/api/ollama/tags");
      if (!res.ok) throw new Error("获取模型列表失败");

      const data = await res.json();
      if (data.status === "success" && data.models) {
        const fetchedModels = data.models;

        if (fetchedModels.length === 0) {
          alert("Ollama 接口连接成功，但当前接口未返回可用模型列表。若为本地服务，请先执行 'ollama run <model>' 下载并拉起模型。");
          return;
        }

        const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
        let currentConfigs: ApiProviderConfig[] = [];
        if (savedConfigs) {
          try { currentConfigs = JSON.parse(savedConfigs); } catch (e) {}
        }

        const ollamaIdx = currentConfigs.findIndex(c => c.providerName.trim().toLowerCase() === "ollama");
        const ollamaConfig: ApiProviderConfig = {
          id: "ollama-local",
          providerName: "Ollama",
          baseUrl: "http://127.0.0.1:11434",
          envKeyName: "None (Local)",
          models: fetchedModels
        };

        if (ollamaIdx > -1) {
          currentConfigs[ollamaIdx] = ollamaConfig;
        } else {
          currentConfigs.push(ollamaConfig);
        }

        setConfigs(currentConfigs);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(currentConfigs));
        window.dispatchEvent(new Event("tangerine_api_settings_changed"));

        alert(`已成功同步 ${fetchedModels.length} 个 Ollama 模型并写入配置。`);
      } else {
        alert("未能获取到有效的 Ollama 模型列表。");
      }
    } catch (err: any) {
      alert(`模型同步失败: ${err.message || "网络请求异常"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 更新配置字段
  const updateConfigField = (id: string, field: keyof ApiProviderConfig, value: any) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    if (savedStatus[id]) {
      setSavedStatus(prev => ({ ...prev, [id]: false }));
    }
  };

  // 模型列表操作
  const handleModelChange = (id: string, index: number, value: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === id) {
        const newModels = [...c.models];
        newModels[index] = value;
        return { ...c, models: newModels };
      }
      return c;
    }));
    setSavedStatus(prev => ({ ...prev, [id]: false }));
  };

  const handleAddModel = (id: string) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, models: [...c.models, "new-model"] };
      }
      return c;
    }));
    setSavedStatus(prev => ({ ...prev, [id]: false }));
  };

  const handleRemoveModel = (id: string, index: number) => {
    setConfigs(prev => prev.map(c => {
      if (c.id === id) {
        const newModels = c.models.filter((_, i) => i !== index);
        return { ...c, models: newModels };
      }
      return c;
    }));
    setSavedStatus(prev => ({ ...prev, [id]: false }));
  };

  // 保存与删除配置块
  const handleSaveConfig = (id: string) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(configs));
    setSavedStatus(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSavedStatus(prev => ({ ...prev, [id]: false }));
    }, 2000);
    window.dispatchEvent(new Event("tangerine_api_settings_changed"));
  };

  const handleAddConfigBlock = () => {
    const newId = Date.now().toString();
    const newConfig: ApiProviderConfig = {
      id: newId,
      providerName: "自定义提供商",
      baseUrl: "https://api.example.com/v1",
      envKeyName: "CUSTOM_API_KEY",
      models: ["model-v1"],
    };
    setConfigs(prev => [...prev, newConfig]);
  };

  const handleRemoveConfigBlock = (id: string) => {
    const filtered = configs.filter(c => c.id !== id);
    setConfigs(filtered);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event("tangerine_api_settings_changed"));
  };

  // 字号保存
  const handleSaveFontSize = (newSize: string) => {
    setFontSize(newSize);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, newSize);
    window.dispatchEvent(new Event("storage_font_size_changed"));
    setFontSizeSaved(true);
    setTimeout(() => setFontSizeSaved(false), 1500);
  };

  // 折叠状态切换
  const toggleCollapse = (id: string) => {
    setCollapsedModels(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // 数据派生
  const cloudConfigs = configs.filter(c => c.providerName.trim().toLowerCase() !== "ollama");
  const ollamaConfig = configs.find(c => c.providerName.trim().toLowerCase() === "ollama");

  return {
    activeTab, setActiveTab,
    configs, savedStatus, collapsedModels,
    ollamaStatus, ollamaStatusMsg, isSyncing,
    fontSize, fontSizeSaved,
    cloudConfigs, ollamaConfig,
    checkOllamaStatus, syncOllamaModels,
    updateConfigField, handleModelChange, handleAddModel, handleRemoveModel,
    handleSaveConfig, handleAddConfigBlock, handleRemoveConfigBlock,
    handleSaveFontSize, toggleCollapse
  };
}