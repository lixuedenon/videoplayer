export type RecordingMode = 'screen' | 'player';

export interface RecordingOptions {
  mode: RecordingMode;
  includeMicrophone?: boolean;
  videoElement?: HTMLVideoElement | null;
  canvasElement?: HTMLCanvasElement | null;
}

export class ScreenRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private canvasStream: MediaStream | null = null;
  private animationFrameId: number | null = null;

  async startRecording(options: RecordingOptions): Promise<void> {
    this.recordedChunks = [];
    
    if (options.mode === 'screen') {
      // 功能1：屏幕录制
      await this.startScreenRecording(options.includeMicrophone);
    } else {
      // 功能2：播放器+涂鸦录制
      await this.startPlayerRecording(options);
    }
  }

  private async startScreenRecording(includeMicrophone: boolean = false): Promise<void> {
    try {
      // 请求屏幕录制权限
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        } as any,
        audio: true // 系统音频
      });

      // 如果需要麦克风
      if (includeMicrophone) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });

        // 合并系统音频和麦克风
        const audioContext = new AudioContext();
        const displayAudioSource = audioContext.createMediaStreamSource(displayStream);
        const micAudioSource = audioContext.createMediaStreamSource(micStream);
        const destination = audioContext.createMediaStreamDestination();

        displayAudioSource.connect(destination);
        micAudioSource.connect(destination);

        // 合并视频轨道和音频轨道
        const videoTrack = displayStream.getVideoTracks()[0];
        const combinedStream = new MediaStream([
          videoTrack,
          ...destination.stream.getAudioTracks()
        ]);

        this.stream = combinedStream;
      } else {
        this.stream = displayStream;
      }

      this.startMediaRecorder(this.stream);
    } catch (error) {
      console.error('屏幕录制失败:', error);
      throw error;
    }
  }

  private async startPlayerRecording(options: RecordingOptions): Promise<void> {
    const { videoElement, canvasElement, includeMicrophone } = options;

    if (!videoElement) {
      throw new Error('需要提供video元素');
    }

    try {
      // 创建离屏canvas用于合成
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = videoElement.videoWidth || 1280;
      offscreenCanvas.height = videoElement.videoHeight || 720;
      const ctx = offscreenCanvas.getContext('2d');

      if (!ctx) {
        throw new Error('无法创建canvas context');
      }

      // 绘制函数：合成video帧 + 涂鸦层（如果有）
      const drawFrame = () => {
        // 绘制视频帧
        ctx.drawImage(videoElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
        
        // 叠加涂鸦层（如果存在）
        if (canvasElement) {
          ctx.drawImage(canvasElement, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
        }
        
        if (this.mediaRecorder?.state === 'recording') {
          this.animationFrameId = requestAnimationFrame(drawFrame);
        }
      };

      // 捕获canvas流
      this.canvasStream = offscreenCanvas.captureStream(30); // 30fps

      // 捕获视频音频
      const videoStream = (videoElement as any).captureStream?.();
      let audioTracks: MediaStreamTrack[] = [];

      if (videoStream) {
        audioTracks = videoStream.getAudioTracks();
      }

      // 如果需要麦克风
      if (includeMicrophone) {
        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        audioTracks.push(...micStream.getAudioTracks());
      }

      // 合并视频和音频
      const combinedStream = new MediaStream([
        ...this.canvasStream.getVideoTracks(),
        ...audioTracks
      ]);

      this.stream = combinedStream;
      this.startMediaRecorder(this.stream);

      // 开始绘制
      drawFrame();
    } catch (error) {
      console.error('播放器录制失败:', error);
      throw error;
    }
  }

  private startMediaRecorder(stream: MediaStream): void {
    const options = { mimeType: 'video/webm;codecs=vp9' };
    
    // 尝试不同的编码格式
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm;codecs=vp8';
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(1000); // 每秒保存一次数据
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('没有正在进行的录制'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        
        // 清理资源
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.animationFrameId) {
          cancelAnimationFrame(this.animationFrameId);
        }

        this.mediaRecorder = null;
        this.stream = null;
        this.canvasStream = null;
        this.animationFrameId = null;

        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  async downloadRecording(blob: Blob, filename: string = 'recording.webm'): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
