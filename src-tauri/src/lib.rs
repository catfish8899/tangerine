use std::fs;
use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

struct PyProcess(Mutex<Option<std::process::Child>>);

/// 根据文件扩展名推断图片 MIME 类型
fn get_image_mime_type(path: &str) -> &'static str {
    let lower = path.to_lowercase();
    if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else {
        "application/octet-stream"
    }
}

/// Rust 直接读取本地图片，并返回 data URL
/// 这样前端可直接赋给 <img src="...">，绕过前端 fs/scope 访问问题
#[tauri::command]
fn read_image_as_data_url(path: String) -> Result<String, String> {
    println!("收到图片读取请求: {}", path);

    let bytes = fs::read(&path).map_err(|e| format!("读取图片文件失败: {}", e))?;
    let mime = get_image_mime_type(&path);
    let base64_data = {
        use base64::Engine;
        use base64::engine::general_purpose::STANDARD;
        STANDARD.encode(bytes)
    };

    let data_url = format!("data:{};base64,{}", mime, base64_data);
    println!("图片 data URL 生成成功: {}", path);

    Ok(data_url)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 注册 Shell 插件
        .plugin(tauri_plugin_shell::init())
        // 注册 Dialog 插件：用于前端调用原生文件选择器，解决 tkinter 文件框发虚问题
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // 注册自定义命令
        .invoke_handler(tauri::generate_handler![read_image_as_data_url])
        .setup(|app| {
            // 自动在后台启动我们的 Python Sidecar
            println!("正在启动 Python Sidecar 服务...");
            
            // 1. 获取当前基础运行路径
            let mut current_dir = std::env::current_dir().unwrap();
            
            // 2. 智能判断：如果当前路径不以 "src-tauri" 结尾，则向里递进一级
            if !current_dir.ends_with("src-tauri") {
                current_dir = current_dir.join("src-tauri");
            }
            
            println!("Sidecar 确定的工作目录: {:?}", current_dir);
            
            // 3. 启动 Python
            let child = Command::new("python")
                .arg("py_sidecar/main.py")
                .current_dir(current_dir)
                .spawn();

            match child {
                Ok(child_proc) => {
                    println!("Python Sidecar 启动成功 (PID: {})", child_proc.id());
                    // 将子进程句柄保存在 Tauri 的全局 State 中
                    app.manage(PyProcess(Mutex::new(Some(child_proc))));
                }
                Err(e) => {
                    eprintln!(
                        "无法自动拉起 Python Sidecar: {}. 请确保你已经在系统全局或虚拟环境中安装了 python 并配置了 PATH！",
                        e
                    );
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}