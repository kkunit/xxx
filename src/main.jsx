import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // 引入 Tailwind CSS 样式

// 替换为你生成的 SugarMailbox 组件
// 注意：在这里我们不能直接使用 __firebase_config 等全局变量，
// 但对于 Vercel 部署，我们假设 App.jsx 已经处理了所有环境配置。

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
