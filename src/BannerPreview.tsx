import { ArrowLeft, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BannerPreview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-8 font-sans">
      <div className="max-w-6xl w-full">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-black transition-colors mb-12 uppercase tracking-widest text-xs font-bold"
        >
          <ArrowLeft size={16} /> Back to Hub
        </button>

        <div className="mb-12">
          <h1 className="text-4xl font-extrabold tracking-tighter text-black mb-4">Sharing Assets</h1>
          <p className="text-gray-500 max-w-2xl">
            This is the official social media and chat thumbnail for Cipher Intelligence. 
            It is optimized for high-performance preview rendering across modern platforms.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 mb-12">
          <div className="aspect-[1200/630] w-full relative">
            <img 
              src="/social-banner.svg" 
              alt="Cipher Intelligence Social Banner" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Asset Details</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-500">Format</span>
                <span className="font-mono font-bold">SVG (Vector)</span>
              </li>
              <li className="flex justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-500">Aspect Ratio</span>
                <span className="font-mono font-bold">1.91:1 (1200x630)</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-500">Theme</span>
                <span className="font-mono font-bold">Premium Minimal</span>
              </li>
            </ul>
          </div>

          <div className="bg-black text-white p-8 rounded-3xl flex flex-col justify-center items-start">
             <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Export Protocol</h3>
             <p className="text-sm text-gray-400 mb-6">
               For platforms that do not support SVG thumbnails (Discord/WhatsApp), 
               capture a high-resolution screenshot or export as PNG.
             </p>
             <a 
               href="/social-banner.svg" 
               download="cipher-social-banner.svg"
               className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors"
             >
               <Download size={18} /> Download SVG
             </a>
          </div>
        </div>
      </div>
    </div>
  );
}
