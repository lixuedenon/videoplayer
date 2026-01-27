import React, { useState, useRef } from 'react';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onColorChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // 预设颜色（Windows画图风格）
  const presetColors = [
    // 第一行：纯色
    '#000000', '#787878', '#790300', '#7A4F00', '#7A7A00', '#007902', '#007A7A', '#00037A', '#3F007A', '#7A0067',
    // 第二行：深色
    '#FFFFFF', '#BCBCBC', '#FF0E00', '#FF8500', '#FFFF00', '#00F900', '#00FFFF', '#0400FF', '#7F00FF', '#FF00DC',
    // 第三行：亮色
    '#FFB7B0', '#FFDA9E', '#FFFFA0', '#BEFFB1', '#B0FFFF', '#B8B8FF', '#EFBFFF', '#FFB8ED',
  ];

  const handlePresetClick = (color: string) => {
    onColorChange(color);
  };

  const handleCustomColorClick = () => {
    colorInputRef.current?.click();
  };

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {/* 颜色按钮 */}
      <button
        className="p-2 rounded transition bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center gap-2"
        title="颜色选择"
      >
        <div 
          className="w-5 h-5 rounded border-2 border-white"
          style={{ backgroundColor: selectedColor }}
        />
        <Palette size={16} />
      </button>

      {/* 悬停展开的颜色面板 */}
      {isOpen && (
        <div 
          className="absolute bottom-full left-0 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-3 z-50 w-[280px]"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
        >
          <p className="text-white text-xs mb-2">选择颜色</p>
          
          {/* 预设颜色网格 */}
          <div className="grid grid-cols-10 gap-1 mb-2">
            {presetColors.map((color, index) => (
              <button
                key={index}
                onClick={() => handlePresetClick(color)}
                className={`w-6 h-6 rounded cursor-pointer border-2 transition ${
                  selectedColor.toLowerCase() === color.toLowerCase()
                    ? 'border-white scale-110'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>

          {/* 自定义颜色 */}
          <div className="pt-2 border-t border-gray-700">
            <button
              onClick={handleCustomColorClick}
              className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition flex items-center justify-center gap-2"
            >
              <Palette size={16} />
              自定义颜色
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={selectedColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
};
