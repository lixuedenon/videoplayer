export interface VideoSegmentSettings {
  beforeBuffer: number; // seconds before the key frame
  afterBuffer: number;  // seconds after the key frame
  syncWithReplay?: boolean; // whether to sync save times with replay times
}

export interface VideoSegment {
  id?: string;
  video_name: string;
  video_url: string;
  key_frame_time: number;  // the time of the drawing/annotation
  start_time: number;      // key_frame_time - beforeBuffer
  end_time: number;        // key_frame_time + afterBuffer
  drawing_data?: string;   // JSON string of drawing data
  text_content?: string;   // extracted text from annotations for search
  thumbnail?: string;      // thumbnail image
  created_at?: string;
}
