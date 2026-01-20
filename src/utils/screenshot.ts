export async function captureHighResScreenshot(
  videoElement: HTMLVideoElement,
  scale: number = 2
): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    canvas.width = videoWidth * scale;
    canvas.height = videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return null;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.scale(scale, scale);
    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}

export async function captureScreenshotAsDataURL(
  videoElement: HTMLVideoElement,
  scale: number = 2
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    canvas.width = videoWidth * scale;
    canvas.height = videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return null;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.scale(scale, scale);
    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    return canvas.toDataURL('image/png', 1.0);
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    return null;
  }
}

export async function captureScreenshotWithDrawing(
  videoElement: HTMLVideoElement,
  drawingCanvas: HTMLCanvasElement,
  scale: number = 2
): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;

    canvas.width = videoWidth * scale;
    canvas.height = videoHeight * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return null;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.scale(scale, scale);
    ctx.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

    const drawingAspectRatio = drawingCanvas.width / drawingCanvas.height;
    const videoAspectRatio = videoWidth / videoHeight;

    if (Math.abs(drawingAspectRatio - videoAspectRatio) < 0.01) {
      ctx.drawImage(drawingCanvas, 0, 0, videoWidth, videoHeight);
    } else {
      const scale = Math.min(videoWidth / drawingCanvas.width, videoHeight / drawingCanvas.height);
      const scaledWidth = drawingCanvas.width * scale;
      const scaledHeight = drawingCanvas.height * scale;
      const x = (videoWidth - scaledWidth) / 2;
      const y = (videoHeight - scaledHeight) / 2;

      ctx.drawImage(drawingCanvas, x, y, scaledWidth, scaledHeight);
    }

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('Error capturing screenshot with drawing:', error);
    return null;
  }
}
