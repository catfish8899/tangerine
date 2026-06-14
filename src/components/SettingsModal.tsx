// src/components/SettingsModal.tsx
import { useState, useEffect } from "react";
import { 
  X, 
  Save, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  Settings as SettingsIcon,
  Check,
  Type
} from "lucide-react";

export interface ApiProviderConfig {
  id: string;
  providerName: string;
  baseUrl: string;
  envKeyName: string;
  models: string[];
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SETTINGS_STORAGE_KEY = "tangerine_api_settings";
const FONT_SIZE_STORAGE_KEY = "tangerine_font_size";

const DEFAULT_CONFIGS: ApiProviderConfig[] = [
  {
    id: "deepseek-default",
    providerName: "deepseek",
    baseUrl: "https://api.deepseek.com",
    envKeyName: "DEEPSEEK_API_KEY",
    models: ["deepseek-v4-flash", "deepseek-v4-pro"],
  }
];

const PRESET_FONT_SIZES = [
  { label: "12px (默认)", value: "12px" },
  { label: "13px", value: "13px" },
  { label: "14px", value: "14px" },
  { label: "15px", value: "15px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"api" | "format">("api");
  const [configs, setConfigs] = useState<ApiProviderConfig[]>([]);
  const [savedStatus, setSavedStatus] = useState<{ [key: string]: boolean }>({});
  const [collapsedModels, setCollapsedModels] = useState<{ [key: string]: boolean }>({});
  
  // 字号状态
  const [fontSize, setFontSize] = useState<string>("12px");
  const [fontSizeSaved, setFontSizeSaved] = useState(false);

  useEffect(() => {
    // 加载 API 节点配置
    const savedConfigs = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedConfigs) {
      try {
        setConfigs(JSON.parse(savedConfigs));
      } catch (e) {
        console.error("加载设置失败：", e);
        setConfigs(DEFAULT_CONFIGS);
      }
    } else {
      setConfigs(DEFAULT_CONFIGS);
    }

    // 加载字号设置
    const savedFontSize = localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    if (savedFontSize) {
      setFontSize(savedFontSize);
    } else {
      setFontSize("12px");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const updateConfigField = (id: string, field: keyof ApiProviderConfig, value: any) => {
    setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    if (savedStatus[id]) {
      setSavedStatus(prev => ({ ...prev, [id]: false }));
    }
  };

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

  const handleSaveConfig = (id: string) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(configs));
    setSavedStatus(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setSavedStatus(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const handleSaveFontSize = (newSize: string) => {
    setFontSize(newSize);
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, newSize);
    // 触发一个自定义的 storage 事件或通知，使得主界面在未关闭设置框时也能实时响应变更
    window.dispatchEvent(new Event("storage_font_size_changed"));
    setFontSizeSaved(true);
    setTimeout(() => setFontSizeSaved(false), 1500);
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
  };

  const toggleCollapse = (id: string) => {
    setCollapsedModels(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#1c1c1d] select-text">
      {/* 100vw 100vh 全屏容器 */}
      <div className="w-full h-full flex overflow-hidden">
        
        {/* 左栏选项导航 */}
        <div className="w-[240px] bg-[#141415] border-r border-[#2d2d2e] p-6 flex flex-col justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 px-2 py-2 mb-8">
              <SettingsIcon size={18} className="text-amber-400 shrink-0" />
              <span className="text-sm font-bold text-white tracking-wider uppercase">应用设置</span>
            </div>
            
            <div className="space-y-2">
              {/* 模型 API 设置按钮 */}
              <button 
                onClick={() => setActiveTab("api")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
                  activeTab === "api" 
                    ? "bg-[#2b2b2c] text-amber-400 font-bold border border-amber-500/20 shadow-sm shadow-amber-500/5"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Cpu size={15} className="shrink-0" />
                <span>模型 API 设置</span>
              </button>

              {/* 对话格式设置按钮 */}
              <button 
                onClick={() => setActiveTab("format")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-xs text-left transition-all cursor-pointer ${
                  activeTab === "format" 
                    ? "bg-[#2b2b2c] text-amber-400 font-bold border border-amber-500/20 shadow-sm shadow-amber-500/5"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Type size={15} className="shrink-0" />
                <span>对话格式设置</span>
              </button>
            </div>
          </div>
          
          <div className="text-[10px] text-gray-500 font-mono px-4">
            Tangerine Config v1.0
          </div>
        </div>

        {/* 右侧主配置面板 */}
        <div className="flex-1 flex flex-col h-full bg-[#1e1e1f] overflow-hidden">
          
          {/* 顶栏标题区与关闭按钮 */}
          <div className="p-6 border-b border-white/5 shrink-0 flex items-center justify-between bg-[#19191a]">
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide">
                {activeTab === "api" ? "模型 API 提供商配置" : "对话格式配置"}
              </h1>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {activeTab === "api" 
                  ? "管理和修改您的大语言模型 API 路由和环境变量密钥。" 
                  : "定制主界面聊天窗口中对话文本的排版与呈现细节。"
                }
              </p>
            </div>
            
            {/* 关闭按钮容器 */}
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-[10px] text-gray-500 font-mono select-none bg-white/5 px-2.5 py-1.5 rounded">按ESC键关闭</span>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all border border-white/10 text-gray-300 hover:text-white cursor-pointer"
                title="返回聊天"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* 配置块可滚动区域 */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">
            {activeTab === "api" ? (
              <>
                {configs.map((config) => (
                  <div 
                    key={config.id} 
                    className="p-6 rounded-xl border border-white/5 bg-[#141415] shadow-lg hover:border-white/10 transition-all"
                  >
                    {/* 块标题与控制条 */}
                    <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/5">
                      <span className="text-xs font-bold text-amber-400 tracking-wider uppercase font-mono">
                        {config.providerName || "未命名提供商"}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        {/* 保存按钮 */}
                        <button
                          onClick={() => handleSaveConfig(config.id)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                            savedStatus[config.id]
                              ? "bg-green-500/20 border-green-500/30 text-green-400"
                              : "bg-[#253746] border-[#2d4558] text-[#4ea1db] hover:bg-[#2d4355]"
                          }`}
                        >
                          {savedStatus[config.id] ? <Check size={12} /> : <Save size={12} />}
                          <span>{savedStatus[config.id] ? "已保存" : "保存本配置"}</span>
                        </button>

                        {/* 删除按钮 */}
                        {configs.length > 1 && (
                          <button
                            onClick={() => handleRemoveConfigBlock(config.id)}
                            className="p-2 text-gray-400 hover:text-red-400 rounded-md hover:bg-white/5 transition-all cursor-pointer"
                            title="删除此 API 信息块"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 表单输入 */}
                    <div className="space-y-4">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <label className="col-span-3 text-xs text-gray-200 font-semibold">提供商名称</label>
                        <input
                          type="text"
                          value={config.providerName}
                          onChange={(e) => updateConfigField(config.id, "providerName", e.target.value)}
                          className="col-span-9 bg-[#1d1d1e] border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-white font-medium placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-center">
                        <label className="col-span-3 text-xs text-gray-200 font-semibold">Base URL</label>
                        <input
                          type="text"
                          value={config.baseUrl}
                          onChange={(e) => updateConfigField(config.id, "baseUrl", e.target.value)}
                          className="col-span-9 bg-[#1d1d1e] border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-center">
                        <label className="col-span-3 text-xs text-gray-200 font-semibold">环境变量名称</label>
                        <input
                          type="text"
                          value={config.envKeyName}
                          onChange={(e) => updateConfigField(config.id, "envKeyName", e.target.value)}
                          className="col-span-9 bg-[#1d1d1e] border border-white/5 rounded-md px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-colors"
                        />
                      </div>

                      {/* 折叠模型列表区域 */}
                      <div className="border border-white/5 rounded-lg bg-[#19191a] overflow-hidden mt-4">
                        <button
                          onClick={() => toggleCollapse(config.id)}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs text-gray-200 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold">可调用模型列表 ({config.models.length})</span>
                          {collapsedModels[config.id] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>

                        {!collapsedModels[config.id] && (
                          <div className="p-4 border-t border-white/5 space-y-3 bg-[#111112]">
                            {config.models.map((model, idx) => (
                              <div key={idx} className="flex items-center gap-2.5">
                                <input
                                  type="text"
                                  value={model}
                                  onChange={(e) => handleModelChange(config.id, idx, e.target.value)}
                                  className="flex-1 bg-[#1d1d1e] border border-white/5 rounded-md px-3 py-2 text-xs text-white font-mono placeholder-gray-500 outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30"
                                />
                                <button
                                  onClick={() => handleRemoveModel(config.id, idx)}
                                  className="text-gray-400 hover:text-red-400 p-2 rounded-md hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                                  title="移除此模型"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddModel(config.id)}
                              className="flex items-center gap-1.5 text-xs text-[#4ea1db] hover:text-blue-300 font-bold mt-2 transition-colors cursor-pointer"
                            >
                              <Plus size={13} />
                              <span>增加模型</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* 新增 API 信息块的按钮 */}
                <button
                  onClick={handleAddConfigBlock}
                  className="w-full py-5 border border-dashed border-white/10 hover:border-[#4ea1db]/50 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 text-xs text-gray-400 hover:text-[#4ea1db] transition-all cursor-pointer group"
                >
                  <Plus size={14} className="group-hover:rotate-90 transition-transform duration-200" />
                  <span className="font-semibold">添加一个新 API 提供商配置块</span>
                </button>
              </>
            ) : (
              /* 对话格式设置细节面板 */
              <div className="p-6 rounded-xl border border-white/5 bg-[#141415] shadow-lg max-w-2xl">
                <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/5">
                  <span className="text-xs font-bold text-amber-400 tracking-wider uppercase font-mono">
                    排版与外观
                  </span>
                  {fontSizeSaved && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <Check size={12} /> 字号已应用
                    </span>
                  )}
                </div>

                <div className="space-y-6">
                  {/* 字号调整单项 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-gray-200 font-semibold">调整字号</label>
                      <span className="text-[10px] text-gray-400 font-mono bg-[#1d1d1e] px-2 py-0.5 rounded border border-white/5">
                        当前大小: {fontSize}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      仅缩放对话消息框内部的消息文字及 AI 回复内容。不影响按钮、输入框、侧边栏等应用框架元素。
                    </p>
                    
                    <div className="relative mt-2 max-w-xs">
                      <select
                        value={fontSize}
                        onChange={(e) => handleSaveFontSize(e.target.value)}
                        className="w-full bg-[#1d1d1e] border border-white/10 rounded-md px-3.5 py-2.5 text-xs text-white font-medium outline-none focus:border-[#4ea1db] focus:ring-1 focus:ring-[#4ea1db]/30 transition-all cursor-pointer appearance-none"
                      >
                        {PRESET_FONT_SIZES.map((size) => (
                          <option key={size.value} value={size.value} className="bg-[#1c1c1d] py-2 text-xs">
                            {size.label}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400">
                        <ChevronDown size={14} />
                      </div>
                    </div>
                  </div>

                  {/* 对话框实时效果预览区 */}
                  <div className="border border-white/5 rounded-lg bg-[#19191a] p-4 mt-4">
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-2.5">效果预览 (以选定字号渲染)：</span>
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <div 
                          style={{ fontSize: fontSize }} 
                          className="max-w-[85%] p-3 rounded-lg bg-[#2b6cb0] text-white rounded-tr-none leading-relaxed"
                        >
                          什么是热狗🌭？
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div 
                          style={{ fontSize: fontSize }} 
                          className="max-w-[85%] p-3 rounded-lg bg-[#2e2e2e] text-gray-200 border border-[#3a3a3a] rounded-tl-none leading-relaxed"
                        >
                         热狗是非常热的狗🐕。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
