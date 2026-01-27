import React from 'react';
import { ChevronDown, Upload } from 'lucide-react';

export type ShapeType = 
  // 画笔
  | 'freepen'
  // 基础形状
  | 'circle' | 'rectangle' | 'roundRect' | 'diamond' | 'triangleUp' | 'triangleDown' 
  | 'triangleLeft' | 'triangleRight' | 'hexagon' | 'star'
  // 线条类
  | 'line' | 'vertical' | 'horizontal' | 'diagonal45' | 'diagonal135' | 'parallel'
  | 'lShape' | 'zShape' | 'arrowBoth' | 'arrowRight' | 'arrowLeft' | 'arrowUp' | 'arrowDown'
  // 标注类
  | 'cloud' | 'speech' | 'thought' | 'dashedBox' | 'bracket' | 'bookQuote'
  // 数学/专业
  | 'angle' | 'perpendicular' | 'parallelSymbol' | 'arc' | 'circlePlus' | 'circleCross';

interface ShapeItem {
  id: string;
  name: string;
  type: ShapeType;
  icon: string;
  category: string;
}

interface ShapeSymbolPickerProps {
  isVisible: boolean;
  selectedShape: ShapeItem | null;
  onSelect: (shape: ShapeItem) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onUploadClick: () => void;
}

// 35个形状完整定义
const SHAPE_CATEGORIES = [
  {
    id: 'pen',
    name: '画笔',
    icon: '✏️',
    shapes: [
      { id: 'freepen', name: '自由画笔', type: 'freepen' as ShapeType, icon: '✏️' },
    ]
  },
  {
    id: 'basic',
    name: '基础形状',
    icon: '⬜',
    shapes: [
      { id: 'circle', name: '圆形', type: 'circle' as ShapeType, icon: '○' },
      { id: 'rectangle', name: '矩形', type: 'rectangle' as ShapeType, icon: '□' },
      { id: 'roundRect', name: '圆角矩形', type: 'roundRect' as ShapeType, icon: '▭' },
      { id: 'diamond', name: '菱形', type: 'diamond' as ShapeType, icon: '◇' },
      { id: 'triangleUp', name: '三角形↑', type: 'triangleUp' as ShapeType, icon: '△' },
      { id: 'triangleDown', name: '三角形↓', type: 'triangleDown' as ShapeType, icon: '▽' },
      { id: 'triangleLeft', name: '三角形←', type: 'triangleLeft' as ShapeType, icon: '◁' },
      { id: 'triangleRight', name: '三角形→', type: 'triangleRight' as ShapeType, icon: '▷' },
      { id: 'hexagon', name: '六边形', type: 'hexagon' as ShapeType, icon: '⬡' },
      { id: 'star', name: '五角星', type: 'star' as ShapeType, icon: '★' },
    ]
  },
  {
    id: 'lines',
    name: '线条',
    icon: '—',
    shapes: [
      { id: 'line', name: '直线', type: 'line' as ShapeType, icon: '—' },
      { id: 'vertical', name: '垂直线', type: 'vertical' as ShapeType, icon: '|' },
      { id: 'horizontal', name: '水平线', type: 'horizontal' as ShapeType, icon: '—' },
      { id: 'diagonal45', name: '45°线↗', type: 'diagonal45' as ShapeType, icon: '⟋' },
      { id: 'diagonal135', name: '45°线↘', type: 'diagonal135' as ShapeType, icon: '⟍' },
      { id: 'parallel', name: '平行线', type: 'parallel' as ShapeType, icon: '≡' },
      { id: 'lShape', name: 'L型线', type: 'lShape' as ShapeType, icon: '⌐' },
      { id: 'zShape', name: 'Z型线', type: 'zShape' as ShapeType, icon: '⌐¬' },
      { id: 'arrowBoth', name: '双向箭头', type: 'arrowBoth' as ShapeType, icon: '↔' },
      { id: 'arrowRight', name: '箭头→', type: 'arrowRight' as ShapeType, icon: '→' },
      { id: 'arrowLeft', name: '箭头←', type: 'arrowLeft' as ShapeType, icon: '←' },
      { id: 'arrowUp', name: '箭头↑', type: 'arrowUp' as ShapeType, icon: '↑' },
      { id: 'arrowDown', name: '箭头↓', type: 'arrowDown' as ShapeType, icon: '↓' },
    ]
  },
  {
    id: 'annotations',
    name: '标注',
    icon: '💬',
    shapes: [
      { id: 'cloud', name: '云形标注', type: 'cloud' as ShapeType, icon: '☁' },
      { id: 'speech', name: '对话框', type: 'speech' as ShapeType, icon: '💬' },
      { id: 'thought', name: '思考泡泡', type: 'thought' as ShapeType, icon: '💭' },
      { id: 'dashedBox', name: '虚线框', type: 'dashedBox' as ShapeType, icon: '⬜' },
      { id: 'bracket', name: '括号', type: 'bracket' as ShapeType, icon: '[ ]' },
      { id: 'bookQuote', name: '书名号', type: 'bookQuote' as ShapeType, icon: '〖〗' },
    ]
  },
  {
    id: 'math',
    name: '数学/专业',
    icon: '∠',
    shapes: [
      { id: 'angle', name: '角度', type: 'angle' as ShapeType, icon: '∠' },
      { id: 'perpendicular', name: '垂直', type: 'perpendicular' as ShapeType, icon: '⊥' },
      { id: 'parallelSymbol', name: '平行', type: 'parallelSymbol' as ShapeType, icon: '∥' },
      { id: 'arc', name: '弧线', type: 'arc' as ShapeType, icon: '⌒' },
      { id: 'circlePlus', name: '圆加', type: 'circlePlus' as ShapeType, icon: '⊕' },
      { id: 'circleCross', name: '圆叉', type: 'circleCross' as ShapeType, icon: '⊗' },
    ]
  }
];

// 获取所有形状的扁平列表
export const getAllShapes = (): ShapeItem[] => {
  return SHAPE_CATEGORIES.flatMap(category =>
    category.shapes.map(shape => ({
      ...shape,
      category: category.id
    }))
  );
};

// 根据ID获取形状
export const getShapeById = (id: string): ShapeItem | undefined => {
  return getAllShapes().find(shape => shape.id === id);
};

export const ShapeSymbolPicker: React.FC<ShapeSymbolPickerProps> = ({
  isVisible,
  selectedShape,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onUploadClick
}) => {
  return (
    <div 
      className="relative"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* 形状按钮 */}
      <button
        className="p-2 rounded transition bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center gap-1"
        title="形状工具"
      >
        {selectedShape ? (
          <span className="text-lg">{selectedShape.icon}</span>
        ) : (
          <span className="text-lg">□</span>
        )}
        <ChevronDown size={14} />
      </button>

      {/* 悬停展开的形状面板 */}
      {isVisible && (
        <div 
          className="absolute bottom-full left-0 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-3 z-50 w-[380px] max-h-[450px] overflow-y-auto"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {SHAPE_CATEGORIES.map(category => (
            <div key={category.id} className="mb-3 last:mb-0">
              {/* 分类标题 */}
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-sm">{category.icon}</span>
                <h4 className="text-white text-xs font-medium">{category.name}</h4>
              </div>
              
              {/* 形状网格 */}
              <div className="grid grid-cols-10 gap-1">
                {category.shapes.map(shape => (
                  <button
                    key={shape.id}
                    onClick={() => onSelect({ ...shape, category: category.id })}
                    className={`aspect-square flex items-center justify-center rounded text-base transition cursor-pointer ${
                      selectedShape?.id === shape.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    title={shape.name}
                  >
                    {shape.icon}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* 上传按钮 */}
          <div className="pt-2 border-t border-gray-700 mt-2">
            <button
              onClick={onUploadClick}
              className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              自定义形状（开发中）
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
