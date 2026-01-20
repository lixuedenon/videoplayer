export type ButtonName = 'play' | 'next' | 'prev' | 'forward' | 'backward' | 'add_file' | 'add_url' | 'folder';

export type ToggleMode = 'auto' | 'click' | null;

export type ButtonShape = 'circle' | 'ellipse' | 'rounded-rect';

export interface ButtonSettings {
  id: string;
  mode: ToggleMode;
  auto_interval: number;
  stagger_interval: number; // 按钮切换间隔时间（秒）
  shape: ButtonShape;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ButtonImage {
  id: string;
  button_name: ButtonName;
  image_url: string;
  order_index: number;
  user_id: string;
  created_at: string;
}

export interface ButtonState {
  id: string;
  button_name: ButtonName;
  current_image_index: number;
  is_mirrored: boolean;
  user_id: string;
  updated_at: string;
}

export interface ButtonCustomization {
  buttonName: ButtonName;
  images: ButtonImage[];
  currentIndex: number;
  isMirrored: boolean;
}
