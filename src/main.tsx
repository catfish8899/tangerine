import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // 确保这一行存在且路径正确！
// 引入代码高亮所需的 atom-one-dark 暗黑主题样式
import "highlight.js/styles/atom-one-dark.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
