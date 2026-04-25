import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

if (import.meta.env.DEV) {
  const _fetch = window.fetch;
  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    const method = ((args[1]?.method) || 'GET').toUpperCase();
    console.group(`%c[Fetch] ${method} ${url}`, 'color:#7dd3fc;font-weight:bold');
    if (args[1]?.body) {
      try { console.log('Body:', JSON.parse(args[1].body as string)); } catch { console.log('Body:', args[1].body); }
    }
    try {
      const res = await _fetch(...args);
      const clone = res.clone();
      clone.json().then(d => console.log(`%cResponse (${res.status}):`, 'color:#86efac', d)).catch(() => {});
      if (!res.ok) console.warn(`%cFailed: ${res.status} ${res.statusText}`, 'color:#fca5a5');
      console.groupEnd();
      return res;
    } catch (err) {
      console.error('Network error:', err);
      console.groupEnd();
      throw err;
    }
  };
}
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './Landing.tsx';
import App from './App.tsx';
import Auth from './Auth.tsx';
import Docs from './Docs.tsx';
import DevPortal from './DevPortal.tsx';
import Blog from './Blog.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<App />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/developers" element={<DevPortal />} />
        <Route path="/blog/:id" element={<Blog />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
