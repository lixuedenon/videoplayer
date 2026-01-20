import React, { useState, useEffect } from 'react';
import { X, Settings } from 'lucide-react';
import { ToggleMode, ButtonShape } from '../types/buttonCustomization';
import { getButtonSettings, saveButtonSettings } from '../utils/buttonCustomization';

interface ButtonCustomizationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: () => void;
}

export const ButtonCustomizationSettings: React.FC<ButtonCustomizationSettingsProps> = ({
  isOpen,
  onClose,
  onSettingsChange
}) => {
  const [mode, setMode] = useState<ToggleMode>(null);
  const [autoInterval, setAutoInterval] = useState(5);
  const [staggerInterval, setStaggerInterval] = useState(0.5);
  const [shape, setShape] = useState<ButtonShape>('circle');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    const settings = await getButtonSettings();
    if (settings) {
      setMode(settings.mode);
      setAutoInterval(settings.auto_interval);
      setStaggerInterval(settings.stagger_interval ?? 0.5);
      setShape(settings.shape);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    await saveButtonSettings(mode, autoInterval, shape, staggerInterval);
    onSettingsChange();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings className="text-blue-400" size={24} />
            <h2 className="text-white text-xl font-bold">Button Customization</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="关闭"
          >
            <X size={24} />
          </button>
        </div>

        {isLoading ? (
          <div className="text-white text-center py-4">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-white text-sm font-medium mb-3">
                Toggle Mode
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === null}
                    onChange={() => setMode(null)}
                    className="w-4 h-4"
                  />
                  <span>Disabled</span>
                </label>
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'auto'}
                    onChange={() => setMode('auto')}
                    className="w-4 h-4"
                  />
                  <span>Auto Switch</span>
                </label>
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'click'}
                    onChange={() => setMode('click')}
                    className="w-4 h-4"
                  />
                  <span>Click to Switch</span>
                </label>
              </div>
            </div>

            {mode === 'auto' && (
              <>
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Auto Switch Interval
                  </label>
                  <select
                    value={autoInterval}
                    onChange={(e) => setAutoInterval(Number(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={0.167}>10 seconds</option>
                    <option value={1}>1 minute</option>
                    <option value={3}>3 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Stagger Animation Interval
                  </label>
                  <select
                    value={staggerInterval}
                    onChange={(e) => setStaggerInterval(Number(e.target.value))}
                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                  >
                    <option value={0.3}>0.3 seconds</option>
                    <option value={0.5}>0.5 seconds</option>
                    <option value={0.8}>0.8 seconds</option>
                    <option value={1}>1 second</option>
                    <option value={1.5}>1.5 seconds</option>
                    <option value={2}>2 seconds</option>
                  </select>
                  <p className="text-gray-400 text-xs mt-1">
                    Delay between each button switch during animation
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-white text-sm font-medium mb-2">
                Button Shape
              </label>
              <select
                value={shape}
                onChange={(e) => setShape(e.target.value as ButtonShape)}
                className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="circle">Circle</option>
                <option value="ellipse">Ellipse</option>
                <option value="rounded-rect">Rounded Rectangle</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Save Settings
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
