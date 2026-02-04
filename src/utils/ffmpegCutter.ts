// src/utils/ffmpegCutter.ts
// FFmpeg视频截取工具 - 快速截取视频片段

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoading = false;
let isLoaded = false;

/**
 * 加载FFmpeg实例（首次使用需要下载32MB文件）
 */
async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  if (isLoading) {
    // 等待加载完成
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpegInstance) return ffmpegInstance;
  }

  isLoading = true;

  try {
    const ffmpeg = new FFmpeg();
    
    // 监听加载进度
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    // 加载FFmpeg核心文件（使用jsdelivr CDN - 国内可访问）
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegInstance = ffmpeg;
    isLoaded = true;
    isLoading = false;

    return ffmpeg;
  } catch (error) {
    isLoading = false;
    throw new Error(`FFmpeg加载失败: ${error}`);
  }
}

/**
 * 快速截取视频片段
 * @param videoUrl 视频URL
 * @param startTime 起始时间（秒）
 * @param endTime 结束时间（秒）
 * @param outputFilename 输出文件名
 * @param onProgress 进度回调
 */
export async function cutVideoSegment(
  videoUrl: string,
  startTime: number,
  endTime: number,
  outputFilename: string = 'segment.mp4',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  try {
    // 加载FFmpeg
    if (onProgress) onProgress(10);
    const ffmpeg = await loadFFmpeg(onProgress);
    if (onProgress) onProgress(30);

    // 获取视频文件
    const videoData = await fetchFile(videoUrl);
    const inputFilename = 'input.mp4';
    
    // 写入FFmpeg虚拟文件系统
    await ffmpeg.writeFile(inputFilename, videoData);
    if (onProgress) onProgress(50);

    // 执行截取命令
    // -ss: 起始时间
    // -to: 结束时间  
    // -i: 输入文件
    // -c copy: 直接复制，不重新编码（速度快）
    // -avoid_negative_ts make_zero: 避免时间戳问题
    await ffmpeg.exec([
      '-ss', startTime.toString(),
      '-to', endTime.toString(),
      '-i', inputFilename,
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      outputFilename
    ]);
    if (onProgress) onProgress(90);

    // 读取输出文件
    const data = await ffmpeg.readFile(outputFilename);
    const blob = new Blob([data], { type: 'video/mp4' });
    
    // 清理文件
    await ffmpeg.deleteFile(inputFilename);
    await ffmpeg.deleteFile(outputFilename);
    
    if (onProgress) onProgress(100);

    return blob;
  } catch (error) {
    console.error('视频截取失败:', error);
    throw new Error(`视频截取失败: ${error}`);
  }
}

/**
 * 检查FFmpeg是否已加载
 */
export function isFFmpegLoaded(): boolean {
  return isLoaded;
}

/**
 * 预加载FFmpeg（可在应用启动时调用）
 */
export async function preloadFFmpeg(onProgress?: (progress: number) => void): Promise<void> {
  await loadFFmpeg(onProgress);
}