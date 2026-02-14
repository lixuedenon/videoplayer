// 嵌入式视频播放器组件 - 用于播放YouTube、Vimeo、Bilibili等外部平台视频

import React, { useEffect, useRef } from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { ParsedVideoUrl, getPlatformLimitations } from '../utils/videoUrlParser';

interface EmbeddedVideoPlayerProps {
  parsedUrl: ParsedVideoUrl;
  onError?: (error: string) => void;
}

export const EmbeddedVideoPlayer: React.FC<EmbeddedVideoPlayerProps> = ({
  parsedUrl,
  onError
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!parsedUrl.embedUrl) {
      onError?.('无法生成嵌入URL');
    }
  }, [parsedUrl, onError]);

  if (!parsedUrl.embedUrl) {
    return (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <div className="text-center px-8">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-white text-xl mb-2">无法嵌入此视频</h3>
          <p className="text-gray-400 mb-4">
            该视频平台不支持嵌入播放，或URL格式不正确
          </p>
          <a
            href={parsedUrl.originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            <ExternalLink size={18} />
            在新窗口打开
          </a>
        </div>
      </div>
    );
  }

  const limitations = getPlatformLimitations(parsedUrl.type);

  return (
    <div className="w-full h-full bg-black relative">
      {/* 功能限制提示 */}
      <div className="absolute top-4 left-4 z-50 bg-black/80 backdrop-blur-sm rounded-lg p-3 max-w-xs">
        <div className="flex items-start gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-white font-semibold text-sm mb-1">
              {parsedUrl.platform || '外部视频'}
            </h4>
            <ul className="text-xs text-gray-300 space-y-0.5">
              {limitations.map((limitation, index) => (
                <li key={index}>{limitation}</li>
              ))}
            </ul>
          </div>
        </div>
        <a
          href={parsedUrl.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition mt-2"
        >
          <ExternalLink size={14} />
          在原站打开
        </a>
      </div>

      {/* iframe嵌入播放器 */}
      <iframe
        ref={iframeRef}
        src={parsedUrl.embedUrl}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title={`${parsedUrl.platform} Video Player`}
        style={{
          border: 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />

      {/* 加载指示器 */}
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none animate-pulse">
        <div className="text-white text-lg">加载中...</div>
      </div>
    </div>
  );
};
