// src/utils/fileStorageService.ts
import { appLocalDataDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { 
  readTextFile, 
  writeTextFile, 
  exists, 
  mkdir, 
  copyFile, 
  remove 
} from "@tauri-apps/plugin-fs";

const DIRS = {
  SESSIONS: "sessions",
  CANVAS: "canvas",
  ATTACHMENTS: "attachments",
  ROLES: "roles",
  SETTINGS: "settings"
};

export const FILES = {
  SESSION_LIST: "session_list.json",
  ROLES_CONFIG: "roles_config.json",
  SETTINGS_CONFIG: "settings_config.json",
  CLIPBOARD: "clipboard.json"
};

let baseDirCache: string | null = null;

async function getBaseDir(): Promise<string> {
  if (!baseDirCache) {
    baseDirCache = await appLocalDataDir();
  }
  return baseDirCache;
}

async function getDirPath(dirName: string): Promise<string> {
  const base = await getBaseDir();
  return await join(base, dirName); 
}

async function getFilePath(dirName: string, fileName: string): Promise<string> {
  const dir = await getDirPath(dirName);
  return await join(dir, fileName); 
}

export async function initStorageDirectories(): Promise<void> {
  const base = await getBaseDir();
  const dirsToCreate = await Promise.all(Object.values(DIRS).map(d => join(base, d)));
  
  for (const dir of dirsToCreate) {
    const dirExists = await exists(dir);
    if (!dirExists) {
      await mkdir(dir, { recursive: true });
      console.log(`[Storage] 创建目录: ${dir}`);
    }
  }
}

export async function readJsonFile<T>(dirName: string, fileName: string): Promise<T | null> {
  try {
    const filePath = await getFilePath(dirName, fileName);
    const fileExists = await exists(filePath);
    if (!fileExists) return null;
    const content = await readTextFile(filePath);
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`[Storage] 读取 JSON 失败 (${dirName}/${fileName}):`, error);
    return null;
  }
}

export async function writeJsonFile(dirName: string, fileName: string, data: any): Promise<void> {
  try {
    const filePath = await getFilePath(dirName, fileName);
    const content = JSON.stringify(data, null, 2);
    await writeTextFile(filePath, content);
  } catch (error) {
    console.error(`[Storage] 写入 JSON 失败 (${dirName}/${fileName}):`, error);
  }
}

const debounceTimers = new Map<string, number>();

export function debouncedWriteJsonFile(dirName: string, fileName: string, data: any, delay: number = 300): void {
  const debounceKey = `${dirName}/${fileName}`;
  const existingTimer = debounceTimers.get(debounceKey);
  if (existingTimer) window.clearTimeout(existingTimer);

  const timer = window.setTimeout(async () => {
    await writeJsonFile(dirName, fileName, data);
    debounceTimers.delete(debounceKey);
  }, delay);
  debounceTimers.set(debounceKey, timer);
}

export async function flushDebouncedWrite(dirName: string, fileName: string, data: any): Promise<void> {
  const debounceKey = `${dirName}/${fileName}`;
  const existingTimer = debounceTimers.get(debounceKey);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
    debounceTimers.delete(debounceKey);
  }
  await writeJsonFile(dirName, fileName, data);
}

export function cancelDebouncedWrite(dirName: string, fileName: string): void {
  const debounceKey = `${dirName}/${fileName}`;
  const existingTimer = debounceTimers.get(debounceKey);
  if (existingTimer) {
    window.clearTimeout(existingTimer);
    debounceTimers.delete(debounceKey);
  }
}

export async function copyAttachmentToLocal(sourcePath: string, sessionId: string): Promise<string> {
  const fileName = sourcePath.split(/[\\/]/).pop() || "unknown_file";
  const timestamp = Date.now();
  const safeFileName = `${timestamp}_${fileName}`;
  
  const targetDir = await getFilePath(DIRS.ATTACHMENTS, sessionId);
  const targetDirExists = await exists(targetDir);
  if (!targetDirExists) await mkdir(targetDir, { recursive: true });

  const targetAbsolutePath = await join(targetDir, safeFileName); 
  await copyFile(sourcePath, targetAbsolutePath);

  return `${DIRS.ATTACHMENTS}/${sessionId}/${safeFileName}`;
}

/**
 * 调用 Rust 命令读取本地文件并生成 Base64 Data URL (用于前端 <img> 渲染)
 */
export async function getLocalPreviewUrl(relativePath: string): Promise<string> {
  const base = await getBaseDir();
  const absolutePath = await join(base, relativePath); 
  try {
    const previewUrl = await invoke<string>("read_image_as_data_url", { path: absolutePath });
    return previewUrl;
  } catch (error) {
    console.error(`[Storage] 生成 Base64 预览失败 (${relativePath}):`, error);
    return "";
  }
}

export async function getAbsolutePath(relativePath: string): Promise<string> {
  const base = await getBaseDir();
  return await join(base, relativePath);
}

export async function deleteLocalFile(relativePath: string): Promise<void> {
  try {
    const base = await getBaseDir();
    const absolutePath = await join(base, relativePath); 
    const fileExists = await exists(absolutePath);
    if (fileExists) await remove(absolutePath);
  } catch (error) {
    console.error(`[Storage] 删除文件失败 (${relativePath}):`, error);
  }
}

export const STORAGE_DIRS = DIRS;