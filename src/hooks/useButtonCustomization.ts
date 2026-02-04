import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ButtonName,
  ButtonSettings,
  ButtonImage,
  ButtonState
} from '../types/buttonCustomization';
import {
  getButtonSettings,
  getAllButtonImages,
  getAllButtonStates,
  saveButtonState
} from '../utils/buttonCustomization';

interface ButtonDisplay {
  imageUrl: string | null;
  isMirrored: boolean;
}

export function useButtonCustomization() {
  const [settings, setSettings] = useState<ButtonSettings | null>(null);
  const [buttonImages, setButtonImages] = useState<Map<ButtonName, ButtonImage[]>>(new Map());
  const [buttonStates, setButtonStates] = useState<Map<ButtonName, ButtonState>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const autoSwitchTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // 使用 ref 来保持对最新 buttonImages 的引用
  const buttonImagesRef = useRef(buttonImages);
  useEffect(() => {
    buttonImagesRef.current = buttonImages;
  }, [buttonImages]);

  useEffect(() => {
    if (settings?.mode === 'auto' && settings.auto_interval) {
      const staggerInterval = settings.stagger_interval ?? 0.5;
      console.log('🔄 Starting auto-switch with interval:', settings.auto_interval, 'minutes, stagger:', staggerInterval, 'seconds');

      const performStaggeredSwitch = () => {
        console.log('⏰ Auto-switching buttons with staggered animation...');
        const buttonNames: ButtonName[] = ['play', 'next', 'prev', 'forward', 'backward', 'add_file', 'add_url', 'folder'];

        // 随机打乱按钮顺序
        const shuffled = [...buttonNames].sort(() => Math.random() - 0.5);

        // 立即切换第一个按钮
        const switchSingleButton = (buttonName: ButtonName) => {
          setButtonStates(prev => {
            const images = buttonImagesRef.current.get(buttonName);
            if (!images || images.length === 0) return prev;

            const newMap = new Map(prev);
            const now = new Date().toISOString();
            const currentState = prev.get(buttonName);
            const currentIndex = currentState?.current_image_index ?? 0;
            const isMirrored = currentState?.is_mirrored ?? false;

            if (!isMirrored) {
              saveButtonState(buttonName, currentIndex, true);
              newMap.set(buttonName, {
                ...currentState!,
                is_mirrored: true,
                updated_at: now
              });
            } else {
              const availableIndices = images
                .map((_, idx) => idx)
                .filter(idx => idx !== currentIndex);

              let nextIndex: number;
              if (availableIndices.length > 0) {
                nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
              } else {
                nextIndex = currentIndex;
              }

              saveButtonState(buttonName, nextIndex, false);
              newMap.set(buttonName, {
                ...currentState!,
                current_image_index: nextIndex,
                is_mirrored: false,
                updated_at: now
              });
            }

            return newMap;
          });
        };

        // 交错切换所有按钮
        shuffled.forEach((buttonName, index) => {
          if (index === 0) {
            // 第一个按钮立即切换
            switchSingleButton(buttonName);
          } else {
            // 使用用户设定的间隔时间
            const totalDelay = index * staggerInterval * 1000;

            setTimeout(() => {
              switchSingleButton(buttonName);
            }, totalDelay);
          }
        });
      };

      // 等待设定的时间后再开始切换
      const timer = setInterval(performStaggeredSwitch, settings.auto_interval * 60 * 1000);

      autoSwitchTimer.current = timer;

      return () => {
        console.log('🛑 Stopping auto-switch');
        clearInterval(timer);
        autoSwitchTimer.current = null;
      };
    } else {
      if (autoSwitchTimer.current) {
        clearInterval(autoSwitchTimer.current);
        autoSwitchTimer.current = null;
      }
    }
  }, [settings?.mode, settings?.auto_interval, settings?.stagger_interval]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settingsData, imagesData, statesData] = await Promise.all([
        getButtonSettings(),
        getAllButtonImages(),
        getAllButtonStates()
      ]);

      setSettings(settingsData);
      setButtonImages(imagesData);
      setButtonStates(statesData);
    } catch (error) {
      console.error('Error loading button customization data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const switchButton = useCallback(async (buttonName: ButtonName) => {
    const images = buttonImages.get(buttonName);
    if (!images || images.length === 0) return;

    const currentState = buttonStates.get(buttonName);
    const currentIndex = currentState?.current_image_index ?? 0;
    const isMirrored = currentState?.is_mirrored ?? false;
    const now = new Date().toISOString();

    if (!isMirrored) {
      await saveButtonState(buttonName, currentIndex, true);
      setButtonStates(prev => {
        const newMap = new Map(prev);
        const state = prev.get(buttonName) || {
          id: '',
          button_name: buttonName,
          current_image_index: currentIndex,
          is_mirrored: true,
          user_id: '',
          updated_at: now
        };
        newMap.set(buttonName, { ...state, is_mirrored: true, updated_at: now });
        return newMap;
      });
    } else {
      const availableIndices = images
        .map((_, idx) => idx)
        .filter(idx => idx !== currentIndex);

      let nextIndex: number;
      if (availableIndices.length > 0) {
        nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
      } else {
        nextIndex = currentIndex;
      }

      await saveButtonState(buttonName, nextIndex, false);
      setButtonStates(prev => {
        const newMap = new Map(prev);
        const state = prev.get(buttonName) || {
          id: '',
          button_name: buttonName,
          current_image_index: nextIndex,
          is_mirrored: false,
          user_id: '',
          updated_at: now
        };
        newMap.set(buttonName, { ...state, current_image_index: nextIndex, is_mirrored: false, updated_at: now });
        return newMap;
      });
    }
  }, [buttonImages, buttonStates]);

  const handleButtonClick = useCallback(async (buttonName: ButtonName) => {
    if (settings?.mode !== 'click') return;
    await switchButton(buttonName);
  }, [settings?.mode, switchButton]);

  const getButtonDisplay = useCallback((buttonName: ButtonName): ButtonDisplay => {
    const images = buttonImages.get(buttonName);
    if (!images || images.length === 0) {
      return { imageUrl: null, isMirrored: false };
    }

    const state = buttonStates.get(buttonName);
    const currentIndex = state?.current_image_index ?? 0;
    const isMirrored = state?.is_mirrored ?? false;

    const image = images[currentIndex];
    return {
      imageUrl: image?.image_url || null,
      isMirrored
    };
  }, [buttonImages, buttonStates]);

  const refreshData = async () => {
    await loadData();
  };

  return {
    settings,
    buttonImages,
    buttonStates,
    isLoading,
    handleButtonClick,
    switchButton,
    getButtonDisplay,
    refreshData
  };
}
