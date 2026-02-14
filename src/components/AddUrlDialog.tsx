import React, { useState } from 'react';
import { X, Link, Info } from 'lucide-react';
import { getSupportedPlatforms } from '../utils/videoUrlParser';

interface AddUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddUrl: (url: string, name: string) => void;
}

export const AddUrlDialog: React.FC<AddUrlDialogProps> = ({
  isOpen,
  onClose,
  onAddUrl
}) => {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [showPlatformInfo, setShowPlatformInfo] = useState(false);

  if (!isOpen) return null;

  const supportedPlatforms = getSupportedPlatforms();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAddUrl(url.trim(), name.trim() || 'Video from URL');
      setUrl('');
      setName('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold flex items-center gap-2">
            <Link size={20} />
            Add Video URL
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm mb-2">
              Video URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or https://example.com/video.mp4"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              required
            />
            <p className="text-gray-400 text-xs mt-1">
              支持直接视频文件 (.mp4, .webm) 和外部平台 (YouTube, Vimeo, Bilibili, Dailymotion)
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 text-sm mb-2">
              Video Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Video"
              className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* 支持平台信息 */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowPlatformInfo(!showPlatformInfo)}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm transition"
            >
              <Info size={16} />
              <span>{showPlatformInfo ? '隐藏' : '查看'}支持的平台和示例</span>
            </button>

            {showPlatformInfo && (
              <div className="mt-3 bg-gray-700/50 rounded-lg p-4 space-y-3">
                {supportedPlatforms.map((platform, index) => (
                  <div key={index} className="border-b border-gray-600 last:border-0 pb-3 last:pb-0">
                    <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                      {platform.name}
                      <span className="text-xs text-gray-400">
                        {platform.features.join(' · ')}
                      </span>
                    </h4>
                    <div className="space-y-1">
                      {platform.examples.map((example, idx) => (
                        <p key={idx} className="text-gray-300 text-xs font-mono bg-gray-800 px-2 py-1 rounded">
                          {example}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-600">
                  <p className="text-yellow-400 text-xs flex items-start gap-2">
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>注意：</strong>外部平台视频（YouTube、Bilibili等）功能受限，无法使用涂鸦、截图、录制等功能。直接视频文件支持所有功能。
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Add Video
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
