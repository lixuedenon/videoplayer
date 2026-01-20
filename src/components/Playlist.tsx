import React from 'react';
import { VideoFile } from '../types/video';
import { Play, Pause, Clock, AlertCircle, ArrowRight, Shuffle, Repeat, Trash2, X, Pencil } from 'lucide-react';

type PlayMode = 'normal' | 'sequential' | 'random';

interface PlaylistProps {
  videos: VideoFile[];
  currentIndex: number;
  onSelectVideo: (index: number) => void;
  onDeleteVideo: (index: number) => void;
  onClearPlaylist: () => void;
  onPlayCurrent: () => void;
  playMode: PlayMode;
  onPlayModeChange: (mode: PlayMode) => void;
  isLoopEnabled: boolean;
  onLoopToggle: () => void;
  isPlaying: boolean;
  videoAnnotationCounts?: Map<string, number>;
}

export const Playlist: React.FC<PlaylistProps> = ({
  videos,
  currentIndex,
  onSelectVideo,
  onDeleteVideo,
  onClearPlaylist,
  onPlayCurrent,
  playMode,
  onPlayModeChange,
  isLoopEnabled,
  onLoopToggle,
  isPlaying,
  videoAnnotationCounts
}) => {
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatProgress = (progress: number, duration: number) => {
    if (duration === 0) return 0;
    return Math.min(100, (progress / duration) * 100);
  };

  return (
    <div className="h-full bg-gray-900 border-l border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-lg">Playlist</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onPlayCurrent}
              className="text-gray-400 hover:text-blue-400 transition-colors p-1"
              title="播放当前视频"
            >
              <Play size={18} />
            </button>
            <button
              onClick={() => onPlayModeChange(playMode === 'sequential' ? 'normal' : 'sequential')}
              className={`transition-colors p-1 ${
                playMode === 'sequential' ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'
              }`}
              title="顺序播放"
            >
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => onPlayModeChange(playMode === 'random' ? 'normal' : 'random')}
              className={`transition-colors p-1 ${
                playMode === 'random' ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'
              }`}
              title="随机播放"
            >
              <Shuffle size={18} />
            </button>
            <button
              onClick={onLoopToggle}
              className={`transition-colors p-1 ${
                isLoopEnabled ? 'text-blue-400' : 'text-gray-400 hover:text-blue-400'
              }`}
              title="循环播放列表"
            >
              <Repeat size={18} />
            </button>
            <button
              onClick={onClearPlaylist}
              className="text-gray-400 hover:text-red-400 transition-colors p-1"
              title="清空播放列表"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <p className="text-gray-400 text-sm">
          {videos.length} {videos.length === 1 ? 'video' : 'videos'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
            <p>No videos loaded</p>
            <p className="text-sm mt-2">Select a folder or add a URL to start</p>
          </div>
        ) : (
          <div className="p-2">
            {videos.map((video, index) => (
              <div
                key={`${video.path}-${index}`}
                className={`relative rounded-lg mb-2 transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-800 text-gray-300'
                }`}
              >
                <button
                  onClick={() => onSelectVideo(index)}
                  className="w-full text-left p-3 hover:bg-opacity-80 transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {index === currentIndex ? (
                        <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                          {isPlaying ? (
                            <Pause size={16} fill="white" />
                          ) : (
                            <Play size={16} fill="white" />
                          )}
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pr-8">
                      <div className="flex items-center gap-2">
                        <p
                          className={`font-medium truncate ${
                            index === currentIndex ? 'text-white' : 'text-gray-200'
                          }`}
                        >
                          {video.name}
                        </p>
                        {videoAnnotationCounts && videoAnnotationCounts.get(video.url || video.path) > 0 && (
                          <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded-full text-xs flex-shrink-0" title={`${videoAnnotationCounts.get(video.url || video.path)} 个涂鸦`}>
                            <Pencil size={10} />
                            <span>{videoAnnotationCounts.get(video.url || video.path)}</span>
                          </div>
                        )}
                        {!video.file && !video.url && (
                          <AlertCircle size={14} className="text-yellow-500 flex-shrink-0" title="文件不可用 - 页面已刷新" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1 text-xs">
                          <Clock size={12} />
                          <span>{formatTime(video.duration)}</span>
                        </div>

                        {video.progress > 0 && video.duration > 0 && (
                          <span className="text-xs">
                            {Math.floor(formatProgress(video.progress, video.duration))}% watched
                          </span>
                        )}

                        {!video.file && !video.url && (
                          <span className="text-xs text-yellow-400">
                            Unavailable
                          </span>
                        )}
                      </div>

                      {video.progress > 0 && video.duration > 0 && (
                        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              index === currentIndex ? 'bg-white' : 'bg-blue-500'
                            }`}
                            style={{
                              width: `${formatProgress(video.progress, video.duration)}%`
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteVideo(index);
                  }}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-400 transition-colors p-1"
                  title="从播放列表中移除"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
