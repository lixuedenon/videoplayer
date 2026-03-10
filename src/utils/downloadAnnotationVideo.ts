import type { Annotation } from '../types/annotation';
import type { ShapeType } from '../components/ShapeSymbolPicker';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: 'pen' | 'eraser' | 'symbol' | 'text' | 'shape' | 'select';
  color: string;
  width: number;
  points: Point[];
  startTime: number;
  endTime: number;
  symbolId?: string;
  symbolChar?: string;
  symbolSize?: number;
  symbolRotation?: number;
  text?: string;
  fontSize?: number;
  shapeType?: ShapeType;
  filled?: boolean;
  rotation?: number;
}

/**
 * 下载带涂鸦的视频片段
 */
export async function downloadAnnotationVideo(
  videoElement: HTMLVideoElement,
  annotation: Annotation,
  startTime: number,
  endTime: number,
  filename: string
): Promise<boolean> {
  try {
    const duration = endTime - startTime;

    if (duration <= 0 || duration > 600) {
      console.error('Invalid duration:', duration);
      alert('视频片段长度无效（必须在 0-600 秒之间）');
      return false;
    }

    // 检查是否有涂鸦数据（所有annotation都应该有live_drawing_data）
    const hasDrawing = annotation.live_drawing_data && annotation.live_drawing_data.strokes && annotation.live_drawing_data.strokes.length > 0;

    // 创建隐藏的视频元素
    const hiddenVideo = document.createElement('video');
    hiddenVideo.style.position = 'fixed';
    hiddenVideo.style.top = '-9999px';
    hiddenVideo.style.left = '-9999px';
    hiddenVideo.style.width = '1px';
    hiddenVideo.style.height = '1px';
    hiddenVideo.style.opacity = '0';
    hiddenVideo.style.pointerEvents = 'none';
    hiddenVideo.crossOrigin = 'anonymous';
    // 录制时静音，避免播放声音（但音频轨道仍会被捕获）
    hiddenVideo.muted = true;
    hiddenVideo.volume = 0;

    if (videoElement.src) {
      hiddenVideo.src = videoElement.src;
    } else if (videoElement.currentSrc) {
      hiddenVideo.src = videoElement.currentSrc;
    } else {
      alert('无法获取视频源');
      return false;
    }

    document.body.appendChild(hiddenVideo);

    try {
      // 等待视频加载
      await new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          hiddenVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
          hiddenVideo.removeEventListener('error', onError);
          resolve();
        };

        const onError = () => {
          hiddenVideo.removeEventListener('loadedmetadata', onLoadedMetadata);
          hiddenVideo.removeEventListener('error', onError);
          reject(new Error('Failed to load video'));
        };

        hiddenVideo.addEventListener('loadedmetadata', onLoadedMetadata);
        hiddenVideo.addEventListener('error', onError);

        hiddenVideo.load();
      });

      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (hiddenVideo.readyState >= 2) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });

      // 定位到开始时间
      hiddenVideo.currentTime = Math.max(0, startTime);

      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          hiddenVideo.removeEventListener('seeked', onSeeked);
          hiddenVideo.removeEventListener('error', onError);
          resolve();
        };

        const onError = () => {
          hiddenVideo.removeEventListener('seeked', onSeeked);
          hiddenVideo.removeEventListener('error', onError);
          reject(new Error('Failed to seek video'));
        };

        hiddenVideo.addEventListener('seeked', onSeeked);
        hiddenVideo.addEventListener('error', onError);
      });

      let stream: MediaStream;

      // 如果有涂鸦数据，创建合成canvas
      if (hasDrawing && annotation.live_drawing_data) {
        console.log('[DownloadVideo] 开始合成带涂鸦的视频:', {
          startTime,
          endTime,
          duration: endTime - startTime,
          videoWidth: hiddenVideo.videoWidth,
          videoHeight: hiddenVideo.videoHeight,
          annotationTimestamp: annotation.timestamp,
          strokesCount: annotation.live_drawing_data.strokes?.length
        });

        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = hiddenVideo.videoWidth || 1280;
        compositeCanvas.height = hiddenVideo.videoHeight || 720;
        const ctx = compositeCanvas.getContext('2d');

        if (!ctx) {
          alert('无法创建合成画布');
          document.body.removeChild(hiddenVideo);
          return false;
        }

        const drawingData = annotation.live_drawing_data;
        const drawingStartTime = annotation.timestamp;

        // 渲染合成帧的函数
        let frameCount = 0;
        const renderCompositeFrame = () => {
          const currentVideoTime = hiddenVideo.currentTime;
          const relativeTime = currentVideoTime - drawingStartTime;

          // 每30帧打印一次调试信息
          if (frameCount % 30 === 0) {
            console.log('[DownloadVideo] Rendering frame:', {
              frameCount,
              currentVideoTime: currentVideoTime.toFixed(2),
              relativeTime: relativeTime.toFixed(2),
              strokesCount: drawingData.strokes.length
            });
          }
          frameCount++;

          // 清空画布
          ctx.clearRect(0, 0, compositeCanvas.width, compositeCanvas.height);

          // 绘制视频帧
          ctx.drawImage(hiddenVideo, 0, 0, compositeCanvas.width, compositeCanvas.height);

          // 添加视觉调试：绘制半透明绿色边框确认合成可见
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
          ctx.lineWidth = 15;
          ctx.strokeRect(0, 0, compositeCanvas.width, compositeCanvas.height);

          // 绘制涂鸦层
          let drawnStrokesCount = 0;
          if (relativeTime >= 0) {
            drawingData.strokes.forEach((stroke: Stroke) => {
              if (relativeTime < stroke.startTime) return;
              drawnStrokesCount++;

              // 文字
              if (stroke.tool === 'text' && stroke.text && stroke.points.length > 0) {
                ctx.save();
                ctx.font = `${stroke.fontSize || 24}px Arial`;
                ctx.fillStyle = stroke.color;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
                ctx.restore();
                return;
              }

              // 符号
              if (stroke.tool === 'symbol' && stroke.symbolChar && stroke.points.length > 0) {
                ctx.save();
                ctx.translate(stroke.points[0].x, stroke.points[0].y);
                const rotation = stroke.rotation !== undefined ? stroke.rotation : stroke.symbolRotation;
                if (rotation) {
                  ctx.rotate((rotation * Math.PI) / 180);
                }
                ctx.font = `${stroke.symbolSize || 40}px Arial`;
                ctx.fillStyle = stroke.color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(stroke.symbolChar, 0, 0);
                ctx.restore();
                return;
              }

              // 形状
              if (stroke.tool === 'shape' && stroke.shapeType && stroke.points.length >= 2) {
                drawShape(ctx, stroke.shapeType, stroke.points[0], stroke.points[1], {
                  color: stroke.color,
                  width: stroke.width,
                  filled: stroke.filled || false,
                  rotation: stroke.rotation
                });
                return;
              }

              // 画笔/橡皮擦
              if (stroke.points.length >= 2) {
                const isComplete = relativeTime >= stroke.endTime;

                ctx.strokeStyle = stroke.color;
                ctx.lineWidth = stroke.width;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';

                if (stroke.tool === 'eraser') {
                  ctx.globalCompositeOperation = 'destination-out';
                } else {
                  ctx.globalCompositeOperation = 'source-over';
                }

                ctx.beginPath();

                if (isComplete) {
                  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                  for (let i = 1; i < stroke.points.length; i++) {
                    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                  }
                } else {
                  const strokeDuration = stroke.endTime - stroke.startTime;
                  const strokeProgress = (relativeTime - stroke.startTime) / strokeDuration;
                  const pointsToShow = Math.floor(stroke.points.length * strokeProgress);

                  if (pointsToShow >= 2) {
                    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                    for (let i = 1; i < pointsToShow; i++) {
                      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                    }
                  }
                }

                ctx.stroke();
                ctx.globalCompositeOperation = 'source-over';
              }
            });

            // 绘制调试信息
            ctx.font = '30px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(`Rec: ${drawnStrokesCount} strokes at ${relativeTime.toFixed(1)}s`, 20, 50);
          }
        };

        // 使用requestAnimationFrame持续渲染
        const fps = 30;
        let animationId: number | null = null;
        let isRecording = false;

        const animate = () => {
          if (isRecording) {
            renderCompositeFrame();
            animationId = requestAnimationFrame(animate);
          }
        };

        // 渲染第一帧
        renderCompositeFrame();

        // 获取canvas流（视频轨道）
        const canvasStream = compositeCanvas.captureStream(fps);
        const videoTrack = canvasStream.getVideoTracks()[0];

        // 从原始视频获取音频轨道
        let audioTrack = null;
        try {
          const videoStream = (hiddenVideo as any).captureStream
            ? (hiddenVideo as any).captureStream()
            : (hiddenVideo as any).mozCaptureStream?.();

          if (videoStream) {
            const audioTracks = videoStream.getAudioTracks();
            if (audioTracks.length > 0) {
              audioTrack = audioTracks[0];
              console.log('[DownloadVideo] 成功捕获音频轨道');
            } else {
              console.warn('[DownloadVideo] 视频流中没有音频轨道');
            }
          } else {
            console.warn('[DownloadVideo] 无法从视频获取流');
          }
        } catch (e) {
          console.warn('[DownloadVideo] 无法捕获音频轨道:', e);
        }

        // 组合视频和音频轨道
        const tracks = [videoTrack];
        if (audioTrack) {
          tracks.push(audioTrack);
        }
        stream = new MediaStream(tracks);

        console.log('[DownloadVideo] 创建合成流:', {
          hasVideoTrack: !!videoTrack,
          hasAudioTrack: !!audioTrack,
          totalTracks: tracks.length
        });

        // 清理函数
        const cleanup = () => {
          isRecording = false;
          if (animationId !== null) {
            cancelAnimationFrame(animationId);
          }
        };

        // 录制完成后清理
        hiddenVideo.addEventListener('pause', cleanup);
        hiddenVideo.addEventListener('ended', cleanup);

        // 在视频即将播放前启动动画循环
        hiddenVideo.addEventListener('play', () => {
          isRecording = true;
          animate();
        }, { once: true });
      } else {
        // 没有涂鸦，直接录制视频
        stream = (hiddenVideo as any).captureStream ?
          (hiddenVideo as any).captureStream() :
          (hiddenVideo as any).mozCaptureStream();
      }

      if (!stream) {
        alert('您的浏览器不支持视频录制功能');
        document.body.removeChild(hiddenVideo);
        return false;
      }

      const chunks: Blob[] = [];

      // 尝试不同的编码器，选择浏览器支持的
      let options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm' };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: '' } as any; // 使用默认
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => {
          reject(e);
        };

        const actualEndTime = Math.min(endTime, hiddenVideo.duration);
        const recordDuration = (actualEndTime - startTime) * 1000;

        console.log('[DownloadVideo] 准备开始录制:', {
          startTime,
          actualEndTime,
          recordDuration: recordDuration / 1000,
          hasAudio: stream.getAudioTracks().length > 0,
          hasVideo: stream.getVideoTracks().length > 0,
          mimeType: options.mimeType
        });

        // 先播放视频，等渲染循环启动后再开始录制
        const playPromise = hiddenVideo.play();

        if (playPromise !== undefined) {
          playPromise.then(async () => {
            console.log('[DownloadVideo] 视频开始播放');
            // 等待100ms让渲染循环稳定
            await new Promise(r => setTimeout(r, 100));

            console.log('[DownloadVideo] 开始录制，将在', recordDuration / 1000, '秒后停止');
            mediaRecorder.start(100);

            setTimeout(() => {
              console.log('[DownloadVideo] 录制完成，停止录制');
              mediaRecorder.stop();
              hiddenVideo.pause();
            }, recordDuration);
          }).catch((error) => {
            console.error('Play failed:', error);
            reject(error);
          });
        } else {
          // 回退方案
          setTimeout(async () => {
            await new Promise(r => setTimeout(r, 100));
            mediaRecorder.start(100);
            setTimeout(() => {
              console.log('[DownloadVideo] 录制完成，停止录制');
              mediaRecorder.stop();
              hiddenVideo.pause();
            }, recordDuration);
          }, 0);
        }
      });

      const blob = await recordingPromise;

      document.body.removeChild(hiddenVideo);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${startTime.toFixed(0)}-${endTime.toFixed(0)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      if (document.body.contains(hiddenVideo)) {
        document.body.removeChild(hiddenVideo);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error downloading annotation video:', error);
    alert('下载视频片段时出错，请重试');
    return false;
  }
}

// 形状绘制函数（复制自LiveDrawingReplay）
function drawShape(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  start: Point,
  end: Point,
  options: { color: string; width: number; filled: boolean; rotation?: number }
) {
  ctx.save();

  const width = end.x - start.x;
  const height = end.y - start.y;
  const centerX = (start.x + end.x) / 2;
  const centerY = (start.y + end.y) / 2;

  if (options.rotation !== undefined && options.rotation !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate(options.rotation * Math.PI / 180);
    ctx.translate(-centerX, -centerY);
  }

  ctx.strokeStyle = options.color;
  ctx.fillStyle = options.color;
  ctx.lineWidth = options.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (shapeType) {
    case 'circle': {
      const radius = Math.sqrt(width * width + height * height) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      options.filled ? ctx.fill() : ctx.stroke();
      break;
    }
    case 'rectangle': {
      ctx.beginPath();
      ctx.rect(start.x, start.y, width, height);
      options.filled ? ctx.fill() : ctx.stroke();
      break;
    }
    case 'roundRect': {
      const radius = Math.min(Math.abs(width), Math.abs(height)) / 5;
      ctx.beginPath();
      ctx.roundRect(start.x, start.y, width, height, radius);
      options.filled ? ctx.fill() : ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.rect(start.x, start.y, width, height);
      ctx.stroke();
    }
  }

  ctx.restore();
}
