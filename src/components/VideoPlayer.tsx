// src/components/VideoPlayer.tsx
// 视频播放器主组件

import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Maximize,
  Paintbrush,
  BookmarkIcon,
  Circle,
  Square,
  Mic,
  MicOff
} from 'lucide-react';
import { CustomizableButton } from './CustomizableButton';
import { ButtonShape } from '../types/buttonCustomization';
import { ScreenRecorder, RecordingMode } from '../utils/screenRecorder';
import { DrawingCanvas } from './DrawingCanvas';
import { LiveDrawingOverlay } from './LiveDrawingOverlay';
import { LiveDrawingReplay } from './LiveDrawingReplay';
import { AnnotationsList } from './AnnotationsList';
import { Annotation, DrawingData } from '../types/annotation';
import { saveAnnotation, getAnnotations, deleteAnnotation } from '../utils/database';
import { VideoSegmentSettings } from '../types/videoSegment';
import { VideoFile } from '../types/video';
import { extractTextFromDrawingData } from '../utils/videoSegmentDownload';
import { captureScreenshotWithDrawing } from '../utils/screenshot';
import { saveScreenshot, checkFileSystemSupport } from '../utils/localFileStorage';

interface VideoPlayerProps {
  videoUrl: string | null;
  videoId: string | null;
  onEnded: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onLoadedMetadata: (duration: number) => void;
  initialProgress?: number;
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  autoPlay?: boolean;
  onAutoPlayComplete?: () => void;
  onPlayingStateChange?: (isPlaying: boolean) => void;
  onTogglePlay?: () => void;
  onSwitchVideo?: (videoId: string, timestamp: number) => void;
  buttonShape?: ButtonShape;
  buttonDisplayData?: {
    play: { imageUrl: string | null; isMirrored: boolean };
    forward: { imageUrl: string | null; isMirrored: boolean };
    backward: { imageUrl: string | null; isMirrored: boolean };
  };
  onButtonClick?: (buttonName: 'play' | 'forward' | 'backward') => void;
  videos?: VideoFile[];
  onSelectResult?: (videoName: string, timestamp?: number) => void;
  onAnnotationChange?: () => void;
  activePanel?: 'search' | 'annotations' | null;
  onSetActivePanel?: (panel: 'search' | 'annotations' | null) => void;
  isSeekFromAnnotation?: boolean;
  isSearchPanelOpen?: boolean;
  onCloseSearchPanel?: () => void;
  // 录制设置props
  recordingMode: RecordingMode;
  includeMicrophone: boolean;
  // 回放设置props
  replayBufferBefore: number;
  replayBufferAfter: number;
  videoSegmentSettings: VideoSegmentSettings;
}

const VideoPlayerComponent: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoId,
  onEnded,
  onTimeUpdate,
  onLoadedMetadata,
  initialProgress = 0,
  playbackRate = 1,
  onPlaybackRateChange,
  autoPlay = false,
  onAutoPlayComplete,
  onPlayingStateChange,
  onTogglePlay,
  onSwitchVideo,
  buttonShape = 'circle',
  buttonDisplayData = {
    play: { imageUrl: null, isMirrored: false },
    forward: { imageUrl: null, isMirrored: false },
    backward: { imageUrl: null, isMirrored: false }
  },
  onButtonClick,
  videos = [],
  onSelectResult,
  onAnnotationChange,
  activePanel = null,
  onSetActivePanel,
  isSeekFromAnnotation = false,
  isSearchPanelOpen = false,
  onCloseSearchPanel,
  recordingMode,
  includeMicrophone,
  replayBufferBefore,
  replayBufferAfter,
  videoSegmentSettings
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.25);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  const previousVideoUrlRef = useRef<string>('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showDrawingCanvas, setShowDrawingCanvas] = useState(false);
  const [showLiveDrawing, setShowLiveDrawing] = useState(false);
  const [showLivePlayback, setShowLivePlayback] = useState(false);
  const [currentPlaybackData, setCurrentPlaybackData] = useState<{
    liveDrawingData: any;
    startTimestamp: number;
  } | null>(null);
  const playbackStartTimeRef = useRef<number | null>(null);
  const [showAnnotationsList, setShowAnnotationsList] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef<ScreenRecorder>(new ScreenRecorder());
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const seekTargetEndTime = useRef<number | null>(null);

  useEffect(() => {
    if (videoId) {
      loadAnnotations();
    }
  }, [videoId]);

  const loadAnnotations = async () => {
    if (!videoId) return;
    const data = await getAnnotations(videoId);
    setAnnotations(data);
  };

  useEffect(() => {
    if (videoRef.current && videoUrl) {
      const previousUrl = previousVideoUrlRef.current;

      if (previousUrl === videoUrl) {
        return;
      }

      previousVideoUrlRef.current = videoUrl;
      setError(null);

      const video = videoRef.current;

      video.src = videoUrl;
      video.volume = volume;
      video.load();
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      const handleCanPlay = () => {
        if (initialProgress > 0 && isSeekFromAnnotation) {
          video.currentTime = initialProgress;
          const bufferAfter = replayBufferAfter;
          const bufferBefore = replayBufferBefore;
          const originalTimestamp = initialProgress + bufferBefore;
          const endTime = Math.min(duration, originalTimestamp + bufferAfter);
          seekTargetEndTime.current = endTime;
        } else if (initialProgress > 0) {
          video.currentTime = initialProgress;
        }
      };

      const handleError = () => {
        console.error('Video load error:', video.error);
        setError('Failed to load video. The file may no longer be available.');
        setIsPlaying(false);
      };

      video.addEventListener('canplay', handleCanPlay, { once: true });
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('error', handleError);
      };
    }
  }, [videoUrl, initialProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay || !videoUrl) return;

    console.log('AutoPlay effect triggered');

    const attemptAutoPlay = () => {
      console.log('Attempting autoplay, readyState:', video.readyState);
      
      const handlePlaying = () => {
        console.log('Video actually started playing');
        onAutoPlayComplete?.();
        video.removeEventListener('playing', handlePlaying);
      };
      
      video.addEventListener('playing', handlePlaying, { once: true });
      
      video.play()
        .then(() => {
          console.log('Autoplay play() promise resolved');
        })
        .catch((error) => {
          console.error('Autoplay failed:', error);
          video.removeEventListener('playing', handlePlaying);
          onAutoPlayComplete?.();
        });
    };

    if (video.readyState >= 3) {
      console.log('Video already ready, playing immediately');
      attemptAutoPlay();
    } else {
      console.log('Waiting for video to be ready...');
      const handleCanPlayForAutoPlay = () => {
        console.log('Video ready for autoplay');
        attemptAutoPlay();
      };

      video.addEventListener('canplay', handleCanPlayForAutoPlay, { once: true });

      return () => {
        video.removeEventListener('canplay', handleCanPlayForAutoPlay);
      };
    }
  }, [autoPlay, videoUrl, onAutoPlayComplete]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = async () => {
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          await videoRef.current.play();
        }
      } catch (error) {
        console.error('Play/pause error:', error);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration;
      setCurrentTime(current);
      onTimeUpdate(current, total);

      if (showLivePlayback && currentPlaybackData) {
        const playbackEndTime = currentPlaybackData.startTimestamp + currentPlaybackData.liveDrawingData.duration;
        const allowedStartTime = Math.max(0, currentPlaybackData.startTimestamp - replayBufferBefore);
        
        if (current < allowedStartTime - 1 || current > playbackEndTime + 2) {
          setShowLivePlayback(false);
          setCurrentPlaybackData(null);
        }
      }

      if (seekTargetEndTime.current !== null && current >= seekTargetEndTime.current) {
        videoRef.current.pause();
        seekTargetEndTime.current = null;
        if (showLivePlayback) {
          setShowLivePlayback(false);
          setCurrentPlaybackData(null);
        }
        if (isSeekFromAnnotation && onAutoPlayComplete) {
          onAutoPlayComplete();
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const total = videoRef.current.duration;
      setDuration(total);
      onLoadedMetadata(total);
      if (initialProgress > 0 && isSeekFromAnnotation) {
        videoRef.current.currentTime = initialProgress;
        const bufferAfter = replayBufferAfter;
        const bufferBefore = replayBufferBefore;
        const originalTimestamp = initialProgress + bufferBefore;
        const endTime = Math.min(total, originalTimestamp + bufferAfter);
        seekTargetEndTime.current = endTime;
      } else if (initialProgress > 0) {
        videoRef.current.currentTime = initialProgress;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      setIsMuted(vol === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const toggleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveAnnotation = async (drawingData: DrawingData, thumbnail: string, name: string, saveType?: 'annotation' | 'screenshot' | 'video-segment' | 'timestamp') => {
    if (!videoId || !videoRef.current) return;

    const timestamp = videoRef.current.currentTime;
    const videoName = videoId.split('/').pop() || 'video';

    if (saveType === 'screenshot') {
      console.log('Screenshot saved');
      return;
    }

    if (saveType === 'timestamp') {
      console.log('Timestamp saved:', timestamp);
      return;
    }

    if (saveType === 'video-segment') {
      console.log('Video segment save requested at:', timestamp);
      alert(`视频段保存功能需要配置起始和结束时间点\n当前时间：${timestamp.toFixed(2)}秒`);
      return;
    }

    const textContent = extractTextFromDrawingData(drawingData);

    let filePath: string | null = null;
    let finalThumbnail = thumbnail;

    if (await checkFileSystemSupport()) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = drawingData.canvasWidth;
        canvas.height = drawingData.canvasHeight;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          const img = new Image();
          img.src = thumbnail;
          await new Promise((resolve) => {
            img.onload = resolve;
          });
          ctx.drawImage(img, 0, 0);
        }

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
        });

        filePath = await saveScreenshot(videoName, timestamp, blob);

        if (filePath) {
          finalThumbnail = filePath;
          console.log('Screenshot saved to local file system:', filePath);
        }
      } catch (error) {
        console.error('Failed to save screenshot to file system, using base64:', error);
      }
    }

    const annotation = await saveAnnotation(videoId, timestamp, drawingData, finalThumbnail, name, textContent);

    if (annotation) {
      const updatedAnnotations = await getAnnotations();
      setAnnotations(updatedAnnotations);
      setShowDrawingCanvas(false);
      if (onAnnotationChange) {
        onAnnotationChange();
      }
    }
  };

  const handleSaveLiveDrawing = async (data: {
    strokes: any[];
    startTimestamp: number;
    duration: number;
    thumbnail: string;
    name: string;
  }) => {
    if (!videoId || !videoRef.current) {
      console.error('缺少videoId或videoRef');
      return;
    }

    const liveCanvas = document.querySelector('canvas');
    const canvasWidth = liveCanvas?.width || videoRef.current.videoWidth || 1280;
    const canvasHeight = liveCanvas?.height || videoRef.current.videoHeight || 720;

    const liveDrawingData = {
      strokes: data.strokes.map(stroke => ({
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        points: stroke.points,
        startTime: stroke.startTime,
        endTime: stroke.endTime,
        symbolId: stroke.symbolId,
        symbolChar: stroke.symbolChar,
        symbolSize: stroke.symbolSize,
        symbolRotation: stroke.symbolRotation,
        text: stroke.text,
        fontSize: stroke.fontSize,
        shapeType: stroke.shapeType,
        filled: stroke.filled
      })),
      duration: data.duration,
      canvasWidth,
      canvasHeight
    };

    const drawingData: DrawingData = {
      elements: [],
      canvasWidth,
      canvasHeight
    };

    const videoName = videoId.split('/').pop() || 'video';
    let filePath: string | null = null;
    let finalThumbnail = data.thumbnail;

    if (await checkFileSystemSupport()) {
      try {
        const img = new Image();
        img.src = data.thumbnail;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }

        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/png', 1.0);
        });

        filePath = await saveScreenshot(videoName, data.startTimestamp, blob);

        if (filePath) {
          finalThumbnail = filePath;
        }
      } catch (error) {
        console.error('Failed to save thumbnail:', error);
      }
    }

    try {
      const result = await saveAnnotation(
        videoId,
        data.startTimestamp,
        drawingData,
        finalThumbnail,
        data.name,
        '',
        liveDrawingData
      );

      const updatedAnnotations = await getAnnotations();
      setAnnotations(updatedAnnotations);
      
      if (onAnnotationChange) {
        onAnnotationChange();
      }
    } catch (error) {
      console.error('Failed to save live drawing:', error);
      alert(`保存失败: ${error}`);
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    const success = await deleteAnnotation(id);
    if (success) {
      setAnnotations(prev => prev.filter(a => a.id !== id));
      onAnnotationChange?.();
    }
  };

  const handleSeekToAnnotation = async (annotation: Annotation) => {
    const { timestamp, video_url: targetVideoId, is_live, live_drawing_data } = annotation;
    
    if (targetVideoId && targetVideoId !== videoId) {
      if (onSwitchVideo) {
        onSwitchVideo(targetVideoId, timestamp);
        setShowAnnotationsList(false);
      }
      return;
    }

    if (!videoRef.current) return;

    const video = videoRef.current;
    
    const startTime = (is_live && live_drawing_data) 
      ? timestamp
      : Math.max(0, timestamp - replayBufferBefore);
    
    const endTime = Math.min(duration, timestamp + (live_drawing_data?.duration || replayBufferAfter));

    video.currentTime = startTime;
    setCurrentTime(startTime);
    seekTargetEndTime.current = endTime;

    if (is_live && live_drawing_data) {
      playbackStartTimeRef.current = Date.now();
      setCurrentPlaybackData({
        liveDrawingData: live_drawing_data,
        startTimestamp: timestamp
      });
      setShowLivePlayback(true);
    } else {
      setShowLivePlayback(false);
      setCurrentPlaybackData(null);
    }

    try {
      await video.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to play video:', error);
    }

    setShowAnnotationsList(false);
  };

  const openDrawingCanvas = () => {
    if (!isPlaying && videoRef.current) {
      videoRef.current.pause();
      setShowDrawingCanvas(true);
    }
  };

  const startRecording = async () => {
    try {
      const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
      
      if (recordingMode === 'player' && !canvas) {
        const continueWithoutCanvas = confirm(
          '当前没有涂鸦标注。是否继续录制（仅录制视频画面）？\n\n' +
          '提示：如果要录制涂鸦，请先点击"涂鸦标注"按钮添加标注。'
        );
        if (!continueWithoutCanvas) {
          return;
        }
      }

      if (!includeMicrophone) {
        await recorderRef.current.startRecording({
          mode: recordingMode,
          includeMicrophone: false,
          videoElement: videoRef.current,
          canvasElement: canvas
        });
        
        setIsRecording(true);
        setRecordingTime(0);
        
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
        return;
      }

      try {
        await recorderRef.current.startRecording({
          mode: recordingMode,
          includeMicrophone: true,
          videoElement: videoRef.current,
          canvasElement: canvas
        });
        
        setIsRecording(true);
        setRecordingTime(0);
        
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } catch (micError: any) {
        if (micError.name === 'NotAllowedError' || micError.name === 'PermissionDeniedError') {
          const continueWithoutMic = confirm('麦克风权限被拒绝。是否继续录制（不包含麦克风音频）？');
          if (continueWithoutMic) {
            await recorderRef.current.startRecording({
              mode: recordingMode,
              includeMicrophone: false,
              videoElement: videoRef.current,
              canvasElement: canvas
            });
            
            setIsRecording(true);
            setRecordingTime(0);
            
            recordingTimerRef.current = setInterval(() => {
              setRecordingTime(prev => prev + 1);
            }, 1000);
          }
        } else {
          throw micError;
        }
      }
    } catch (error: any) {
      console.error('启动录制失败:', error);
      alert(`录制失败: ${error.message || '未知错误'}`);
    }
  };

  const stopRecording = async () => {
    try {
      const blob = await recorderRef.current.stopRecording();
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      setIsRecording(false);
      setRecordingTime(0);
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `recording_${timestamp}.webm`;
      
      await recorderRef.current.downloadRecording(blob, filename);
    } catch (error) {
      console.error('停止录制失败:', error);
    }
  };

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {videoUrl ? (
        <>
          <video
            ref={videoRef}
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={onEnded}
            onPlay={() => {
              setIsPlaying(true);
              onPlayingStateChange?.(true);
            }}
            onPause={() => {
              setIsPlaying(false);
              onPlayingStateChange?.(false);
            }}
          />

          <div
            className="absolute inset-0 cursor-pointer"
            onClick={() => {
              togglePlay();
              onTogglePlay?.();
            }}
            style={{ zIndex: 1 }}
          />

          {/* 涂鸦标注按钮 - 只在暂停时显示 */}
          {!isPlaying && (
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openDrawingCanvas();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg transition-all hover:scale-105"
                title="开始涂鸦标注"
              >
                <Paintbrush size={20} />
                <span className="font-medium">涂鸦标注</span>
              </button>
            </div>
          )}

          {/* 录制按钮 - 始终显示（右上角第一个位置）*/}
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all hover:scale-105 ${
                isRecording 
                  ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                  : 'bg-green-600 hover:bg-green-500'
              } text-white`}
              title={
                isRecording 
                  ? '停止录制' 
                  : `开始录制 (${recordingMode === 'player' ? '播放器+涂鸦' : '屏幕录制'})`
              }
            >
              {isRecording ? <Square size={20} /> : <Circle size={20} />}
              <span className="font-medium">
                {isRecording ? `录制中 ${formatRecordingTime(recordingTime)}` : '录制'}
              </span>
            </button>
          </div>

          {/* 实时涂鸦按钮 - 录制按钮下方 */}
          {!showDrawingCanvas && (
            <div className="absolute top-20 right-4 z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLiveDrawing(!showLiveDrawing);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all hover:scale-105 ${
                  showLiveDrawing 
                    ? 'bg-orange-600 hover:bg-orange-500' 
                    : 'bg-purple-600 hover:bg-purple-500'
                } text-white`}
                title={showLiveDrawing ? '关闭实时涂鸦' : '开启实时涂鸦'}
              >
                <Paintbrush size={20} />
                <span className="font-medium">{showLiveDrawing ? '涂鸦中' : '实时涂鸦'}</span>
              </button>

              {videoId && annotations.filter(a => a.video_url === videoId).length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    
                    if (isSearchPanelOpen && showAnnotationsList) {
                      onCloseSearchPanel?.();
                    }
                    else if (!showAnnotationsList) {
                      setShowAnnotationsList(true);
                      onSetActivePanel?.('annotations');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg transition-all hover:scale-105 relative"
                  title="查看涂鸦列表"
                >
                  <BookmarkIcon size={20} />
                  <span className="font-medium">涂鸦列表</span>
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                    {annotations.filter(a => a.video_url === videoId).length}
                  </span>
                </button>
              )}
            </div>
          )}

          {error && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center px-8">
                <p className="text-red-400 text-lg mb-2">Video Error</p>
                <p className="text-gray-300 text-sm">{error}</p>
                <p className="text-gray-400 text-xs mt-3">
                  Try re-selecting your folder or adding the video URL again.
                </p>
              </div>
            </div>
          )}

          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ zIndex: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pb-4 pt-8">
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
                  }}
                />
                {videoId && annotations.filter(a => a.video_url === videoId).map(annotation => (
                  <button
                    key={annotation.id}
                    onClick={() => handleSeekToAnnotation(annotation)}
                    className="absolute top-0 w-3 h-3 bg-yellow-400 rounded-full transform -translate-x-1/2 -translate-y-1 hover:bg-yellow-300 hover:scale-125 transition shadow-lg"
                    style={{
                      left: `${(annotation.timestamp / duration) * 100}%`
                    }}
                    title={`涂鸦 @ ${formatTime(annotation.timestamp)}`}
                  >
                    <BookmarkIcon size={12} className="absolute inset-0 m-auto text-gray-900" fill="currentColor" />
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-3">
                  <CustomizableButton
                    icon={isPlaying ? Pause : Play}
                    imageUrl={buttonDisplayData.play.imageUrl}
                    isMirrored={buttonDisplayData.play.isMirrored}
                    shape={buttonShape}
                    onClick={() => {
                      onButtonClick?.('play');
                      togglePlay();
                    }}
                    size={48}
                    title={isPlaying ? "暂停 (空格)" : "播放 (空格)"}
                  />

                  <CustomizableButton
                    icon={SkipBack}
                    imageUrl={buttonDisplayData.backward.imageUrl}
                    isMirrored={buttonDisplayData.backward.isMirrored}
                    shape={buttonShape}
                    onClick={() => {
                      onButtonClick?.('backward');
                      skip(-10);
                    }}
                    size={40}
                    title="快退 10 秒 (←)"
                  />

                  <CustomizableButton
                    icon={SkipForward}
                    imageUrl={buttonDisplayData.forward.imageUrl}
                    isMirrored={buttonDisplayData.forward.isMirrored}
                    shape={buttonShape}
                    onClick={() => {
                      onButtonClick?.('forward');
                      skip(10);
                    }}
                    size={40}
                    title="快进 10 秒 (→)"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="text-white hover:text-blue-400 transition-colors"
                      title={isMuted ? "取消静音 (M)" : "静音 (M)"}
                    >
                      {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <span className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={openDrawingCanvas}
                    disabled={isPlaying}
                    className={`flex items-center gap-2 px-3 py-1 rounded transition ${
                      isPlaying
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                    title={isPlaying ? "暂停后可涂鸦" : "开始涂鸦"}
                  >
                    <Paintbrush size={18} />
                    <span className="text-sm">涂鸦</span>
                  </button>

                  <button
                    onClick={() => {
                      if (isSearchPanelOpen && showAnnotationsList) {
                        onCloseSearchPanel?.();
                      }
                      else if (!showAnnotationsList) {
                        setShowAnnotationsList(true);
                        onSetActivePanel?.('annotations');
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded transition relative"
                    title="涂鸦列表"
                  >
                    <BookmarkIcon size={18} />
                    <span className="text-sm">列表</span>
                    {videoId && annotations.filter(a => a.video_url === videoId).length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {annotations.filter(a => a.video_url === videoId).length}
                      </span>
                    )}
                  </button>

                  <select
                    value={playbackRate}
                    onChange={(e) => onPlaybackRateChange?.(parseFloat(e.target.value))}
                    className="bg-gray-700 text-white text-sm px-2 py-1 rounded border-none outline-none cursor-pointer hover:bg-gray-600"
                    title="播放速度"
                  >
                    {playbackRates.map(rate => (
                      <option key={rate} value={rate}>{rate}x</option>
                    ))}
                  </select>

                  <button
                    onClick={toggleFullscreen}
                    className="text-white hover:text-blue-400 transition-colors"
                    title="全屏 (F)"
                  >
                    <Maximize size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showLivePlayback && currentPlaybackData && videoRef.current && (
            <LiveDrawingReplay
              videoElement={videoRef.current}
              liveDrawingData={currentPlaybackData.liveDrawingData}
              startTimestamp={currentPlaybackData.startTimestamp}
              isActive={showLivePlayback}
            />
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400 px-8">
          <div className="text-center">
            <p className="text-lg mb-2">No video available</p>
            <p className="text-sm text-gray-500">
              Local files are lost after page refresh. Please re-select your folder or use "Add URL" for persistent videos.
            </p>
          </div>
        </div>
      )}

      {showDrawingCanvas && videoRef.current && videoUrl && (
        <DrawingCanvas
          videoElement={videoRef.current}
          onSave={handleSaveAnnotation}
          onClose={() => setShowDrawingCanvas(false)}
          videoUrl={videoUrl}
          videoName={videoUrl.split('/').pop() || 'video'}
        />
      )}

      <LiveDrawingOverlay
        videoElement={videoRef.current}
        isActive={showLiveDrawing}
        onClose={() => setShowLiveDrawing(false)}
        onSave={handleSaveLiveDrawing}
      />

      {showAnnotationsList && (
        <div 
          className={`fixed top-[100px] right-0 w-[30%] max-h-[calc(100vh-100px)] overflow-hidden ${
            activePanel === 'annotations' ? 'z-50' : 'z-40'
          }`}
          onClick={() => onSetActivePanel?.('annotations')}
        >
          <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-700 h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-white font-semibold">涂鸦列表</h3>
              <button
                onClick={() => setShowAnnotationsList(false)}
                className="text-gray-400 hover:text-white transition"
              >
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <AnnotationsList
                annotations={annotations}
                currentVideoUrl={videoId || ''}
                onSeek={handleSeekToAnnotation}
                onDelete={handleDeleteAnnotation}
                videoElement={videoRef.current}
                videoSegmentSettings={videoSegmentSettings}
                videos={videos}
                onSelectResult={onSelectResult || (() => {})}
                isActive={activePanel === 'annotations'}
                onFocus={() => onSetActivePanel?.('annotations')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const VideoPlayer = React.memo(VideoPlayerComponent, (prevProps, nextProps) => {
  return (
    prevProps.videoUrl === nextProps.videoUrl &&
    prevProps.videoId === nextProps.videoId &&
    prevProps.initialProgress === nextProps.initialProgress &&
    prevProps.playbackRate === nextProps.playbackRate &&
    prevProps.autoPlay === nextProps.autoPlay &&
    prevProps.buttonShape === nextProps.buttonShape &&
    prevProps.buttonDisplayData?.play?.imageUrl === nextProps.buttonDisplayData?.play?.imageUrl &&
    prevProps.buttonDisplayData?.play?.isMirrored === nextProps.buttonDisplayData?.play?.isMirrored &&
    prevProps.buttonDisplayData?.forward?.imageUrl === nextProps.buttonDisplayData?.forward?.imageUrl &&
    prevProps.buttonDisplayData?.forward?.isMirrored === nextProps.buttonDisplayData?.forward?.isMirrored &&
    prevProps.buttonDisplayData?.backward?.imageUrl === nextProps.buttonDisplayData?.backward?.imageUrl &&
    prevProps.buttonDisplayData?.backward?.isMirrored === nextProps.buttonDisplayData?.backward?.isMirrored
  );
});