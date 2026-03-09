import { VideoFile } from '../types/video';
import { Annotation, LiveDrawingData } from '../types/annotation';
import { VideoSegmentSettings, VideoSegment } from '../types/videoSegment';
import * as localFileStorage from './localFileStorage';

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
  videoName: string,
  timestamp: number,
  liveDrawingData: LiveDrawingData,
  thumbnail: string,
  name?: string,
  textContent?: string
): Promise<Annotation | null> => {
  try {
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    const annotation: Annotation = {
      id,
      video_url: videoUrl,
      timestamp,
      live_drawing_data: liveDrawingData,
      thumbnail,
      name: name || undefined,
      text_content: textContent || undefined,
      created_at
    };

    const filePath = await localFileStorage.saveAnnotationJSON(
      videoName,
      timestamp,
      annotation
    );

    if (!filePath) {
      throw new Error('Failed to save annotation to file system');
    }

    console.log('Annotation saved to:', filePath);
    return annotation;
  } catch (error) {
    console.error('Error saving annotation:', error);
    return null;
  }
};

export const getAnnotations = async (videoName?: string): Promise<Annotation[]> => {
  try {
    const folders = videoName ? [videoName] : await localFileStorage.listVideoFolders();
    const allAnnotations: Annotation[] = [];

    for (const folderName of folders) {
      const files = await localFileStorage.listFilesInFolder(folderName);

      for (const file of files) {
        if (file.name.endsWith('_annotation.json')) {
          const filePath = `${folderName}/${file.name}`;
          const annotationData = await localFileStorage.loadAnnotationJSON(filePath);

          if (annotationData) {
            allAnnotations.push(annotationData);
          }
        }
      }
    }

    allAnnotations.sort((a, b) => a.timestamp - b.timestamp);
    return allAnnotations;
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return [];
  }
};

export const deleteAnnotation = async (id: string, videoName: string, timestamp: number): Promise<boolean> => {
  try {
    const timestampStr = localFileStorage.formatTimestamp(timestamp);
    const annotationPath = `${localFileStorage.sanitizeFileName(videoName)}/${timestampStr}_annotation.json`;
    const result = await localFileStorage.deleteFile(annotationPath);

    if (result) {
      console.log('Annotation deleted:', annotationPath);
    }

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
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    const videoSegment: VideoSegment = {
      ...segment,
      id,
      created_at
    };

    const filePath = await localFileStorage.saveVideoSegmentJSON(
      segment.video_name,
      segment.start_time,
      videoSegment
    );

    if (!filePath) {
      throw new Error('Failed to save video segment metadata to file system');
    }

    console.log('Video segment metadata saved to:', filePath);
    return videoSegment;
  } catch (error) {
    console.error('Error saving video segment:', error);
    return null;
  }
};

export const getVideoSegments = async (videoName?: string): Promise<VideoSegment[]> => {
  try {
    const folders = videoName ? [videoName] : await localFileStorage.listVideoFolders();
    const allSegments: VideoSegment[] = [];

    for (const folderName of folders) {
      const files = await localFileStorage.listFilesInFolder(folderName);

      for (const file of files) {
        if (file.name.endsWith('_segment.json')) {
          const filePath = `${folderName}/${file.name}`;
          const segmentData = await localFileStorage.loadVideoSegmentJSON(filePath);

          if (segmentData) {
            allSegments.push(segmentData);
          }
        }
      }
    }

    allSegments.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    return allSegments;
  } catch (error) {
    console.error('Error fetching video segments:', error);
    return [];
  }
};

export const deleteVideoSegment = async (id: string, videoName: string, startTime: number): Promise<boolean> => {
  try {
    const timestampStr = localFileStorage.formatTimestamp(startTime);
    const segmentJsonPath = `${localFileStorage.sanitizeFileName(videoName)}/${timestampStr}_segment.json`;
    const segmentVideoPath = `${localFileStorage.sanitizeFileName(videoName)}/${timestampStr}_segment.webm`;

    const jsonDeleted = await localFileStorage.deleteFile(segmentJsonPath);
    const videoDeleted = await localFileStorage.deleteFile(segmentVideoPath);

    if (jsonDeleted || videoDeleted) {
      console.log('Video segment deleted:', segmentJsonPath);
    }

    return jsonDeleted && videoDeleted;
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

    const allAnnotations = await getAnnotations();
    const lowerQuery = query.toLowerCase();

    const filtered = allAnnotations.filter(annotation => {
      const nameMatch = annotation.name?.toLowerCase().includes(lowerQuery);
      const textMatch = annotation.text_content?.toLowerCase().includes(lowerQuery);
      return nameMatch || textMatch;
    });

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  } catch (error) {
    console.error('Error searching annotations:', error);
    return [];
  }
};
