import React, { useRef, useEffect, useState } from 'react';
import { Paintbrush, Eraser, Trash2, Undo, Square } from 'lucide-react';

interface LiveDrawingOverlayProps {
  videoElement: HTMLVideoElement | null;
  isActive: boolean;
  onClose: () => void;
}

type DrawingTool = 'pen' | 'eraser';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  tool: DrawingTool;
  color: string;
  width: number;
  points: Point[];
}

export const LiveDrawingOverlay: React.FC<LiveDrawingOverlayProps> = ({
  videoElement,
  isActive,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<DrawingTool>('pen');
  const [penColor, setPenColor] = useState('#FF0000');
  const [penWidth, setPenWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

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
    setIsDrawing(true);
    const point = getCanvasCoordinates(e);
    setCurrentStroke([point]);
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

    if (currentStroke.length > 1) {
      const newStroke: Stroke = {
        tool: currentTool,
        color: penColor,
        width: penWidth,
        points: currentStroke
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

  if (!isActive) return null;

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'];

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
        </div>

        <div className="w-px h-6 bg-gray-600"></div>

        {/* 颜色选择 */}
        {currentTool === 'pen' && (
          <div className="flex gap-1">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => setPenColor(color)}
                className={`w-6 h-6 rounded border-2 transition ${
                  penColor === color ? 'border-white scale-110' : 'border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}

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

        {/* 关闭 */}
        <button
          onClick={onClose}
          className="p-2 rounded bg-red-600 text-white hover:bg-red-500 transition"
          title="关闭实时涂鸦"
        >
          <Square size={20} />
        </button>
      </div>
    </div>
  );
};
