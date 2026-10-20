import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import './styles/motion.css';
import './styles/changelog.css';
import './styles/method-picker.css';
import './styles/layout-v23.css';
import './styles/sticker.css';
import './styles/stickers.css';
import './styles/layers.css'; // 最后加载，统一覆盖各组件自带的 z-index

createRoot(document.getElementById('root')).render(<App />);
