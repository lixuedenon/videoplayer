import { VideoFile } from '../types/video';
import { Annotation, DrawingData } from '../types/annotation';
import { VideoSegmentSettings, VideoSegment } from '../types/videoSegment';
import * as indexedDB from './indexedDB';
import { saveScreenshot, deleteFile, getFileURL } from './localFileStorage';

const PLAYER_STATE_KEY = 'player_state';
const VIDEO_PROGRESS_KEY = 'video_progress';
const VIDEO_SEGMENT_SETTINGS_KEY = 'video_segment_settings';

export interface PlayerState {
  current_video_index: number;
  folder_handle_id: string | null;
  updated_at: string;
}

export interface VideoProgress {
  video_path: string;
  video_name: string;
  progress_seconds: number;
  duration_seconds: number;
  play_order: number;
  updated_at: string;
}

export const getPlayerState = async (): Promise<PlayerState | null> => {
  const stored = localStorage.getItem(PLAYER_STATE_KEY);
  if (!stored) {
    return null;
  }
  return JSON.parse(stored);
};

export const savePlayerState = async (
  currentIndex: number,
  folderHandleId: string | null = null
): Promise<void> => {
  const state: PlayerState = {
    current_video_index: currentIndex,
    folder_handle_id: folderHandleId,
    updated_at: new Date().toISOString()
  };
  localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
};

export const getVideoProgress = async (): Promise<VideoProgress[]> => {
  const stored = localStorage.getItem(VIDEO_PROGRESS_KEY);
  if (!stored) {
    return [];
  }
  return JSON.parse(stored);
};

export const saveVideoProgress = async (
  videoPath: string,
  videoName: string,
  progressSeconds: number,
  durationSeconds: number,
  playOrder: number
): Promise<void> => {
  const allProgress = await getVideoProgress();
  const existingIndex = allProgress.findIndex(p => p.video_name === videoName);

  const progress: VideoProgress = {
    video_path: videoPath,
    video_name: videoName,
    progress_seconds: progressSeconds,
    duration_seconds: durationSeconds,
    play_order: playOrder,
    updated_at: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    allProgress[existingIndex] = progress;
  } else {
    allProgress.push(progress);
  }

  localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(allProgress));
};

export const savePlaylist = async (videos: VideoFile[]): Promise<void> => {
  const progressData: VideoProgress[] = videos.map(video => ({
    video_path: video.url && video.url.startsWith('http') ? video.url : video.path,
    video_name: video.name,
    progress_seconds: video.progress || 0,
    duration_seconds: video.duration || 0,
    play_order: video.order,
    updated_at: new Date().toISOString()
  }));

  localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(progressData));
  console.log('Playlist saved successfully:', progressData.length, 'videos');
};

export const clearPlaylist = async (): Promise<void> => {
  localStorage.removeItem(VIDEO_PROGRESS_KEY);
};

export const saveAnnotation = async (
  videoUrl: string,
  timestamp: number,
  drawingData: DrawingData,
  thumbnail: string,
  name?: string,
  textContent?: string
): Promise<Annotation | null> => {
  try {
    const annotation = await indexedDB.addAnnotation({
      video_url: videoUrl,
      timestamp,
      drawing_data: drawingData,
      thumbnail,
      name: name || null,
      text_content: textContent || null
    });

    return annotation;
  } catch (error) {
    console.error('Error saving annotation:', error);
    return null;
  }
};

export const getAnnotations = async (videoUrl?: string): Promise<Annotation[]> => {
  try {
    const annotations = await indexedDB.getAnnotations(videoUrl);
    return annotations;
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return [];
  }
};

export const deleteAnnotation = async (id: string): Promise<boolean> => {
  try {
    const result = await indexedDB.deleteAnnotation(id);
    return result;
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return false;
  }
};

export const getVideoSegmentSettings = async (): Promise<VideoSegmentSettings> => {
  const stored = localStorage.getItem(VIDEO_SEGMENT_SETTINGS_KEY);
  if (!stored) {
    return { beforeBuffer: 15, afterBuffer: 20 };
  }
  return JSON.parse(stored);
};

export const saveVideoSegmentSettings = async (settings: VideoSegmentSettings): Promise<void> => {
  localStorage.setItem(VIDEO_SEGMENT_SETTINGS_KEY, JSON.stringify(settings));
};

export const saveVideoSegment = async (segment: Omit<VideoSegment, 'id' | 'created_at'>): Promise<VideoSegment | null> => {
  try {
    const videoSegment = await indexedDB.addVideoSegment(segment);
    return videoSegment;
  } catch (error) {
    console.error('Error saving video segment:', error);
    return null;
  }
};

export const getVideoSegments = async (videoUrl?: string): Promise<VideoSegment[]> => {
  try {
    const segments = await indexedDB.getVideoSegments(videoUrl);
    return segments;
  } catch (error) {
    console.error('Error fetching video segments:', error);
    return [];
  }
};

export const deleteVideoSegment = async (id: string): Promise<boolean> => {
  try {
    const result = await indexedDB.deleteVideoSegment(id);
    return result;
  } catch (error) {
    console.error('Error deleting video segment:', error);
    return false;
  }
};

export const searchAnnotations = async (query: string): Promise<Annotation[]> => {
  try {
    if (!query.trim()) {
      return [];
    }

    const results = await indexedDB.searchAnnotations(query);
    return results;
  } catch (error) {
    console.error('Error searching annotations:', error);
    return [];
  }
};
