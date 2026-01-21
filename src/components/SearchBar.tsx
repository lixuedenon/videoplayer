// src/components/SearchBar.tsx
// TypeScript React组件 - 搜索栏组件,支持跨视频搜索标注、片段和视频名称
import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { searchVideoSegments } from '../utils/search';
import { searchAnnotations } from '../utils/database';
import { VideoFile } from '../types/video';

interface SearchResult {
  type: 'video' | 'segment' | 'annotation';
  videoName: string;
  videoUrl?: string;
  timestamp?: number;
  content: string;
  highlight?: string;
}

interface SearchBarProps {
  videos: VideoFile[];
  onSelectResult: (videoName: string, timestamp?: number) => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ videos, onSelectResult }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      const searchResults: SearchResult[] = [];

      // 搜索视频名称
      videos.forEach(video => {
        if (video.name.toLowerCase().includes(query.toLowerCase())) {
          searchResults.push({
            type: 'video',
            videoName: video.name,
            videoUrl: video.url || video.path,
            content: video.name,
            highlight: query
          });
        }
      });

      // 搜索视频片段
      const segments = await searchVideoSegments(query);
      segments.forEach(segment => {
        searchResults.push({
          type: 'segment',
          videoName: segment.video_name,
          videoUrl: segment.video_url,
          timestamp: segment.key_frame_time,
          content: segment.text_content || '',
          highlight: query
        });
      });

      // 搜索标注(增强匹配逻辑)
      const annotations = await searchAnnotations(query);
      annotations.forEach(annotation => {
        // 增强视频匹配逻辑:支持多种标识符格式(URL/name/path/文件名)
        const video = videos.find(v => {
          // 精确匹配 URL
          if (v.url && v.url === annotation.video_url) {
            return true;
          }
          
          // 精确匹配 name
          if (v.name === annotation.video_url) {
            return true;
          }
          
          // 精确匹配 path
          if (v.path === annotation.video_url) {
            return true;
          }
          
          // 提取文件名进行模糊匹配(处理路径差异)
          const getFileName = (str: string) => {
            return str.split('/').pop()?.split('\\').pop() || str;
          };
          
          const annotationFileName = getFileName(annotation.video_url);
          if (v.name === annotationFileName || v.path === annotationFileName) {
            return true;
          }
          
          return false;
        });

        if (video) {
          searchResults.push({
            type: 'annotation',
            videoName: video.name,
            videoUrl: annotation.video_url,
            timestamp: annotation.timestamp,
            content: `涂鸦标注 @ ${formatTime(annotation.timestamp)}`,
            highlight: query
          });
        }
      });

      setResults(searchResults);
      setIsOpen(searchResults.length > 0);
      setSelectedIndex(0);
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, videos]);

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

  const handleSelectResult = (result: SearchResult) => {
    onSelectResult(result.videoName, result.timestamp);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'video':
        return '🎥';
      case 'segment':
        return '✂️';
      case 'annotation':
        return '✏️';
      default:
        return '📄';
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="搜索视频、片段、标注..."
          className="w-full bg-gray-800 text-white pl-10 pr-10 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-h-96 overflow-y-auto z-50">
          {results.map((result, index) => (
            <button
              key={index}
              onClick={() => handleSelectResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full text-left px-4 py-3 border-b border-gray-700 last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-gray-700' : 'hover:bg-gray-750'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getResultIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {highlightText(result.videoName, result.highlight || '')}
                  </div>
                  {result.content && result.type !== 'video' && (
                    <div className="text-gray-400 text-sm mt-1 truncate">
                      {highlightText(result.content, result.highlight || '')}
                    </div>
                  )}
                  {result.timestamp !== undefined && (
                    <div className="text-gray-500 text-xs mt-1">
                      时间: {formatTime(result.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
