// src/App.tsx
// React组件 - 应用主组件，视频播放器的主界面和状态管理

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Folder, Link, SkipBack, SkipForward, FilePlus, Settings, Image as ImageIcon, Search, ChevronUp } from 'lucide-react';
import { VideoPlayer } from './components/VideoPlayer';
import { Playlist } from './components/Playlist';
import { AddUrlDialog } from './components/AddUrlDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { CustomizableButton } from './components/CustomizableButton';
import { ButtonCustomizationSettings } from './components/ButtonCustomizationSettings';
import { ButtonImageUpload } from './components/ButtonImageUpload';
import { SearchResultsPanel } from './components/SearchResultsPanel';
import { VideoFile } from './types/video';
import { VideoSegmentSettings } from './types/videoSegment';
import { useButtonCustomization } from './hooks/useButtonCustomization';
import { globalSearch } from './utils/globalSearch';
import { RecordingMode } from './utils/screenRecorder';
import {
  requestDirectoryAccess,
  loadVideosFromDirectory,
  loadVideosFromFileList,
  createVideoUrl,
  isFileSystemAccessSupported,
  saveDirectoryHandle,
  getDirectoryHandle,
  verifyPermission
} from './utils/fileSystem';
import {
  getPlayerState,
  savePlayerState,
  getVideoProgress,
  saveVideoProgress,
  savePlaylist,
  getAnnotations,
  getVideoSegmentSettings
} from './utils/database';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

type PlayMode = 'normal' | 'sequential' | 'random';
type ActivePanel = 'search' | 'annotations' | null;

interface DurationFilter {
  enabled: boolean;
  min: number;
  max: number;
}

interface AnnotationCountFilter {
  enabled: boolean;
  count: number;
}

function App() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isAddUrlDialogOpen, setIsAddUrlDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('normal');
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImageUploadOpen, setIsImageUploadOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoAnnotationCounts, setVideoAnnotationCounts] = useState<Map<string, number>>(new Map());
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const saveProgressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);
  const [useFileSystemAccess, setUseFileSystemAccess] = useState(true);
  const currentVideoPathRef = useRef<string>('');

  // 录制设置状态
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('player');
  const [includeMicrophone, setIncludeMicrophone] = useState(false);

  // 回放设置状态
  const [replayBufferBefore, setReplayBufferBefore] = useState<number>(() => {
    const saved = localStorage.getItem('replayBufferBefore');
    return saved ? parseFloat(saved) : 10;
  });
  const [replayBufferAfter, setReplayBufferAfter] = useState<number>(() => {
    const saved = localStorage.getItem('replayBufferAfter');
    return saved ? parseFloat(saved) : 5;
  });
  const [videoSegmentSettings, setVideoSegmentSettings] = useState<VideoSegmentSettings>({
    beforeBuffer: 15,
    afterBuffer: 20,
    syncWithReplay: false
  });

  const {
    settings: buttonSettings,
    handleButtonClick,
    switchButton,
    getButtonDisplay,
    refreshData: refreshButtonData,
    buttonStates
  } = useButtonCustomization();

  const playState = buttonStates.get('play');
  const forwardState = buttonStates.get('forward');
  const backwardState = buttonStates.get('backward');

  const videoPlayerButtonData = useMemo(() => {
    const playDisplay = getButtonDisplay('play');
    const forwardDisplay = getButtonDisplay('forward');
    const backwardDisplay = getButtonDisplay('backward');

    return {
      play: { imageUrl: playDisplay.imageUrl, isMirrored: playDisplay.isMirrored },
      forward: { imageUrl: forwardDisplay.imageUrl, isMirrored: forwardDisplay.isMirrored },
      backward: { imageUrl: backwardDisplay.imageUrl, isMirrored: backwardDisplay.isMirrored }
    };
  }, [
    playState?.current_image_index,
    playState?.is_mirrored,
    forwardState?.current_image_index,
    forwardState?.is_mirrored,
    backwardState?.current_image_index,
    backwardState?.is_mirrored,
    getButtonDisplay
  ]);

  const pauseVideo = useCallback(() => {
    if (videoPlayerRef.current && !videoPlayerRef.current.paused) {
      videoPlayerRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleAutoPlayComplete = useCallback(() => {
    setShouldAutoPlay(false);
  }, []);

  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isGlobalSearchExact, setIsGlobalSearchExact] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [durationFilter, setDurationFilter] = useState<DurationFilter>({
    enabled: false,
    min: 0,
    max: 3600
  });
  const [annotationCountFilter, setAnnotationCountFilter] = useState<AnnotationCountFilter>({
    enabled: false,
    count: 0
  });
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const handleGlobalSearch = async () => {
    if (!globalSearchQuery.trim() && !durationFilter.enabled && !annotationCountFilter.enabled) {
      setGlobalSearchResults([]);
      setIsGlobalSearchOpen(false);
      return;
    }

    const results = await globalSearch(
      globalSearchQuery,
      videos,
      isGlobalSearchExact,
      durationFilter,
      annotationCountFilter,
      videoAnnotationCounts
    );
    setGlobalSearchResults(results);
    setIsGlobalSearchOpen(true);
    setActivePanel('search');
    setShowSearchDropdown(false);
  };

  const handleCloseGlobalSearch = () => {
    setIsGlobalSearchOpen(false);
    if (activePanel === 'search') {
      setActivePanel(null);
    }
  };

  const handleSelectSearchVideo = (video: VideoFile) => {
    const index = videos.findIndex(v => v.name === video.name);
    if (index >= 0) {
      handleSelectVideo(index);
    }
    setIsGlobalSearchOpen(false);
    setActivePanel(null);
  };

  const handleSelectSearchAnnotation = (videoUrl: string, timestamp: number) => {
    const video = videos.find(v => (v.url || v.path) === videoUrl || v.name === videoUrl);
    if (video) {
      const index = videos.findIndex(v => v.name === video.name);
      if (index >= 0) {
        const bufferBefore = replayBufferBefore;
        setPendingSeekTime(Math.max(0, timestamp - bufferBefore));
        handleSelectVideo(index);
      }
    }
    setIsGlobalSearchOpen(false);
    setActivePanel(null);
  };

  const handleTogglePlay = useCallback(() => {
    switchButton('play');
  }, [switchButton]);

  useEffect(() => {
    loadSavedState();

    if (!isFileSystemAccessSupported()) {
      console.log('File System Access API not supported, using file input fallback');
      setUseFileSystemAccess(false);
    }
  }, []);

  // 加载视频片段设置
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getVideoSegmentSettings();
      setVideoSegmentSettings(settings);
    };
    loadSettings();
  }, []);

  const loadAnnotationCounts = useCallback(async () => {
    try {
      const allAnnotations = await getAnnotations();
      const counts = new Map<string, number>();

      allAnnotations.forEach(annotation => {
        const videoKey = annotation.video_url;
        counts.set(videoKey, (counts.get(videoKey) || 0) + 1);
      });

      setVideoAnnotationCounts(counts);
    } catch (error) {
      console.error('Failed to load annotation counts:', error);
    }
  }, []);

  useEffect(() => {
    loadAnnotationCounts();
  }, [videos, loadAnnotationCounts]);

  useEffect(() => {
    if (videos.length > 0 && currentIndex >= 0 && currentIndex < videos.length) {
      const currentVideo = videos[currentIndex];

      if (currentVideoPathRef.current === currentVideo.path) {
        console.log('Same video path, skipping URL creation:', currentVideo.path);
        return;
      }

      console.log('Video path changed, creating new URL:', currentVideo.path);
      currentVideoPathRef.current = currentVideo.path;

      if (currentVideoUrl && currentVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentVideoUrl);
      }

      if (currentVideo.file) {
        const newUrl = createVideoUrl(currentVideo.file);
        setCurrentVideoUrl(newUrl);
      } else if (currentVideo.url) {
        setCurrentVideoUrl(currentVideo.url);
      } else {
        setCurrentVideoUrl(null);
      }
    } else {
      currentVideoPathRef.current = '';
      if (currentVideoUrl && currentVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentVideoUrl);
      }
      setCurrentVideoUrl(null);
    }
  }, [currentIndex, videos]);

  const loadSavedState = async () => {
    try {
      const [playerState, videoProgress, dirHandle] = await Promise.all([
        getPlayerState(),
        getVideoProgress(),
        getDirectoryHandle()
      ]);

      console.log('Loading saved state, video progress count:', videoProgress.length);
      console.log('Directory handle:', dirHandle ? 'exists' : 'null');
      console.log('Player state:', playerState);

      let localVideos: VideoFile[] = [];
      const localVideoProgress = videoProgress.filter(vp => !vp.video_path || !vp.video_path.startsWith('http'));

      if (dirHandle && isFileSystemAccessSupported()) {
        try {
          console.log('Attempting silent permission restoration...');
          const permissionStatus = await dirHandle.requestPermission({ mode: 'read' });
          console.log('Permission status after request:', permissionStatus);

          if (permissionStatus === 'granted') {
            console.log('Permission granted, loading videos from directory...');
            const allVideosInDir = await loadVideosFromDirectory(dirHandle);
            console.log('Found in directory:', allVideosInDir.length, 'videos');

            const savedVideoNames = new Set(localVideoProgress.map(vp => vp.video_name));
            localVideos = allVideosInDir.filter(video => savedVideoNames.has(video.name));
            console.log('Matched videos:', localVideos.length);

            const progressMap = new Map(
              videoProgress.map(vp => [vp.video_name, vp])
            );

            localVideos.forEach(video => {
              const savedProgress = progressMap.get(video.name);
              if (savedProgress) {
                video.progress = savedProgress.progress_seconds;
                video.duration = savedProgress.duration_seconds || video.duration;
                video.order = savedProgress.play_order;
              }
            });
          } else {
            console.log('Permission not granted, showing placeholder list');
            localVideos = localVideoProgress.map(vp => ({
              name: vp.video_name,
              path: vp.video_path || vp.video_name,
              duration: vp.duration_seconds,
              progress: vp.progress_seconds,
              order: vp.play_order
            }));
          }
        } catch (error) {
          console.error('Error restoring permission:', error);
          localVideos = localVideoProgress.map(vp => ({
            name: vp.video_name,
            path: vp.video_path || vp.video_name,
            duration: vp.duration_seconds,
            progress: vp.progress_seconds,
            order: vp.play_order
          }));
        }
      } else if (localVideoProgress.length > 0) {
        console.log('No directory handle, showing placeholder list');
        localVideos = localVideoProgress.map(vp => ({
          name: vp.video_name,
          path: vp.video_path || vp.video_name,
          duration: vp.duration_seconds,
          progress: vp.progress_seconds,
          order: vp.play_order
        }));
      }

      const urlVideos: VideoFile[] = videoProgress
        .filter(vp => vp.video_path && vp.video_path.startsWith('http'))
        .map(vp => ({
          name: vp.video_name,
          path: vp.video_path,
          url: vp.video_path,
          duration: vp.duration_seconds,
          progress: vp.progress_seconds,
          order: vp.play_order
        }));

      const allVideos = [...localVideos, ...urlVideos].sort((a, b) => a.order - b.order);

      console.log('Loaded videos:', {
        local: localVideos.length,
        url: urlVideos.length,
        total: allVideos.length
      });

      if (allVideos.length > 0) {
        setVideos(allVideos);

        if (playerState && playerState.current_video_index < allVideos.length) {
          setCurrentIndex(playerState.current_video_index);
        } else {
          setCurrentIndex(0);
        }
      } else {
        setVideos([]);
        setCurrentIndex(0);
      }
    } catch (error) {
      console.error('Error loading saved state:', error);
      setVideos([]);
      setCurrentIndex(0);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    if (isFileSystemAccessSupported() && useFileSystemAccess) {
      const dirHandle = await requestDirectoryAccess();
      if (dirHandle) {
        try {
          const loadedVideos = await loadVideosFromDirectory(dirHandle);
          if (loadedVideos.length > 0) {
            await saveDirectoryHandle(dirHandle);
            setVideos(loadedVideos);
            setCurrentIndex(0);
            await savePlaylist(loadedVideos);
            await savePlayerState(0, 'directory');
          } else {
            alert('No video files found in the selected folder');
          }
        } catch (error) {
          console.error('Error loading videos:', error);
          alert('Failed to load videos from folder');
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      try {
        const loadedVideos = await loadVideosFromFileList(files);
        if (loadedVideos.length > 0) {
          setVideos(loadedVideos);
          setCurrentIndex(0);
          await savePlaylist(loadedVideos);
          await savePlayerState(0);
        } else {
          alert('No video files found in the selected files');
        }
      } catch (error) {
        console.error('Error loading videos:', error);
        alert('Failed to load videos from files');
      }
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleAddFiles = () => {
    addFileInputRef.current?.click();
  };

  const handleAddFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      try {
        const newVideos = await loadVideosFromFileList(files);
        if (newVideos.length > 0) {
          const updatedVideos = [...videos];
          newVideos.forEach((video, index) => {
            video.order = videos.length + index;
            updatedVideos.push(video);
          });
          setVideos(updatedVideos);
          await savePlaylist(updatedVideos);
        }
      } catch (error) {
        console.error('Error adding videos:', error);
        alert('Failed to add videos');
      }
    }
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleAddUrl = async (url: string, name: string) => {
    const newVideo: VideoFile = {
      name,
      path: url,
      url,
      duration: 0,
      progress: 0,
      order: videos.length
    };

    const updatedVideos = [...videos, newVideo];
    setVideos(updatedVideos);
    await savePlaylist(updatedVideos);
  };

  const handleDeleteVideo = async (index: number) => {
    const updatedVideos = videos.filter((_, idx) => idx !== index);
    updatedVideos.forEach((video, idx) => {
      video.order = idx;
    });

    setVideos(updatedVideos);
    await savePlaylist(updatedVideos);

    if (currentIndex === index) {
      if (updatedVideos.length > 0) {
        const newIndex = Math.min(index, updatedVideos.length - 1);
        setCurrentIndex(newIndex);
        await savePlayerState(newIndex);
      } else {
        setCurrentIndex(0);
        setCurrentVideoUrl(null);
      }
    } else if (currentIndex > index) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      await savePlayerState(newIndex);
    }
  };

  const handleClearPlaylist = () => {
    setIsConfirmDialogOpen(true);
  };

  const handleConfirmClear = async () => {
    setVideos([]);
    setCurrentIndex(0);
    setCurrentVideoUrl(null);
    await savePlaylist([]);
    await savePlayerState(0);
    setIsConfirmDialogOpen(false);
  };

  const handlePlayCurrent = () => {
    if (videos.length > 0 && currentIndex >= 0 && currentIndex < videos.length) {
      const video = document.querySelector('video');
      if (video) {
        video.play();
      }
    }
  };

  const handleReorderVideos = (startIndex: number, endIndex: number) => {
    const newVideos = [...videos];
    const [movedVideo] = newVideos.splice(startIndex, 1);
    newVideos.splice(endIndex, 0, movedVideo);
    
    const updatedVideos = newVideos.map((video, index) => ({
      ...video,
      order: index
    }));
    
    setVideos(updatedVideos);
    
    if (currentIndex === startIndex) {
      setCurrentIndex(endIndex);
    } else if (startIndex < currentIndex && endIndex >= currentIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (startIndex > currentIndex && endIndex <= currentIndex) {
      setCurrentIndex(currentIndex + 1);
    }
    
    savePlaylist(updatedVideos);
  };

  const handleSelectVideo = async (index: number) => {
    console.log('handleSelectVideo called with index:', index, 'currentIndex:', currentIndex);
    if (index >= 0 && index < videos.length) {
      if (index === currentIndex) {
        const video = document.querySelector('video');
        console.log('Same index selected. video.src:', video?.src);
        if (video && video.src) {
          console.log('Video loaded, toggling play/pause');
          if (video.paused) {
            video.play();
          } else {
            video.pause();
          }
          return;
        }
        console.log('Video not loaded, will load it');
      }

      const selectedVideo = videos[index];

      if (!selectedVideo.file && !selectedVideo.url) {
        console.log('Video has no file or URL, requesting folder access...');

        try {
          const newDirHandle = await requestDirectoryAccess();
          if (newDirHandle) {
            await saveDirectoryHandle(newDirHandle);
            console.log('Access granted, matching existing videos...');
            const allVideosInDir = await loadVideosFromDirectory(newDirHandle);

            const existingVideoNames = new Set(videos.map(v => v.name));
            const matchedVideos = allVideosInDir.filter(v => existingVideoNames.has(v.name));
            console.log('Matched', matchedVideos.length, 'videos from', allVideosInDir.length, 'in directory');

            const videoFileMap = new Map(matchedVideos.map(v => [v.name, v.file]));

            const updatedVideos = videos.map(video => {
              const matchedFile = videoFileMap.get(video.name);
              if (matchedFile) {
                return { ...video, file: matchedFile };
              }
              return video;
            });

            setVideos(updatedVideos);

            if (updatedVideos[index].file) {
              console.log('File restored for video:', index);
              setCurrentIndex(index);
              setShouldAutoPlay(true);
              savePlayerState(index);
            } else {
              console.log('File not found in selected folder');
              alert('The video file was not found in the selected folder. Please select the correct folder.');
            }
            return;
          } else {
            console.log('User cancelled folder selection');
            return;
          }
        } catch (error) {
          console.error('Error accessing folder:', error);
          return;
        }
      }

      console.log('Selecting video:', index, 'Setting autoPlay to true');
      setCurrentIndex(index);
      setShouldAutoPlay(true);
      savePlayerState(index);
    }
  };

  const handleSwitchVideo = useCallback((videoId: string, timestamp: number) => {
    const targetIndex = videos.findIndex(v => (v.url || v.path) === videoId);
    if (targetIndex >= 0) {
      const bufferBefore = replayBufferBefore;
      const startTime = Math.max(0, timestamp - bufferBefore);
      setPendingSeekTime(startTime);
      handleSelectVideo(targetIndex);
    }
  }, [videos, handleSelectVideo, replayBufferBefore]);

  const handleVideoEnded = useCallback(() => {
    if (playMode === 'sequential') {
      if (currentIndex < videos.length - 1) {
        handleSelectVideo(currentIndex + 1);
      } else if (isLoopEnabled) {
        handleSelectVideo(0);
      }
    } else if (playMode === 'random') {
      const availableIndices = videos.map((_, idx) => idx).filter(idx => idx !== currentIndex);
      if (availableIndices.length > 0) {
        const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
        handleSelectVideo(randomIndex);
      } else if (isLoopEnabled && videos.length > 0) {
        const randomIndex = Math.floor(Math.random() * videos.length);
        handleSelectVideo(randomIndex);
      }
    }
  }, [playMode, currentIndex, videos.length, isLoopEnabled]);

  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (videos.length > 0 && currentIndex >= 0 && currentIndex < videos.length) {
      const currentVideo = videos[currentIndex];
      if (!currentVideo) return;

      currentVideo.progress = currentTime;
      if (duration > 0) {
        currentVideo.duration = duration;
      }

      if (saveProgressTimerRef.current) {
        clearTimeout(saveProgressTimerRef.current);
      }
      saveProgressTimerRef.current = setTimeout(() => {
        saveVideoProgress(
          currentVideo.url && currentVideo.url.startsWith('http') ? currentVideo.url : currentVideo.name,
          currentVideo.name,
          currentTime,
          duration > 0 ? duration : currentVideo.duration,
          currentVideo.order
        );
      }, 2000);
    }
  }, [videos, currentIndex]);

  const handleLoadedMetadata = useCallback((duration: number) => {
    if (videos.length > 0 && currentIndex >= 0 && duration > 0) {
      videos[currentIndex].duration = duration;
    }
    if (pendingSeekTime !== null) {
      setPendingSeekTime(null);
    }
  }, [videos, currentIndex, pendingSeekTime]);

  const handleNextVideo = useCallback(() => {
    if (currentIndex < videos.length - 1) {
      handleSelectVideo(currentIndex + 1);
    }
  }, [currentIndex, videos.length]);

  const handlePreviousVideo = useCallback(() => {
    if (currentIndex > 0) {
      handleSelectVideo(currentIndex - 1);
    }
  }, [currentIndex]);

  const handlePlayPause = useCallback(() => {
    const video = document.querySelector('video');
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  }, []);

  const handleSkipForward = useCallback(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = Math.min(video.duration, video.currentTime + 10);
    }
  }, []);

  const handleSkipBackward = useCallback(() => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }
  }, []);

  const handleVolumeUp = useCallback(() => {
    const video = document.querySelector('video');
    if (video) {
      video.volume = Math.min(1, video.volume + 0.1);
    }
  }, []);

  const handleVolumeDown = useCallback(() => {
    const video = document.querySelector('video');
    if (video) {
      video.volume = Math.max(0, video.volume - 0.1);
    }
  }, []);

  const handleSearchSelect = useCallback(async (videoName: string, timestamp?: number) => {
    const videoIndex = videos.findIndex(v => v.name === videoName);

    if (videoIndex === -1) return;

    if (videoIndex !== currentIndex) {
      setCurrentIndex(videoIndex);
      await savePlayerState(videoIndex);
      setShouldAutoPlay(true);
    }

    if (timestamp !== undefined) {
      setTimeout(() => {
        const video = videoPlayerRef.current;
        if (video) {
          video.currentTime = timestamp;
          video.play();
        }
      }, 500);
    } else {
      const video = videoPlayerRef.current;
      if (video) {
        video.play();
      }
    }
  }, [videos, currentIndex]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSearchDropdown && 
          !target.closest('.search-dropdown-container')) {
        setShowSearchDropdown(false);
      }
    };

    if (showSearchDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSearchDropdown]);

  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onSkipForward: handleSkipForward,
    onSkipBackward: handleSkipBackward,
    onNextVideo: handleNextVideo,
    onPreviousVideo: handlePreviousVideo,
    onVolumeUp: handleVolumeUp,
    onVolumeDown: handleVolumeDown
  });

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            <h1 className="text-white text-2xl font-bold">Video Player</h1>

            {videos.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-gray-400 text-sm">
                  Playing: <span className="text-white font-medium">{videos[currentIndex]?.name}</span>
                </p>
                <p className="text-gray-500 text-xs">
                  ({currentIndex + 1} of {videos.length}) • Keyboard: Space (play/pause), ← → (skip 10s), ↑ ↓ (volume), Shift+N/P (next/prev)
                </p>
              </div>
            )}
          </div>

          {videos.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative search-dropdown-container">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  onFocus={() => {
                    setShowSearchDropdown(true);
                    setActivePanel('search');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleGlobalSearch();
                    }
                  }}
                  placeholder="搜索视频、标注..."
                  className="bg-gray-800 text-white pl-10 pr-3 py-2 rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none text-sm w-64"
                />

                {showSearchDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white text-sm font-medium">搜索筛选</span>
                      <button
                        onClick={() => setShowSearchDropdown(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        <ChevronUp size={16} />
                      </button>
                    </div>

                    <div className="mb-4">
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={durationFilter.enabled}
                          onChange={(e) => setDurationFilter({ ...durationFilter, enabled: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-300 text-sm">时长筛选（秒）</span>
                      </label>
                      {durationFilter.enabled && (
                        <div className="flex items-center gap-2 ml-6">
                          <input
                            type="number"
                            value={durationFilter.min}
                            onChange={(e) => setDurationFilter({ ...durationFilter, min: Number(e.target.value) })}
                            placeholder="最小"
                            className="bg-gray-700 text-white px-2 py-1 rounded text-sm w-20"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="number"
                            value={durationFilter.max}
                            onChange={(e) => setDurationFilter({ ...durationFilter, max: Number(e.target.value) })}
                            placeholder="最大"
                            className="bg-gray-700 text-white px-2 py-1 rounded text-sm w-20"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={annotationCountFilter.enabled}
                          onChange={(e) => setAnnotationCountFilter({ ...annotationCountFilter, enabled: e.target.checked })}
                          className="rounded"
                        />
                        <span className="text-gray-300 text-sm">标注数量</span>
                      </label>
                      {annotationCountFilter.enabled && (
                        <div className="ml-6">
                          <input
                            type="number"
                            value={annotationCountFilter.count}
                            onChange={(e) => setAnnotationCountFilter({ ...annotationCountFilter, count: Number(e.target.value) })}
                            placeholder="数量"
                            className="bg-gray-700 text-white px-2 py-1 rounded text-sm w-20"
                            min="0"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleGlobalSearch}
                disabled={!globalSearchQuery.trim() && !durationFilter.enabled && !annotationCountFilter.enabled}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                搜索
              </button>
              <button
                onClick={() => setIsGlobalSearchExact(!isGlobalSearchExact)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isGlobalSearchExact
                    ? 'bg-blue-600 text-white'
                    : 'bg-red-600 text-white hover:bg-red-500'
                }`}
                title={isGlobalSearchExact ? '精确匹配' : '模糊匹配'}
              >
                {isGlobalSearchExact ? '=' : '≈'}
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            {videos.length > 0 && (
              <div className="flex items-center gap-2">
                <CustomizableButton
                  icon={SkipBack}
                  imageUrl={getButtonDisplay('prev').imageUrl}
                  isMirrored={getButtonDisplay('prev').isMirrored}
                  shape={buttonSettings?.shape || 'circle'}
                  onClick={() => {
                    handleButtonClick('prev');
                    handlePreviousVideo();
                  }}
                  disabled={currentIndex === 0}
                  size={42}
                  title="上一个视频 (Shift+P)"
                />
                <CustomizableButton
                  icon={SkipForward}
                  imageUrl={getButtonDisplay('next').imageUrl}
                  isMirrored={getButtonDisplay('next').isMirrored}
                  shape={buttonSettings?.shape || 'circle'}
                  onClick={() => {
                    handleButtonClick('next');
                    handleNextVideo();
                  }}
                  disabled={currentIndex >= videos.length - 1}
                  size={42}
                  title="下一个视频 (Shift+N)"
                />
              </div>
            )}

            <CustomizableButton
              icon={FilePlus}
              imageUrl={getButtonDisplay('add_file').imageUrl}
              isMirrored={getButtonDisplay('add_file').isMirrored}
              shape={buttonSettings?.shape || 'circle'}
              onClick={() => {
                pauseVideo();
                handleButtonClick('add_file');
                handleAddFiles();
              }}
              size={42}
              title="添加文件"
            />

            <CustomizableButton
              icon={Link}
              imageUrl={getButtonDisplay('add_url').imageUrl}
              isMirrored={getButtonDisplay('add_url').isMirrored}
              shape={buttonSettings?.shape || 'circle'}
              onClick={() => {
                pauseVideo();
                handleButtonClick('add_url');
                setIsAddUrlDialogOpen(true);
              }}
              size={42}
              title="添加网络视频"
            />

            <CustomizableButton
              icon={Folder}
              imageUrl={getButtonDisplay('folder').imageUrl}
              isMirrored={getButtonDisplay('folder').isMirrored}
              shape={buttonSettings?.shape || 'circle'}
              onClick={() => {
                pauseVideo();
                handleButtonClick('folder');
                handleSelectFolder();
              }}
              className="bg-blue-600 hover:bg-blue-700"
              size={42}
              title="选择文件夹"
            />

            <button
              onClick={() => {
                pauseVideo();
                setIsImageUploadOpen(true);
              }}
              className="bg-purple-600 text-white p-2 rounded hover:bg-purple-700 transition-colors flex items-center justify-center"
              title="上传按钮图标"
            >
              <ImageIcon size={32} />
            </button>

            <button
              onClick={() => {
                pauseVideo();
                setIsSettingsOpen(true);
              }}
              className="bg-gray-800 text-white p-2 rounded hover:bg-gray-700 transition-colors flex items-center justify-center"
              title="设置"
            >
              <Settings size={32} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            <input
              ref={addFileInputRef}
              type="file"
              accept="video/*"
              multiple
              onChange={handleAddFilesChange}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 w-[70%] p-4">
          <div className="h-full bg-black rounded-lg overflow-hidden shadow-2xl">
            <VideoPlayer
              videoUrl={currentVideoUrl}
              videoId={
                videos[currentIndex]?.url?.startsWith('http')
                  ? videos[currentIndex].url
                  : (videos[currentIndex]?.name || videos[currentIndex]?.path || null)
              }
              onEnded={handleVideoEnded}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              initialProgress={pendingSeekTime !== null ? pendingSeekTime : (videos[currentIndex]?.progress || 0)}
              playbackRate={playbackRate}
              onPlaybackRateChange={setPlaybackRate}
              autoPlay={shouldAutoPlay}
              onAutoPlayComplete={handleAutoPlayComplete}
              onPlayingStateChange={setIsPlaying}
              onTogglePlay={handleTogglePlay}
              onSwitchVideo={handleSwitchVideo}
              buttonShape={buttonSettings?.shape || 'circle'}
              buttonDisplayData={videoPlayerButtonData}
              onButtonClick={handleButtonClick}
              videos={videos}
              onSelectResult={handleSearchSelect}
              onAnnotationChange={loadAnnotationCounts}
              activePanel={activePanel}
              onSetActivePanel={setActivePanel}
              isSearchPanelOpen={isGlobalSearchOpen}
              onCloseSearchPanel={handleCloseGlobalSearch}
              recordingMode={recordingMode}
              includeMicrophone={includeMicrophone}
              replayBufferBefore={replayBufferBefore}
              replayBufferAfter={replayBufferAfter}
              videoSegmentSettings={videoSegmentSettings}
            />
          </div>
        </div>

        <div className="w-[30%] h-full relative">
          <Playlist
            videos={videos}
            currentIndex={currentIndex}
            onSelectVideo={handleSelectVideo}
            onDeleteVideo={handleDeleteVideo}
            onClearPlaylist={handleClearPlaylist}
            onPlayCurrent={handlePlayCurrent}
            playMode={playMode}
            onPlayModeChange={setPlayMode}
            isLoopEnabled={isLoopEnabled}
            onLoopToggle={() => setIsLoopEnabled(!isLoopEnabled)}
            isPlaying={isPlaying}
            videoAnnotationCounts={videoAnnotationCounts}
            onReorderVideos={handleReorderVideos}
          />
          
          <SearchResultsPanel
            results={globalSearchResults}
            isVisible={isGlobalSearchOpen}
            onClose={handleCloseGlobalSearch}
            onSelectVideo={handleSelectSearchVideo}
            onSelectAnnotation={handleSelectSearchAnnotation}
            searchQuery={globalSearchQuery}
            isActive={activePanel === 'search'}
            onFocus={() => setActivePanel('search')}
          />
        </div>
      </div>

      <AddUrlDialog
        isOpen={isAddUrlDialogOpen}
        onClose={() => setIsAddUrlDialogOpen(false)}
        onAddUrl={handleAddUrl}
      />

      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        title="Clear Playlist"
        message="Are you sure you want to clear the entire playlist? This action cannot be undone."
        confirmText="Clear"
        cancelText="Cancel"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsConfirmDialogOpen(false)}
      />

      <ButtonCustomizationSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSettingsChange={refreshButtonData}
        recordingMode={recordingMode}
        setRecordingMode={setRecordingMode}
        includeMicrophone={includeMicrophone}
        setIncludeMicrophone={setIncludeMicrophone}
        replayBufferBefore={replayBufferBefore}
        setReplayBufferBefore={setReplayBufferBefore}
        replayBufferAfter={replayBufferAfter}
        setReplayBufferAfter={setReplayBufferAfter}
        videoSegmentSettings={videoSegmentSettings}
        setVideoSegmentSettings={setVideoSegmentSettings}
      />

      <ButtonImageUpload
        isOpen={isImageUploadOpen}
        onClose={() => setIsImageUploadOpen(false)}
        onUploadComplete={refreshButtonData}
      />
    </div>
  );
}

export default App;