import React, { useRef, useEffect, useState } from 'react';
import { Paintbrush, Eraser, Trash2, Undo, Square, Save, Type } from 'lucide-react';
import { CompactSymbolPicker } from './CompactSymbolPicker';
import { ColorPicker } from './ColorPicker';
import { ShapeSymbolPicker } from './ShapeSymbolPicker';
import { CustomSymbolManager } from './CustomSymbolManager';
import type { SymbolItem } from '../constants/symbols';
import type { ShapeType } from './ShapeSymbolPicker';

interface ShapeItem {
  id: string;
  name: string;
  type: ShapeType;
  icon: string;
  category: string;
}


interface LiveDrawingOverlayProps {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  onClose: () => void;
  onSave?: (data: {
    strokes: Stroke[];
    startTimestamp: number;
    duration: number;
    thumbnail: string;
    name: string;  // 添加名称字段
  }) => void;
}

type DrawingTool = 'pen' | 'eraser' | 'symbol' | 'text' | 'shape';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: DrawingTool;
  color: string;
  width: number;
  points: Point[];
  startTime: number;  // 相对时间（秒）
  endTime: number;
  // 符号相关（当tool='symbol'时使用）
  symbolId?: string;
  symbolChar?: string;
  symbolSize?: number;
  symbolRotation?: number;
  // 文字相关（当tool='text'时使用）
  text?: string;
  fontSize?: number;
  // 形状相关（当tool='shape'时使用）
  shapeType?: ShapeType;
  filled?: boolean;
}

export const LiveDrawingOverlay: React.FC<LiveDrawingOverlayProps> = ({
  videoElement,
  isActive,
  onClose,
  onSave
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [penColor, setPenColor] = useState('#FF0000');
  const [penWidth, setPenWidth] = useState(3);
  const [showSymbolPanel, setShowSymbolPanel] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolItem | null>(null);
  const [symbolSize, setSymbolSize] = useState(3); // 1-5档，默认3
  const [symbolRotation, setSymbolRotation] = useState(0); // 0-315度，45度一档
  const [showShapePanel, setShowShapePanel] = useState(false);
  const [selectedShape, setSelectedShape] = useState<ShapeItem | null>(null);
  const [showCustomSymbolManager, setShowCustomSymbolManager] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [currentStrokeStartTime, setCurrentStrokeStartTime] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [inputName, setInputName] = useState('');

  // 初始化开始时间
  useEffect(() => {
    if (isActive && videoElement) {
      setStartTimestamp(videoElement.currentTime);
    }
  }, [isActive, videoElement]);

  // 初始化canvas
  useEffect(() => {
    if (!canvasRef.current || !videoElement || !isActive) return;

    const canvas = canvasRef.current;
    const video = videoElement;

    // 设置canvas尺寸匹配视频
    const updateCanvasSize = () => {
      canvas.width = video.offsetWidth;
      canvas.height = video.offsetHeight;
      redrawAll();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [videoElement, isActive]);

  // 重绘所有笔画
  const redrawAll = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
      // 文字类型：使用drawText绘制
      if (stroke.tool === 'text') {
        drawText(ctx, stroke);
        return;
      }
      
      // 符号类型：使用drawSymbol绘制
      if (stroke.tool === 'symbol') {
        drawSymbol(ctx, stroke);
        return;
      }
      
      // 画笔/橡皮擦类型：绘制路径
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'source-over';
  };

  // 获取鼠标在canvas上的坐标
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e);
    
    // 文字工具：点击输入文字
    if (currentTool === 'text') {
      if (!videoElement) return;
      
      const text = prompt('请输入文字：');
      if (!text || text.trim() === '') return;
      
      const textStroke: Stroke = {
        tool: 'text',
        color: penColor,
        width: penWidth,
        points: [point],
        startTime: videoElement.currentTime - startTimestamp,
        endTime: videoElement.currentTime - startTimestamp,
        text: text.trim(),
        fontSize: 24 // 默认字体大小
      };
      
      setStrokes(prev => [...prev, textStroke]);
      
      // 立即绘制文字
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        drawText(ctx, textStroke);
      }
      return;
    }
    
    // 符号工具：点击放置符号
    if (currentTool === 'symbol') {
      if (!selectedSymbol || !videoElement) return;
      
      const symbolStroke: Stroke = {
        tool: 'symbol',
        color: penColor,
        width: penWidth,
        points: [point],
        startTime: videoElement.currentTime - startTimestamp,
        endTime: videoElement.currentTime - startTimestamp,
        symbolId: selectedSymbol.id,
        symbolChar: selectedSymbol.char,
        symbolSize: [20, 30, 40, 50, 60][symbolSize - 1], // 5档大小
        symbolRotation: symbolRotation // 旋转角度
      };
      
      setStrokes(prev => [...prev, symbolStroke]);
      
      // 立即绘制符号
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        drawSymbol(ctx, symbolStroke);
      }
      return;
    }
    
    // 画笔/橡皮擦：开始绘制
    setIsDrawing(true);
    setCurrentStroke([point]);
    
    // 记录笔画开始时间（相对于标注开始时间）
    if (videoElement) {
      setCurrentStrokeStartTime(videoElement.currentTime - startTimestamp);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const point = getCanvasCoordinates(e);
    const newStroke = [...currentStroke, point];
    setCurrentStroke(newStroke);

    // 实时绘制当前笔画
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (currentStroke.length > 0) {
      ctx.moveTo(currentStroke[currentStroke.length - 1].x, currentStroke[currentStroke.length - 1].y);
    }
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (currentStroke.length > 1 && videoElement) {
      const endTime = videoElement.currentTime - startTimestamp;
      
      const newStroke: Stroke = {
        tool: currentTool,
        color: penColor,
        width: penWidth,
        points: currentStroke,
        startTime: currentStrokeStartTime,
        endTime: endTime
      };

      setStrokes([...strokes, newStroke]);
    }

    setCurrentStroke([]);
  };

  const handleClear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSymbolSelect = (symbol: SymbolItem) => {
    setCurrentTool('symbol');
    setSelectedSymbol(symbol);
    // 不关闭面板，允许连续选择
  };

  const handleShapeSelect = (shape: ShapeItem) => {
    setCurrentTool('shape');
    setSelectedShape(shape);
    // 不关闭面板，允许连续选择
  };

  const drawSymbol = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.symbolChar || stroke.points.length === 0) return;
    
    ctx.save();
    ctx.translate(stroke.points[0].x, stroke.points[0].y);
    if (stroke.symbolRotation) {
      ctx.rotate((stroke.symbolRotation * Math.PI) / 180);
    }
    ctx.font = `${stroke.symbolSize || 40}px Arial`;
    ctx.fillStyle = stroke.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stroke.symbolChar, 0, 0);
    ctx.restore();
  };

  const drawText = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (!stroke.text || stroke.points.length === 0) return;
    
    ctx.save();
    ctx.font = `${stroke.fontSize || 24}px Arial`;
    ctx.fillStyle = stroke.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(stroke.text, stroke.points[0].x, stroke.points[0].y);
    ctx.restore();
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;

    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);

    // 重绘
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    newStrokes.forEach(stroke => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'source-over';
  };

  // 生成缩略图
  const generateThumbnail = (): string => {
    if (!canvasRef.current || !videoElement) return '';

    // 创建临时canvas合成视频帧+涂鸦
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoElement.videoWidth || 1280;
    tempCanvas.height = videoElement.videoHeight || 720;
    const ctx = tempCanvas.getContext('2d');
    
    if (!ctx) return '';

    // 绘制当前视频帧
    ctx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // 绘制涂鸦层
    const canvas = canvasRef.current;
    ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // 转为base64
    return tempCanvas.toDataURL('image/jpeg', 0.8);
  };

  // 保存标注
  const handleSave = () => {
    if (isSaving) return;
    
    if (strokes.length === 0) {
      alert('还没有涂鸦内容');
      return;
    }

    if (!videoElement) return;

    // 设置默认名称并显示对话框
    const defaultName = `实时涂鸦 ${new Date().toLocaleTimeString()}`;
    setInputName(defaultName);
    setShowNameDialog(true);
  };

  const handleConfirmSave = () => {
    if (!videoElement) return;

    const finalName = inputName.trim() || `实时涂鸦 ${new Date().toLocaleTimeString()}`;
    
    setIsSaving(true);
    setShowNameDialog(false);

    const duration = videoElement.currentTime - startTimestamp;
    const thumbnail = generateThumbnail();

    onSave?.({
      strokes,
      startTimestamp,
      duration,
      thumbnail,
      name: finalName
    });

    // 保存后清空并关闭
    handleClear();
    onClose();
    setIsSaving(false);
  };

  const handleCancelSave = () => {
    setShowNameDialog(false);
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-30">
      {/* 绘图画布 */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={(e) => {
          if (currentTool === 'symbol') {
            e.preventDefault();
            if (e.shiftKey) {
              // Shift + 滚轮：旋转
              const newRotation = symbolRotation + (e.deltaY > 0 ? 45 : -45);
              setSymbolRotation((newRotation + 360) % 360);
            } else {
              // 单独滚轮：大小
              const newSize = symbolSize + (e.deltaY > 0 ? -1 : 1);
              if (newSize >= 1 && newSize <= 5) {
                setSymbolSize(newSize);
              }
            }
          }
        }}
      />

      {/* 工具栏 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-900 bg-opacity-90 rounded-lg shadow-2xl border border-gray-700 p-3 flex items-center gap-4">
        {/* 画笔/橡皮擦 */}
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentTool('pen')}
            className={`p-2 rounded transition ${
              currentTool === 'pen' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="画笔"
          >
            <Paintbrush size={20} />
          </button>
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded transition ${
              currentTool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="橡皮擦"
          >
            <Eraser size={20} />
          </button>
          
          {/* 文字工具 */}
          <button
            onClick={() => setCurrentTool('text')}
            className={`p-2 rounded transition ${
              currentTool === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="文字工具"
          >
            <Type size={20} />
          </button>
          
          {/* 符号工具 - 悬停展开 */}
          <CompactSymbolPicker
            isVisible={showSymbolPanel}
            selectedSymbol={selectedSymbol}
            onSelect={handleSymbolSelect}
            onMouseEnter={() => setShowSymbolPanel(true)}
            onMouseLeave={() => setShowSymbolPanel(false)}
          />
          
          {/* 形状工具 - 悬停展开 */}
          <ShapeSymbolPicker
            isVisible={showShapePanel}
            selectedShape={selectedShape}
            onSelect={handleShapeSelect}
            onMouseEnter={() => setShowShapePanel(true)}
            onMouseLeave={() => setShowShapePanel(false)}
            onUploadClick={() => setShowCustomSymbolManager(true)}
          />
        </div>

        <div className="w-px h-6 bg-gray-600"></div>

        {/* 颜色选择 - 所有工具共用 */}
        <ColorPicker
          selectedColor={penColor}
          onColorChange={setPenColor}
        />

        <div className="w-px h-6 bg-gray-600"></div>

        {/* 粗细调整 */}
        {currentTool === 'pen' && (
          <div className="flex items-center gap-2">
            <span className="text-white text-xs">粗细</span>
            <input
              type="range"
              min="1"
              max="20"
              value={penWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-white text-xs w-6">{penWidth}</span>
          </div>
        )}

        <div className="w-px h-6 bg-gray-600"></div>

        {/* 撤销/清除 */}
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="撤销"
          >
            <Undo size={20} />
          </button>
          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="p-2 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            title="清除全部"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-600"></div>

        {/* 保存标注 */}
        <button
          onClick={handleSave}
          disabled={strokes.length === 0 || isSaving}
          className="p-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          title="保存标注"
        >
          <Save size={20} />
        </button>

        {/* 符号工具状态提示 */}
        {currentTool === 'symbol' && selectedSymbol && (
          <div className="px-3 py-1 bg-blue-600 rounded text-white text-xs">
            大小: {symbolSize}/5 | 旋转: {symbolRotation}°
          </div>
        )}

        {/* 关闭 */}
        <button
          onClick={onClose}
          className="p-2 rounded bg-red-600 text-white hover:bg-red-500 transition"
          title="关闭实时涂鸦"
        >
          <Square size={20} />
        </button>
      </div>

      {/* 命名对话框（内联） */}
      {showNameDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm"
            onClick={handleCancelSave}
          />
          
          {/* 对话框 */}
          <div className="relative bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-md mx-4 animate-[fadeIn_0.2s_ease-out]">
            {/* 标题 */}
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">保存实时涂鸦</h3>
            </div>
            
            {/* 内容 */}
            <div className="px-6 py-4">
              <p className="text-gray-300 mb-4">请为这个涂鸦起一个名称：</p>
              
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmSave();
                  if (e.key === 'Escape') handleCancelSave();
                }}
                placeholder="输入涂鸦名称"
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoFocus
              />
            </div>
            
            {/* 按钮 */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={handleCancelSave}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSave}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义符号管理器 */}
      <CustomSymbolManager
        isOpen={showCustomSymbolManager}
        onClose={() => setShowCustomSymbolManager(false)}
        onSelect={(symbol) => {
          // 使用自定义符号
          console.log('选择自定义符号:', symbol);
          setShowCustomSymbolManager(false);
        }}
      />
    </div>
  );
};
