use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

struct PyProcess(Mutex<Option<std::process::Child>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
                    eprintln!("无法自动拉起 Python Sidecar: {}. 请确保你已经在系统全局或虚拟环境中安装了 python 并配置了 PATH！", e);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
