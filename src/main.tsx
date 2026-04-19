import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './Landing.tsx';
import App from './App.tsx';
import Docs from './Docs.tsx';
import DevPortal from './DevPortal.tsx';
import Blog from './Blog.tsx';
import BannerPreview from './BannerPreview.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<App />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/developers" element={<DevPortal />} />
        <Route path="/blog/:id" element={<Blog />} />
        <Route path="/banner" element={<BannerPreview />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
