/*
  # Create annotations table for video drawings

  1. New Tables
    - `annotations`
      - `id` (uuid, primary key) - Unique identifier for each annotation
      - `video_url` (text) - URL of the video being annotated
      - `timestamp` (float) - Exact video time when annotation was created
      - `drawing_data` (jsonb) - JSON data containing all drawing strokes and shapes
      - `thumbnail` (text) - Base64 encoded thumbnail image of the annotated frame
      - `created_at` (timestamptz) - Timestamp when annotation was created

  2. Indexes
    - Index on video_url for faster queries by video
    - Index on timestamp for time-based navigation

  3. Security
    - RLS disabled for now (no auth system yet)
*/

CREATE TABLE IF NOT EXISTS annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_url text NOT NULL,
  timestamp float NOT NULL,
  drawing_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annotations_video_url ON annotations(video_url);
CREATE INDEX IF NOT EXISTS idx_annotations_timestamp ON annotations(video_url, timestamp);