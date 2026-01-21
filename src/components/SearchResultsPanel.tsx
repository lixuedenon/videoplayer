// src/components/SearchResultsPanel.tsx
// React组件 - 搜索结果面板,显示视频和标注的搜索结果

import React, { useState, useEffect } from 'react';
import { X, Search, Video as VideoIcon, Pencil } from 'lucide-react';
import type { Annotation } from '../types/annotation';
import type { VideoFile } from '../types/video';
import { getFileURL } from '../utils/localFileStorage';

interface SearchResult {
  type: 'video' | 'annotation';
  id: string;
  name: string;
  thumbnail?: string;
  timestamp?: number;
  videoName?: string;
  videoUrl?: string;
  data: VideoFile | Annotation;
}

interface SearchResultsPanelProps {
  results: SearchResult[];
  isVisible: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoFile) => void;
  onSelectAnnotation: (videoUrl: string, timestamp: number) => void;
  searchQuery: string;
}

const ThumbnailImage: React.FC<{ thumbnail: string; alt: string }> = ({ thumbnail, alt }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadImage = async () => {
      if (thumbnail.startsWith('data:') || thumbnail.startsWith('http') || thumbnail.startsWith('blob:')) {
        setImageUrl(thumbnail);
      } else {
        try {
          const url = await getFileURL(thumbnail);
          if (url) {
            objectUrl = url;
            setImageUrl(url);
          } else {
            setImageUrl(thumbnail);
          }
        } catch (error) {
          console.error('Failed to load thumbnail:', error);
          setImageUrl(thumbnail);
        }
      }
    };

    loadImage();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [thumbnail]);

  if (!imageUrl) {
    return <div className="w-full h-48 bg-gray-700 animate-pulse" />;
  }

  return <img src={imageUrl} alt={alt} className="w-full h-48 object-cover" />;
};

export const SearchResultsPanel: React.FC<SearchResultsPanelProps> = ({
  results,
  isVisible,
  onClose,
  onSelectVideo,
  onSelectAnnotation,
  searchQuery
}) => {
  if (!isVisible) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const highlightText = (text: string, highlight: string): React.ReactNode => {
    if (!highlight.trim()) return text;

    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === highlight.toLowerCase() ? (
        <span key={index} className="bg-yellow-400 text-gray-900">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'video') {
      onSelectVideo(result.data as VideoFile);
    } else {
      const annotation = result.data as Annotation;
      onSelectAnnotation(annotation.video_url, annotation.timestamp);
    }
  };

  return (
    <div className="absolute top-0 right-0 w-[30%] h-full bg-gray-900 border-l border-gray-800 z-50 flex flex-col">
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-white" />
          <h3 className="text-white font-semibold">搜索结果</h3>
          <span className="text-gray-400 text-sm">({results.length})</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition p-1"
          title="关闭搜索结果"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {results.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            <p>未找到匹配结果</p>
            <p className="text-sm mt-2">尝试使用不同的搜索词</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}-${index}`}
                className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-700 transition cursor-pointer"
                onClick={() => handleResultClick(result)}
              >
                {result.thumbnail && (
                  <ThumbnailImage
                    thumbnail={result.thumbnail}
                    alt={result.name}
                  />
                )}
                
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {result.type === 'video' ? (
                      <div className="flex items-center gap-1 bg-blue-600 text-white px-2 py-0.5 rounded text-xs">
                        <VideoIcon size={12} />
                        <span>视频</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded text-xs">
                        <Pencil size={12} />
                        <span>标注</span>
                      </div>
                    )}
                  </div>

                  <div className="text-white font-medium text-sm mb-1 truncate" title={result.name}>
                    {highlightText(result.name, searchQuery)}
                  </div>

                  {result.type === 'annotation' && result.videoName && (
                    <div className="text-gray-400 text-xs mb-1">
                      视频: {highlightText(result.videoName, searchQuery)}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-gray-400 text-xs">
                    {result.timestamp !== undefined && (
                      <span>{formatTime(result.timestamp)}</span>
                    )}
                    {result.type === 'annotation' && (result.data as Annotation).created_at && (
                      <span>{new Date((result.data as Annotation).created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
