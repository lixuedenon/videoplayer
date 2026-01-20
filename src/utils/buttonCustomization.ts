import {
  ButtonSettings,
  ButtonImage,
  ButtonState,
  ButtonName,
  ToggleMode,
  ButtonShape
} from '../types/buttonCustomization';
import { loadImage, saveImage, deleteImage, clearImages, getAllImagesByButton } from './fileSystem';

const SETTINGS_KEY = 'button_settings';
const STATES_KEY = 'button_states';

export async function getButtonSettings(): Promise<ButtonSettings | null> {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) {
    const defaultSettings: ButtonSettings = {
      id: 'local',
      mode: 'click',
      auto_interval: 30,
      stagger_interval: 0.5,
      shape: 'circle',
      user_id: 'local',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    return defaultSettings;
  }
  const settings = JSON.parse(stored);
  // 兼容旧数据，如果没有 stagger_interval 则添加默认值
  if (settings.stagger_interval === undefined) {
    settings.stagger_interval = 0.5;
  }
  if (!settings.created_at) {
    settings.created_at = settings.updated_at || new Date().toISOString();
  }
  return settings;
}

export async function saveButtonSettings(
  mode: ToggleMode,
  autoInterval: number,
  shape: ButtonShape,
  staggerInterval: number = 0.5
): Promise<ButtonSettings | null> {
  const existing = await getButtonSettings();
  const settings: ButtonSettings = {
    id: 'local',
    mode,
    auto_interval: autoInterval,
    stagger_interval: staggerInterval,
    shape,
    user_id: 'local',
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
}

export async function getButtonImages(buttonName: ButtonName): Promise<ButtonImage[]> {
  return await getAllImagesByButton(buttonName);
}

export async function getAllButtonImages(): Promise<Map<ButtonName, ButtonImage[]>> {
  const imageMap = new Map<ButtonName, ButtonImage[]>();
  const buttonNames: ButtonName[] = ['play', 'next', 'prev', 'forward', 'backward', 'add_file', 'add_url', 'folder'];

  for (const buttonName of buttonNames) {
    const images = await getAllImagesByButton(buttonName);
    if (images.length > 0) {
      imageMap.set(buttonName, images);
    }
  }

  return imageMap;
}

export async function addButtonImage(
  buttonName: ButtonName,
  imageUrl: string
): Promise<ButtonImage | null> {
  const existingImages = await getButtonImages(buttonName);

  if (existingImages.length >= 20) {
    console.error('Maximum 20 images per button');
    return null;
  }

  const orderIndex = existingImages.length;
  const id = `${buttonName}-${Date.now()}-${orderIndex}`;

  await saveImage(id, imageUrl, buttonName, orderIndex);

  const image: ButtonImage = {
    id,
    button_name: buttonName,
    image_url: imageUrl,
    order_index: orderIndex,
    user_id: 'local',
    created_at: new Date().toISOString()
  };

  return image;
}

export async function deleteButtonImage(imageId: string): Promise<boolean> {
  await deleteImage(imageId);
  return true;
}

export async function clearButtonImages(buttonName: ButtonName): Promise<boolean> {
  await clearImages(buttonName);
  return true;
}

export async function getButtonState(buttonName: ButtonName): Promise<ButtonState | null> {
  const stored = localStorage.getItem(STATES_KEY);
  if (!stored) {
    return null;
  }

  const states = JSON.parse(stored);
  return states[buttonName] || null;
}

export async function getAllButtonStates(): Promise<Map<ButtonName, ButtonState>> {
  const stored = localStorage.getItem(STATES_KEY);
  const stateMap = new Map<ButtonName, ButtonState>();

  if (!stored) {
    return stateMap;
  }

  const states = JSON.parse(stored);
  Object.entries(states).forEach(([buttonName, state]) => {
    stateMap.set(buttonName as ButtonName, state as ButtonState);
  });

  return stateMap;
}

export async function saveButtonState(
  buttonName: ButtonName,
  currentImageIndex: number,
  isMirrored: boolean
): Promise<ButtonState | null> {
  const stored = localStorage.getItem(STATES_KEY);
  const states = stored ? JSON.parse(stored) : {};

  const state: ButtonState = {
    id: buttonName,
    button_name: buttonName,
    current_image_index: currentImageIndex,
    is_mirrored: isMirrored,
    user_id: 'local',
    updated_at: new Date().toISOString()
  };

  states[buttonName] = state;
  localStorage.setItem(STATES_KEY, JSON.stringify(states));

  return state;
}
