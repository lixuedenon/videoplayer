import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Download, Clock, Video, Search, X } from 'lucide-react';
import type { Annotation } from '../types/annotation';
import type { VideoSegmentSettings } from '../types/videoSegment';
import type { VideoFile } from '../types/video';
import { downloadVideoSegment } from '../utils/videoSegmentDownload';
import { getFileURL } from '../utils/localFileStorage';
import { searchVideoSegments } from '../utils/search';
import { searchAnnotations } from '../utils/database';

interface SearchResult {
  type: 'video' | 'segment' | 'annotation';
  videoName: string;
  videoUrl?: string;
  timestamp?: number;
  content: string;
  highlight?: string;
}

interface AnnotationsListProps {
  annotations: Annotation[];
  currentVideoUrl: string;
  onSeek: (timestamp: number, videoUrl?: string) => void;
  onDelete: (id: string) => void;
  videoElement: HTMLVideoElement | null;
  videoSegmentSettings: VideoSegmentSettings;
  videos: VideoFile[];
  onSelectResult: (videoName: string, timestamp?: number) => void;
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

export const AnnotationsList: React.FC<AnnotationsListProps> = ({
  annotations,
  currentVideoUrl,
  onSeek,
  onDelete,
  videoElement,
  videoSegmentSettings,
  videos,
  onSelectResult
}) => {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExactMatch, setIsExactMatch] = useState(false);

  const videoAnnotations = annotations.filter(a => a.video_url === currentVideoUrl);
  const displayAnnotations = videoAnnotations;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearchMode(false);
        return;
      }

      const results: SearchResult[] = [];
      const lowerQuery = query.toLowerCase();

      videos.forEach(video => {
        const videoNameLower = video.name.toLowerCase();
        const matches = isExactMatch
          ? videoNameLower === lowerQuery
          : videoNameLower.includes(lowerQuery);

        if (matches) {
          results.push({
            type: 'video',
            videoName: video.name,
            videoUrl: video.url || video.path,
            content: video.name,
            highlight: query
          });
        }
      });

      const segments = await searchVideoSegments(query);
      segments.forEach(segment => {
        const textContentLower = (segment.text_content || '').toLowerCase();
        const matches = isExactMatch
          ? textContentLower === lowerQuery
          : textContentLower.includes(lowerQuery);

        if (matches) {
          results.push({
            type: 'segment',
            videoName: segment.video_name,
            videoUrl: segment.video_url,
            timestamp: segment.key_frame_time,
            content: segment.text_content || '',
            highlight: query
          });
        }
      });

      const annotationsResults = await searchAnnotations(query);
      annotationsResults.forEach(annotation => {
        const nameLower = (annotation.name || '').toLowerCase();
        const textContentLower = (annotation.text_content || '').toLowerCase();
        const matches = isExactMatch
          ? nameLower === lowerQuery || textContentLower === lowerQuery
          : nameLower.includes(lowerQuery) || textContentLower.includes(lowerQuery);

        if (matches) {
          const video = videos.find(v =>
            (v.url && v.url === annotation.video_url) ||
            v.name === annotation.video_url
          );

          if (video) {
            results.push({
              type: 'annotation',
              videoName: video.name,
              videoUrl: annotation.video_url,
              timestamp: annotation.timestamp,
              content: annotation.name || `涂鸦标注 @ ${formatTime(annotation.timestamp)}`,
              highlight: query
            });
          }
        }
      });

      setSearchResults(results);
      setIsSearchMode(results.length > 0 || query.trim().length > 0);
      setSelectedIndex(0);
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [query, videos, annotations, isExactMatch]);

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

  const handleSelectSearchResult = (result: SearchResult) => {
    onSelectResult(result.videoName, result.timestamp);
    setQuery('');
    setSearchResults([]);
    setIsSearchMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isSearchMode || searchResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % searchResults.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          handleSelectSearchResult(searchResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setQuery('');
        setSearchResults([]);
        setIsSearchMode(false);
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

  const handleAnnotationClick = (annotation: Annotation) => {
    if (annotation.video_url === currentVideoUrl) {
      onSeek(annotation.timestamp);
    } else {
      onSeek(annotation.timestamp, annotation.video_url);
    }
  };

  const handleDownload = (annotation: Annotation) => {
    if (!annotation.thumbnail) return;

    const link = document.createElement('a');
    link.href = annotation.thumbnail;
    link.download = `annotation-${formatTime(annotation.timestamp)}.png`;
    link.click();
  };

  const handleDownloadVideo = async (annotation: Annotation) => {
    if (!videoElement) {
      alert('视频播放器不可用');
      return;
    }

    if (downloadingIds.has(annotation.id)) {
      return;
    }

    setDownloadingIds(prev => new Set(prev).add(annotation.id));

    const startTime = Math.max(0, annotation.timestamp - videoSegmentSettings.beforeBuffer);
    const endTime = Math.min(videoElement.duration, annotation.timestamp + videoSegmentSettings.afterBuffer);

    const videoName = currentVideoUrl.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'video';
    const filename = `${videoName}_${formatTime(annotation.timestamp)}`;

    try {
      await downloadVideoSegment(videoElement, startTime, endTime, filename);
    } catch (error) {
      console.error('Failed to download video segment:', error);
    } finally {
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Clock size={18} />
        涂鸦列表 ({annotations.length})
      </h3>

      <div className="mb-4 relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索视频、片段、标注..."
            className="w-full bg-gray-700 text-white pl-10 pr-10 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setSearchResults([]);
                setIsSearchMode(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {query.trim() && (
          <div className="flex items-center justify-between gap-2 mt-2 p-2 bg-gray-700 rounded-lg">
            <span className="text-gray-400 text-xs">搜索模式:</span>
            <button
              onClick={() => setIsExactMatch(!isExactMatch)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isExactMatch
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
              }`}
            >
              {isExactMatch ? '✓ 精准匹配' : '≈ 模糊匹配'}
            </button>
          </div>
        )}
      </div>

      {isSearchMode && searchResults.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          <p>未找到匹配结果</p>
          <p className="text-sm mt-2">尝试使用模糊匹配或更换搜索词</p>
        </div>
      ) : isSearchMode && searchResults.length > 0 ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition cursor-pointer"
              onClick={() => handleSelectSearchResult(result)}
            >
              <div className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-2xl">{getResultIcon(result.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm mb-1">
                      {highlightText(result.videoName, result.highlight || '')}
                    </div>
                    {result.content && result.type !== 'video' && (
                      <div className="text-gray-300 text-xs mb-1">
                        {highlightText(result.content, result.highlight || '')}
                      </div>
                    )}
                    {result.timestamp !== undefined && (
                      <div className="text-gray-400 text-xs">
                        时间: {formatTime(result.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayAnnotations.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          <p>暂无涂鸦</p>
          <p className="text-sm mt-2">暂停视频后点击"涂鸦"按钮开始标注</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {displayAnnotations.map(annotation => (
          <div
            key={annotation.id}
            className="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition group"
          >
            <button
              onClick={() => handleAnnotationClick(annotation)}
              className="w-full text-left"
            >
              {annotation.thumbnail && (
                <ThumbnailImage
                  thumbnail={annotation.thumbnail}
                  alt={`涂鸦 @ ${formatTime(annotation.timestamp)}`}
                />
              )}
              <div className="p-3">
                {annotation.name && (
                  <div className="text-white font-medium text-sm mb-1 truncate" title={annotation.name}>
                    {annotation.name}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">
                    {formatTime(annotation.timestamp)}
                  </span>
                  <span className="text-gray-400 text-xs">
                    {new Date(annotation.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>
            <div className="px-3 pb-3 flex gap-2">
              <button
                onClick={() => handleDownload(annotation)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition"
                title="下载截图"
              >
                <Download size={14} />
                图片
              </button>
              <button
                onClick={() => handleDownloadVideo(annotation)}
                disabled={downloadingIds.has(annotation.id)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                title={`下载视频片段 (前${videoSegmentSettings.beforeBuffer}秒 - 后${videoSegmentSettings.afterBuffer}秒)`}
              >
                <Video size={14} />
                {downloadingIds.has(annotation.id) ? '下载中' : '视频'}
              </button>
              <button
                onClick={() => onDelete(annotation.id)}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition"
                title="删除涂鸦"
              >
                <Trash2 size={14} />
                删除
              </button>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};
