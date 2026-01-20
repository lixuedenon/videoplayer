import { useEffect } from 'react';

interface KeyboardShortcutsHandlers {
  onPlayPause: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
}

export const useKeyboardShortcuts = (handlers: KeyboardShortcutsHandlers) => {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          handlers.onPlayPause();
          break;
        case 'ArrowRight':
          event.preventDefault();
          handlers.onSkipForward();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          handlers.onSkipBackward();
          break;
        case 'ArrowUp':
          event.preventDefault();
          handlers.onVolumeUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          handlers.onVolumeDown();
          break;
        case 'KeyN':
          if (event.shiftKey) {
            event.preventDefault();
            handlers.onNextVideo();
          }
          break;
        case 'KeyP':
          if (event.shiftKey) {
            event.preventDefault();
            handlers.onPreviousVideo();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handlers]);
};
