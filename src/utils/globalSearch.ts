// src/utils/globalSearch.ts
// TypeScript工具函数 - 全局搜索功能,搜索视频和标注

import type { VideoFile } from '../types/video';
import type { Annotation } from '../types/annotation';
import { searchAnnotations } from './database';

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

export async function globalSearch(
  query: string,
  videos: VideoFile[],
  isExactMatch: boolean = false
): Promise<SearchResult[]> {
  if (!query.trim()) {
    return [];
  }

  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  videos.forEach((video, index) => {
    const videoNameLower = video.name.toLowerCase();
    const matches = isExactMatch
      ? videoNameLower === lowerQuery
      : videoNameLower.includes(lowerQuery);

    if (matches) {
      results.push({
        type: 'video',
        id: `video-${index}`,
        name: video.name,
        thumbnail: undefined,
        data: video
      });
    }
  });

  try {
    const annotations = await searchAnnotations(query);
    
    annotations.forEach((annotation) => {
      const nameLower = (annotation.name || '').toLowerCase();
      const textContentLower = (annotation.text_content || '').toLowerCase();
      const matches = isExactMatch
        ? nameLower === lowerQuery || textContentLower === lowerQuery
        : nameLower.includes(lowerQuery) || textContentLower.includes(lowerQuery);

      if (matches) {
        const video = videos.find(v => {
          if (v.url && v.url === annotation.video_url) return true;
          if (v.name === annotation.video_url) return true;
          if (v.path === annotation.video_url) return true;
          
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
            id: annotation.id,
            name: annotation.name || `涂鸦 @ ${formatTime(annotation.timestamp)}`,
            thumbnail: annotation.thumbnail,
            timestamp: annotation.timestamp,
            videoName: video.name,
            videoUrl: annotation.video_url,
            data: annotation
          });
        }
      }
    });
  } catch (error) {
    console.error('Failed to search annotations:', error);
  }

  return results;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function captureVideoFrame(
  videoElement: HTMLVideoElement,
  timeInSeconds: number = 0
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    const video = videoElement.cloneNode(false) as HTMLVideoElement;
    
    return new Promise((resolve) => {
      video.currentTime = timeInSeconds;
      
      video.addEventListener('seeked', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(null);
        }
      }, { once: true });
      
      video.addEventListener('error', () => {
        resolve(null);
      }, { once: true });
    });
  } catch (error) {
    console.error('Failed to capture video frame:', error);
    return null;
  }
}