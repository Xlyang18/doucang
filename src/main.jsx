import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';
import './styles/motion.css';
import './styles/changelog.css';

createRoot(document.getElementById('root')).render(<App />);
