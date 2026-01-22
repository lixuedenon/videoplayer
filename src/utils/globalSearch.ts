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

  // 搜索视频名称并生成缩略图
  for (let index = 0; index < videos.length; index++) {
    const video = videos[index];
    const videoNameLower = video.name.toLowerCase();
    const matches = isExactMatch
      ? videoNameLower === lowerQuery
      : videoNameLower.includes(lowerQuery);

    if (matches) {
      // 生成视频缩略图(从第30-100帧随机选择)
      let thumbnail: string | undefined = undefined;
      try {
        if (video.file || video.url) {
          thumbnail = await generateVideoThumbnail(video);
        }
      } catch (error) {
        console.error('Failed to generate thumbnail for video:', video.name, error);
      }

      results.push({
        type: 'video',
        id: `video-${index}`,
        name: video.name,
        thumbnail: thumbnail,
        data: video
      });
    }
  }

  // 搜索标注
  try {
    const annotations = await searchAnnotations(query);
    
    annotations.forEach((annotation) => {
      const nameLower = (annotation.name || '').toLowerCase();
      const textContentLower = (annotation.text_content || '').toLowerCase();
      const matches = isExactMatch
        ? nameLower === lowerQuery || textContentLower === lowerQuery
        : nameLower.includes(lowerQuery) || textContentLower.includes(lowerQuery);

      if (matches) {
        // 查找对应的视频
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

async function generateVideoThumbnail(video: VideoFile): Promise<string | null> {
  return new Promise((resolve) => {
    const videoElement = document.createElement('video');
    videoElement.style.position = 'fixed';
    videoElement.style.top = '-9999px';
    videoElement.style.left = '-9999px';
    videoElement.style.width = '1px';
    videoElement.style.height = '1px';
    videoElement.muted = true;

    let objectUrl: string | null = null;

    const cleanup = () => {
      videoElement.remove();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };

    videoElement.addEventListener('loadedmetadata', () => {
      const duration = videoElement.duration;
      if (duration > 0) {
        // 从第30-100帧随机选择(假设30fps)
        const minTime = Math.min(1, duration); // 第30帧约1秒
        const maxTime = Math.min(3.33, duration); // 第100帧约3.33秒
        const randomTime = Math.random() * (maxTime - minTime) + minTime;
        
        videoElement.currentTime = randomTime;
      } else {
        cleanup();
        resolve(null);
      }
    });

    videoElement.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 360;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          cleanup();
          resolve(thumbnail);
        } else {
          cleanup();
          resolve(null);
        }
      } catch (error) {
        console.error('Failed to capture frame:', error);
        cleanup();
        resolve(null);
      }
    }, { once: true });

    videoElement.addEventListener('error', (e) => {
      console.error('Video load error:', e);
      cleanup();
      resolve(null);
    });

    try {
      if (video.file) {
        objectUrl = URL.createObjectURL(video.file);
        videoElement.src = objectUrl;
      } else if (video.url) {
        videoElement.src = video.url;
      } else {
        cleanup();
        resolve(null);
        return;
      }

      document.body.appendChild(videoElement);
      videoElement.load();
    } catch (error) {
      console.error('Failed to load video:', error);
      cleanup();
      resolve(null);
    }
  });
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