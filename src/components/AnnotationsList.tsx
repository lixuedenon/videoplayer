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
  type: 'annotation';
  videoName: string;
  videoUrl?: string;
  timestamp?: number;
  content: string;
  highlight?: string;
  annotation: Annotation;
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
  isActive?: boolean;
  onFocus?: () => void;
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
  onSelectResult,
  isActive = true,
  onFocus
}) => {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadAbortControllers] = useState<Map<string, () => void>>(new Map());
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [isExactMatch, setIsExactMatch] = useState(false);

  const videoAnnotations = annotations.filter(a => a.video_url === currentVideoUrl);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 手动触发搜索
  const performSearch = async () => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearchMode(false);
      return;
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // 只搜索标注(跨视频)
    const annotationsResults = await searchAnnotations(query);
    annotationsResults.forEach(annotation => {
      const nameLower = (annotation.name || '').toLowerCase();
      const textContentLower = (annotation.text_content || '').toLowerCase();
      const matches = isExactMatch
        ? nameLower === lowerQuery || textContentLower === lowerQuery
        : nameLower.includes(lowerQuery) || textContentLower.includes(lowerQuery);

      if (matches) {
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
          results.push({
            type: 'annotation',
            videoName: video.name,
            videoUrl: annotation.video_url,
            timestamp: annotation.timestamp,
            content: annotation.name || `涂鸦标注 @ ${formatTime(annotation.timestamp)}`,
            highlight: query,
            annotation: annotation
          });
        }
      }
    });

    setSearchResults(results);
    setIsSearchMode(true);
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

  // 点击搜索结果,跳转到对应视频和时间点
  const handleResultClick = (result: SearchResult) => {
    if (result.annotation.video_url === currentVideoUrl) {
      onSeek(result.annotation.timestamp);
    } else {
      onSeek(result.annotation.timestamp, result.annotation.video_url);
    }
  };

  // 清空搜索
  const handleClearSearch = () => {
    setQuery('');
    setSearchResults([]);
    setIsSearchMode(false);
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
    console.log('handleDownloadVideo called for annotation:', annotation.id);
    if (!videoElement) {
      alert('视频播放器不可用');
      return;
    }

    if (downloadingIds.has(annotation.id)) {
      console.log('Already downloading, returning');
      return;
    }

    let aborted = false;
    const abortDownload = () => {
      aborted = true;
      downloadAbortControllers.delete(annotation.id);
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    };

    downloadAbortControllers.set(annotation.id, abortDownload);
    setDownloadingIds(prev => {
      const newSet = new Set(prev).add(annotation.id);
      console.log('Download started, downloadingIds:', Array.from(newSet));
      return newSet;
    });

    const startTime = Math.max(0, annotation.timestamp - videoSegmentSettings.beforeBuffer);
    const endTime = Math.min(videoElement.duration, annotation.timestamp + videoSegmentSettings.afterBuffer);

    const videoName = currentVideoUrl.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'video';
    const filename = `${videoName}_${formatTime(annotation.timestamp)}`;

    try {
      // 创建一个可以检查中止状态的Promise包装
      await new Promise<void>(async (resolve, reject) => {
        if (aborted) {
          reject(new Error('Download aborted'));
          return;
        }

        try {
          await downloadVideoSegment(videoElement, startTime, endTime, filename);
          if (!aborted) {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    } catch (error: any) {
      if (!aborted) {
        console.error('Failed to download video segment:', error);
      }
    } finally {
      downloadAbortControllers.delete(annotation.id);
      setDownloadingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(annotation.id);
        return newSet;
      });
    }
  };

  const handleCancelDownload = (annotationId: string) => {
    const abortFn = downloadAbortControllers.get(annotationId);
    if (abortFn) {
      abortFn();
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Clock size={18} />
        涂鸦列表 ({annotations.length})
      </h3>

      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  performSearch();
                }
              }}
              placeholder="搜索视频、片段、标注..."
              className="w-full bg-gray-700 text-white pl-10 pr-3 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>
          <button
            onClick={performSearch}
            disabled={!query.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            搜索
          </button>
          {isSearchMode && (
            <button
              onClick={handleClearSearch}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium transition"
            >
              清空
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-2 bg-gray-700 rounded-lg">
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
      </div>

      {isSearchMode && searchResults.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          <p>未找到匹配结果</p>
          <p className="text-sm mt-2">尝试使用模糊匹配或更换搜索词</p>
        </div>
      ) : isSearchMode && searchResults.length > 0 ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {searchResults.map((result, index) => result.annotation && (
            <div
              key={index}
              className="bg-gray-700 rounded-lg overflow-hidden hover:bg-gray-600 transition group"
            >
              <button
                onClick={() => handleResultClick(result)}
                className="w-full text-left"
              >
                {result.annotation.thumbnail && (
                  <ThumbnailImage
                    thumbnail={result.annotation.thumbnail}
                    alt={`涂鸦 @ ${formatTime(result.annotation.timestamp)}`}
                  />
                )}
                <div className="p-3">
                  {result.annotation.name && (
                    <div className="text-white font-medium text-sm mb-1 truncate" title={result.annotation.name}>
                      {highlightText(result.annotation.name, result.highlight || '')}
                    </div>
                  )}
                  <div className="text-gray-300 text-xs mb-1">
                    {highlightText(result.videoName, result.highlight || '')}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">
                      {formatTime(result.annotation.timestamp)}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {new Date(result.annotation.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(result.annotation!);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition"
                  title="下载截图"
                >
                  <Download size={14} />
                  图片
                </button>
                {(() => {
                  const isDownloading = downloadingIds.has(result.annotation.id);
                  console.log('Rendering button for annotation:', result.annotation.id, 'isDownloading:', isDownloading);
                  return isDownloading ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelDownload(result.annotation.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition"
                      title="停止下载"
                    >
                      <X size={14} />
                      停止
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadVideo(result.annotation);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded transition"
                      title={`下载视频片段 (前${videoSegmentSettings.beforeBuffer}秒 - 后${videoSegmentSettings.afterBuffer}秒)`}
                    >
                      <Video size={14} />
                      视频
                    </button>
                  );
                })()}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(result.annotation!.id);
                  }}
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
      ) : !isSearchMode && videoAnnotations.length === 0 ? (
        <div className="text-gray-400 text-center py-8">
          <p>暂无涂鸦</p>
          <p className="text-sm mt-2">暂停视频后点击"涂鸦"按钮开始标注</p>
        </div>
      ) : !isSearchMode ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {videoAnnotations.map(annotation => (
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
                    {annotation.is_live && (
                      <span className="ml-2 px-2 py-0.5 bg-orange-600 text-white text-xs rounded">
                        实时涂鸦
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 text-sm">
                    {formatTime(annotation.timestamp)}
                    {annotation.is_live && annotation.live_drawing_data && (
                      <span className="ml-1 text-gray-400 text-xs">
                        ({annotation.live_drawing_data.duration.toFixed(1)}秒)
                      </span>
                    )}
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
              {(() => {
                const isDownloading = downloadingIds.has(annotation.id);
                console.log('Rendering button for annotation:', annotation.id, 'isDownloading:', isDownloading);
                return isDownloading ? (
                  <button
                    onClick={() => handleCancelDownload(annotation.id)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition"
                    title="停止下载"
                  >
                    <X size={14} />
                    停止
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownloadVideo(annotation)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded transition"
                    title={`下载视频片段 (前${videoSegmentSettings.beforeBuffer}秒 - 后${videoSegmentSettings.afterBuffer}秒)`}
                  >
                    <Video size={14} />
                    视频
                  </button>
                );
              })()}
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
      ) : null}
    </div>
  );
};
