export async function downloadVideoSegment(
  videoElement: HTMLVideoElement,
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

    const hiddenVideo = document.createElement('video');
    hiddenVideo.style.position = 'fixed';
    hiddenVideo.style.top = '-9999px';
    hiddenVideo.style.left = '-9999px';
    hiddenVideo.style.width = '1px';
    hiddenVideo.style.height = '1px';
    hiddenVideo.style.opacity = '0';
    hiddenVideo.style.pointerEvents = 'none';
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

      const stream = (hiddenVideo as any).captureStream ?
        (hiddenVideo as any).captureStream() :
        (hiddenVideo as any).mozCaptureStream();

      if (!stream) {
        alert('您的浏览器不支持视频录制功能');
        document.body.removeChild(hiddenVideo);
        return false;
      }

      const chunks: Blob[] = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      });

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

        mediaRecorder.start(100);

        const playPromise = hiddenVideo.play();

        if (playPromise !== undefined) {
          playPromise.then(() => {
            setTimeout(() => {
              mediaRecorder.stop();
              hiddenVideo.pause();
            }, recordDuration);
          }).catch((error) => {
            console.error('Play failed:', error);
            reject(error);
          });
        } else {
          setTimeout(() => {
            mediaRecorder.stop();
            hiddenVideo.pause();
          }, recordDuration);
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
    console.error('Error downloading video segment:', error);
    alert('下载视频片段时出错，请重试');
    return false;
  }
}

export async function downloadVideoSegmentWithUI(
  videoElement: HTMLVideoElement,
  startTime: number,
  endTime: number,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  const duration = endTime - startTime;

  if (onProgress) {
    onProgress(0);
  }

  const progressInterval = setInterval(() => {
    if (onProgress) {
      const elapsed = videoElement.currentTime - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      onProgress(progress);
    }
  }, 100);

  const result = await downloadVideoSegment(videoElement, startTime, endTime, filename);

  clearInterval(progressInterval);

  if (onProgress) {
    onProgress(100);
  }

  return result;
}

export function extractTextFromDrawingData(drawingData: any): string {
  try {
    if (!drawingData || !drawingData.elements) {
      return '';
    }

    const textElements = drawingData.elements.filter((element: any) => element.tool === 'text');
    const textContent = textElements.map((element: any) => element.text || '').join(' ');

    return textContent.trim();
  } catch (error) {
    console.error('Error extracting text from drawing data:', error);
    return '';
  }
}
