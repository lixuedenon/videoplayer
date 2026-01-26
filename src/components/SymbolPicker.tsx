import React, { useState } from 'react';
import { SYMBOL_CATEGORIES, SymbolItem } from '../constants/symbols';
import { ChevronRight } from 'lucide-react';

interface SymbolPickerProps {
  isOpen: boolean;
  onSelect: (symbol: SymbolItem) => void;
  onClose: () => void;
}

export const SymbolPicker: React.FC<SymbolPickerProps> = ({
  isOpen,
  onSelect,
  onClose
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const handleSymbolClick = (symbol: SymbolItem) => {
    onSelect(symbol);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 符号选择面板 */}
      <div className="relative bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* 标题 */}
        <div className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-white">选择符号</h3>
          <p className="text-sm text-gray-400 mt-1">点击符号添加到涂鸦</p>
        </div>
        
        {/* 符号列表 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {SYMBOL_CATEGORIES.map(category => {
            const isExpanded = expandedCategories.has(category.id);
            const visibleSymbols = isExpanded 
              ? category.symbols 
              : category.symbols.slice(0, category.defaultVisible);
            const hasMore = category.symbols.length > category.defaultVisible;

            return (
              <div key={category.id} className="mb-6 last:mb-0">
                {/* 分类标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{category.icon}</span>
                  <h4 className="text-white font-medium">{category.name}</h4>
                  <span className="text-gray-500 text-sm">
                    ({category.symbols.length}个)
                  </span>
                </div>
                
                {/* 符号网格 */}
                <div className="grid grid-cols-8 gap-2 mb-2">
                  {visibleSymbols.map(symbol => (
                    <button
                      key={symbol.id}
                      onClick={() => handleSymbolClick(symbol)}
                      className="aspect-square flex items-center justify-center bg-gray-700 hover:bg-gray-600 rounded-lg text-3xl transition cursor-pointer border-2 border-transparent hover:border-blue-500"
                      title={symbol.name}
                    >
                      {symbol.char}
                    </button>
                  ))}
                </div>
                
                {/* 展开按钮 */}
                {hasMore && (
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    <ChevronRight 
                      size={16} 
                      className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                    {isExpanded ? '收起' : `展开更多 (${category.symbols.length - category.defaultVisible}个)`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
