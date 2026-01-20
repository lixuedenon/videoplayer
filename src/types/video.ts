export interface VideoFile {
  name: string;
  path: string;
  file?: File;
  url?: string;
  duration: number;
  progress: number;
  order: number;
}

export interface PlaybackState {
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  isMuted: boolean;
}
