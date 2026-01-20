/*
  # Create video_segments table

  1. New Tables
    - `video_segments`
      - `id` (uuid, primary key) - Unique identifier for each video segment
      - `video_name` (text) - Name of the source video
      - `video_url` (text) - URL or path of the source video
      - `key_frame_time` (numeric) - The timestamp of the key frame (where the drawing/annotation was made)
      - `start_time` (numeric) - Start time of the video segment (key_frame_time - beforeBuffer)
      - `end_time` (numeric) - End time of the video segment (key_frame_time + afterBuffer)
      - `drawing_data` (jsonb, nullable) - Drawing/annotation data for this segment
      - `text_content` (text, nullable) - Extracted text from annotations for search functionality
      - `thumbnail` (text, nullable) - Base64 or URL of thumbnail image
      - `created_at` (timestamptz) - When the segment was created

  2. Security
    - Enable RLS on `video_segments` table
    - Add policies for public access (will add auth later if needed)

  3. Indexes
    - Index on video_url for faster queries
    - Index on text_content for search functionality
    - Index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS video_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_name text NOT NULL,
  video_url text NOT NULL,
  key_frame_time numeric NOT NULL,
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  drawing_data jsonb,
  text_content text,
  thumbnail text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view video segments"
  ON video_segments
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert video segments"
  ON video_segments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update video segments"
  ON video_segments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete video segments"
  ON video_segments
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_video_segments_video_url ON video_segments(video_url);
CREATE INDEX IF NOT EXISTS idx_video_segments_text_content ON video_segments USING gin(to_tsvector('english', text_content));
CREATE INDEX IF NOT EXISTS idx_video_segments_created_at ON video_segments(created_at DESC);
