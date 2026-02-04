import React from 'react';
import { SYMBOL_CATEGORIES, SymbolItem } from '../constants/symbols';
import { ChevronDown } from 'lucide-react';

interface CompactSymbolPickerProps {
  isVisible: boolean;
  selectedSymbol: SymbolItem | null;
  onSelect: (symbol: SymbolItem) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const CompactSymbolPicker: React.FC<CompactSymbolPickerProps> = ({
  isVisible,
  selectedSymbol,
  onSelect,
  onMouseEnter,
  onMouseLeave
}) => {
  return (
    <div 
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 符号按钮 */}
      <button
        className="p-2 rounded transition bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center gap-1"
        title="符号工具"
      >
        {selectedSymbol ? (
          <span className="text-lg">{selectedSymbol.char}</span>
        ) : (
          <span className="text-lg">😊</span>
        )}
        <ChevronDown size={14} />
      </button>

      {/* 悬停展开的符号面板 - 向上展开，左对齐，无间隙 */}
      {isVisible && (
        <div 
          className="absolute bottom-full left-0 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-3 z-50 w-[340px] max-h-[420px] overflow-y-auto"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {SYMBOL_CATEGORIES.map(category => (
            <div key={category.id} className="mb-3 last:mb-0">
              {/* 分类标题 */}
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-sm">{category.icon}</span>
                <h4 className="text-white text-xs font-medium">{category.name}</h4>
              </div>
              
              {/* 符号网格 - 紧凑布局 */}
              <div className="grid grid-cols-10 gap-1">
                {category.symbols.map(symbol => (
                  <button
                    key={symbol.id}
                    onClick={() => onSelect(symbol)}
                    className={`aspect-square flex items-center justify-center rounded text-lg transition cursor-pointer ${
                      selectedSymbol?.id === symbol.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    title={symbol.name}
                  >
                    {symbol.char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
