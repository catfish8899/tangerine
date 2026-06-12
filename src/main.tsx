import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // 确保这一行存在且路径正确！

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
