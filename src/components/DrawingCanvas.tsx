import React, { useRef, useState, useEffect } from 'react';
import { Pencil, Eraser, ArrowRight, Circle, Square, Undo, Redo, Trash2, Save, X, MousePointer, Minus, Highlighter, Check, XIcon, Camera, Clock, Type } from 'lucide-react';
import type { DrawingTool, DrawingElement, Point, DrawingStroke, ShapeAnnotation, TextAnnotation, DrawingData } from '../types/annotation';
import { NameInputDialog } from './NameInputDialog';
import { downloadVideoSegment, extractTextFromDrawingData } from '../utils/videoSegmentDownload';
import { getVideoSegmentSettings, saveVideoSegment } from '../utils/database';

interface DrawingCanvasProps {
  videoElement: HTMLVideoElement;
  onSave: (drawingData: DrawingData, thumbnail: string, name: string, saveType?: 'annotation' | 'screenshot' | 'video-segment' | 'timestamp') => void;
  onClose: () => void;
  videoUrl: string;
  videoName: string;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ videoElement, onSave, onClose, videoUrl, videoName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<DrawingTool>('pen');
  const [color, setColor] = useState('#FF0000');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [history, setHistory] = useState<DrawingElement[][]>([[]]);
  const [historyStep, setHistoryStep] = useState(0);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<Point | null>(null);
  const [isSavingSegment, setIsSavingSegment] = useState(false);
  const [fontSize, setFontSize] = useState(24);
  const [isTextInputMode, setIsTextInputMode] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState<Point | null>(null);
  const [textInputValue, setTextInputValue] = useState('');
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<{ drawingData: DrawingData; thumbnail: string; saveType: 'annotation' | 'screenshot' | 'video-segment' | 'timestamp' } | null>(null);

  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'];

  useEffect(() => {
    if (isTextInputMode && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  }, [isTextInputMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use video's natural dimensions
    const width = videoElement.videoWidth || videoElement.offsetWidth;
    const height = videoElement.videoHeight || videoElement.offsetHeight;

    canvas.width = width;
    canvas.height = height;

    drawVideoFrame();
    redrawCanvas();
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [elements, currentStroke, shapeStart, selectedElementIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementIndex !== null && tool === 'select') {
        const newElements = elements.filter((_, index) => index !== selectedElementIndex);
        setElements(newElements);
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newElements);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        setSelectedElementIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIndex, elements, tool, history, historyStep]);

  const drawVideoFrame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  };

  const drawSelectionBox = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = '#00FFFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    if ('points' in element && element.points.length > 0) {
      const minX = Math.min(...element.points.map(p => p.x));
      const maxX = Math.max(...element.points.map(p => p.x));
      const minY = Math.min(...element.points.map(p => p.y));
      const maxY = Math.max(...element.points.map(p => p.y));
      ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
    } else if (element.tool === 'text') {
      const textElement = element as TextAnnotation;
      const textWidth = textElement.text.length * textElement.fontSize * 0.6;
      ctx.strokeRect(textElement.position.x - 5, textElement.position.y - textElement.fontSize - 5,
                     textWidth + 10, textElement.fontSize + 10);
    } else {
      const shapeElement = element as ShapeAnnotation;
      const minX = Math.min(shapeElement.start.x, shapeElement.end.x);
      const maxX = Math.max(shapeElement.start.x, shapeElement.end.x);
      const minY = Math.min(shapeElement.start.y, shapeElement.end.y);
      const maxY = Math.max(shapeElement.start.y, shapeElement.end.y);
      ctx.strokeRect(minX - 5, minY - 5, maxX - minX + 10, maxY - minY + 10);
    }

    ctx.setLineDash([]);
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawVideoFrame();

    elements.forEach((element, index) => {
      if ('points' in element) {
        drawStroke(ctx, element);
      } else if (element.tool === 'text') {
        drawText(ctx, element);
      } else {
        drawShape(ctx, element);
      }

      if (tool === 'select' && index === selectedElementIndex) {
        drawSelectionBox(ctx, element);
      }
    });

    if (currentStroke.length > 0 && (tool === 'pen' || tool === 'eraser' || tool === 'highlighter')) {
      const tempStroke: DrawingStroke = {
        tool,
        points: currentStroke,
        color: tool === 'eraser' ? '#FFFFFF' : color,
        lineWidth: tool === 'eraser' ? lineWidth * 2 : (tool === 'highlighter' ? lineWidth * 3 : lineWidth),
        opacity: tool === 'highlighter' ? 0.4 : 1
      };
      drawStroke(ctx, tempStroke);
    }

    if (shapeStart && (tool === 'line' || tool === 'arrow' || tool === 'circle' || tool === 'rectangle' || tool === 'checkmark' || tool === 'cross' || tool === 'number1' || tool === 'number2' || tool === 'number3')) {
      const lastPoint = currentStroke[currentStroke.length - 1];
      if (lastPoint) {
        const tempShape: ShapeAnnotation = {
          tool: tool as 'line' | 'arrow' | 'circle' | 'rectangle' | 'checkmark' | 'cross' | 'number1' | 'number2' | 'number3',
          start: shapeStart,
          end: lastPoint,
          color,
          lineWidth
        };
        drawShape(ctx, tempShape);
      }
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: DrawingStroke) => {
    if (stroke.points.length < 2) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = stroke.opacity;
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: ShapeAnnotation) => {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { start, end } = shape;

    if (shape.tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (shape.tool === 'arrow') {
      const headLength = 15;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle - Math.PI / 6),
        end.y - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(
        end.x - headLength * Math.cos(angle + Math.PI / 6),
        end.y - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    } else if (shape.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.beginPath();
      ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.tool === 'rectangle') {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (shape.tool === 'checkmark') {
      const size = Math.abs(end.x - start.x);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y + size * 0.5);
      ctx.lineTo(start.x + size * 0.3, start.y + size * 0.8);
      ctx.lineTo(start.x + size, start.y);
      ctx.stroke();
    } else if (shape.tool === 'cross') {
      const size = Math.abs(end.x - start.x);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(start.x + size, start.y + size);
      ctx.moveTo(start.x + size, start.y);
      ctx.lineTo(start.x, start.y + size);
      ctx.stroke();
    } else if (shape.tool === 'number1' || shape.tool === 'number2' || shape.tool === 'number3') {
      const size = Math.abs(end.x - start.x);
      const radius = size / 2;
      const centerX = start.x + radius;
      const centerY = start.y + radius;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      const number = shape.tool === 'number1' ? '1' : shape.tool === 'number2' ? '2' : '3';
      ctx.fillStyle = shape.color;
      ctx.font = `bold ${radius * 1.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number, centerX, centerY);
    }
  };

  const drawText = (ctx: CanvasRenderingContext2D, textAnnotation: TextAnnotation) => {
    ctx.fillStyle = textAnnotation.color;
    ctx.font = `${textAnnotation.fontSize}px Arial`;
    ctx.fillText(textAnnotation.text, textAnnotation.position.x, textAnnotation.position.y);
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const isPointNearElement = (point: Point, element: DrawingElement, threshold = 20): boolean => {
    if ('points' in element) {
      return element.points.some(p =>
        Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < threshold
      );
    } else if (element.tool === 'text') {
      const textElement = element as TextAnnotation;
      const textWidth = textElement.text.length * textElement.fontSize * 0.6;
      return point.x >= textElement.position.x - threshold &&
             point.x <= textElement.position.x + textWidth + threshold &&
             point.y >= textElement.position.y - textElement.fontSize - threshold &&
             point.y <= textElement.position.y + threshold;
    } else {
      const shapeElement = element as ShapeAnnotation;
      const minX = Math.min(shapeElement.start.x, shapeElement.end.x) - threshold;
      const maxX = Math.max(shapeElement.start.x, shapeElement.end.x) + threshold;
      const minY = Math.min(shapeElement.start.y, shapeElement.end.y) - threshold;
      const maxY = Math.max(shapeElement.start.y, shapeElement.end.y) + threshold;
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }
  };

  const getElementCenter = (element: DrawingElement): Point => {
    if ('points' in element && element.points.length > 0) {
      const sumX = element.points.reduce((sum, p) => sum + p.x, 0);
      const sumY = element.points.reduce((sum, p) => sum + p.y, 0);
      return { x: sumX / element.points.length, y: sumY / element.points.length };
    } else if (element.tool === 'text') {
      const textElement = element as TextAnnotation;
      return textElement.position;
    } else {
      const shapeElement = element as ShapeAnnotation;
      return {
        x: (shapeElement.start.x + shapeElement.end.x) / 2,
        y: (shapeElement.start.y + shapeElement.end.y) / 2
      };
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);

    if (tool === 'text') {
      setTextInputPosition(pos);
      setIsTextInputMode(true);
      return;
    }

    if (tool === 'select') {
      for (let i = elements.length - 1; i >= 0; i--) {
        if (isPointNearElement(pos, elements[i])) {
          setSelectedElementIndex(i);
          const center = getElementCenter(elements[i]);
          setDragOffset({ x: pos.x - center.x, y: pos.y - center.y });
          setIsDrawing(true);
          return;
        }
      }
      setSelectedElementIndex(null);
      return;
    }

    setIsDrawing(true);

    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
      setCurrentStroke([pos]);
    } else if (tool === 'line' || tool === 'arrow' || tool === 'circle' || tool === 'rectangle' || tool === 'checkmark' || tool === 'cross' || tool === 'number1' || tool === 'number2' || tool === 'number3') {
      setShapeStart(pos);
      setCurrentStroke([pos]);
    }
  };

  const moveElement = (element: DrawingElement, offset: Point): DrawingElement => {
    if ('points' in element) {
      return {
        ...element,
        points: element.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }))
      };
    } else if (element.tool === 'text') {
      const textElement = element as TextAnnotation;
      return {
        ...textElement,
        position: { x: textElement.position.x + offset.x, y: textElement.position.y + offset.y }
      };
    } else {
      const shapeElement = element as ShapeAnnotation;
      return {
        ...shapeElement,
        start: { x: shapeElement.start.x + offset.x, y: shapeElement.start.y + offset.y },
        end: { x: shapeElement.end.x + offset.x, y: shapeElement.end.y + offset.y }
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);

    if (tool === 'select' && selectedElementIndex !== null && dragOffset) {
      const oldCenter = getElementCenter(elements[selectedElementIndex]);
      const newCenter = { x: pos.x - dragOffset.x, y: pos.y - dragOffset.y };
      const offset = { x: newCenter.x - oldCenter.x, y: newCenter.y - oldCenter.y };

      const newElements = [...elements];
      newElements[selectedElementIndex] = moveElement(elements[selectedElementIndex], offset);
      setElements(newElements);
      return;
    }

    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
      setCurrentStroke(prev => [...prev, pos]);
    } else if (tool === 'line' || tool === 'arrow' || tool === 'circle' || tool === 'rectangle' || tool === 'checkmark' || tool === 'cross' || tool === 'number1' || tool === 'number2' || tool === 'number3') {
      setCurrentStroke([pos]);
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);

    if (tool === 'select' && selectedElementIndex !== null) {
      const newHistory = history.slice(0, historyStep + 1);
      newHistory.push([...elements]);
      setHistory(newHistory);
      setHistoryStep(newHistory.length - 1);
      setDragOffset(null);
      return;
    }

    if (tool === 'pen' || tool === 'eraser' || tool === 'highlighter') {
      if (currentStroke.length > 1) {
        const newStroke: DrawingStroke = {
          tool,
          points: currentStroke,
          color: tool === 'eraser' ? '#FFFFFF' : color,
          lineWidth: tool === 'eraser' ? lineWidth * 2 : (tool === 'highlighter' ? lineWidth * 3 : lineWidth),
          opacity: tool === 'highlighter' ? 0.4 : 1
        };
        addElement(newStroke);
      }
    } else if ((tool === 'line' || tool === 'arrow' || tool === 'circle' || tool === 'rectangle' || tool === 'checkmark' || tool === 'cross' || tool === 'number1' || tool === 'number2' || tool === 'number3') && shapeStart) {
      const endPoint = currentStroke[currentStroke.length - 1];
      if (endPoint) {
        const newShape: ShapeAnnotation = {
          tool: tool as 'line' | 'arrow' | 'circle' | 'rectangle' | 'checkmark' | 'cross' | 'number1' | 'number2' | 'number3',
          start: shapeStart,
          end: endPoint,
          color,
          lineWidth
        };
        addElement(newShape);
      }
    }

    setCurrentStroke([]);
    setShapeStart(null);
  };

  const addElement = (element: DrawingElement) => {
    const newElements = [...elements, element];
    setElements(newElements);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };


  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      setElements(history[historyStep - 1]);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      setElements(history[historyStep + 1]);
    }
  };

  const clear = () => {
    setElements([]);
    setHistory([[]]);
    setHistoryStep(0);
  };

  const handleTextInputSubmit = () => {
    if (textInputValue.trim() && textInputPosition) {
      const newText: TextAnnotation = {
        tool: 'text',
        text: textInputValue,
        position: textInputPosition,
        color,
        fontSize
      };
      addElement(newText);
      setTextInputValue('');
      setTextInputPosition(null);
      setIsTextInputMode(false);
    }
  };

  const handleTextInputCancel = () => {
    setTextInputValue('');
    setTextInputPosition(null);
    setIsTextInputMode(false);
  };

  const handleSave = (saveType: 'annotation' | 'screenshot' | 'video-segment' | 'timestamp' = 'annotation') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawingData: DrawingData = {
      elements,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };

    const thumbnail = canvas.toDataURL('image/png');

    setPendingSaveData({ drawingData, thumbnail, saveType });
    setIsNameDialogOpen(true);
  };

  const handleNameSubmit = (name: string) => {
    if (pendingSaveData) {
      onSave(pendingSaveData.drawingData, pendingSaveData.thumbnail, name, pendingSaveData.saveType);
      setPendingSaveData(null);
    }
    setIsNameDialogOpen(false);
  };

  const handleScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `screenshot-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleSaveTimestamp = async () => {
    if (isSavingSegment) return;

    setIsSavingSegment(true);

    try {
      const currentTime = videoElement.currentTime;
      const settings = await getVideoSegmentSettings();

      const startTime = Math.max(0, currentTime - settings.beforeBuffer);
      const endTime = Math.min(videoElement.duration, currentTime + settings.afterBuffer);

      const canvas = canvasRef.current;
      if (!canvas) {
        alert('无法获取画布');
        return;
      }

      const drawingData: DrawingData = {
        elements,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      };

      const thumbnail = canvas.toDataURL('image/png');
      const textContent = extractTextFromDrawingData(drawingData);

      const segmentData = {
        video_name: videoName,
        video_url: videoUrl,
        key_frame_time: currentTime,
        start_time: startTime,
        end_time: endTime,
        drawing_data: JSON.stringify(drawingData),
        text_content: textContent,
        thumbnail
      };

      const savedSegment = await saveVideoSegment(segmentData);

      if (savedSegment) {
        console.log('Video segment saved to database:', savedSegment);
      }

      const success = await downloadVideoSegment(
        videoElement,
        startTime,
        endTime,
        videoName
      );

      if (success) {
        alert(`视频片段已保存！\n时间范围：${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`);
      }
    } catch (error) {
      console.error('Error saving video segment:', error);
      alert('保存视频片段时出错');
    } finally {
      setIsSavingSegment(false);
    }
  };

  const tools: { tool: DrawingTool; icon: React.ReactNode; label: string; isText?: boolean }[] = [
    { tool: 'select', icon: <MousePointer size={16} />, label: '选择' },
    { tool: 'pen', icon: <Pencil size={16} />, label: '画笔' },
    { tool: 'eraser', icon: <Eraser size={16} />, label: '橡皮擦' },
    { tool: 'line', icon: <Minus size={16} />, label: '直线' },
    { tool: 'arrow', icon: <ArrowRight size={16} />, label: '箭头' },
    { tool: 'rectangle', icon: <Square size={16} />, label: '矩形' },
    { tool: 'circle', icon: <Circle size={16} />, label: '圆形' },
    { tool: 'highlighter', icon: <Highlighter size={16} />, label: '荧光笔' },
    { tool: 'text', icon: <Type size={16} />, label: '文字' },
    { tool: 'checkmark', icon: <Check size={16} />, label: '对勾' },
    { tool: 'cross', icon: <XIcon size={16} />, label: '错号' },
    { tool: 'number1', icon: '1', label: '重点1', isText: true },
    { tool: 'number2', icon: '2', label: '重点2', isText: true },
    { tool: 'number3', icon: '3', label: '重点3', isText: true }
  ];

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
        <h2 className="text-white text-xl font-semibold">视频涂鸦</h2>
        <button
          onClick={onClose}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        <div className="flex gap-2 bg-gray-800 p-3 rounded-lg overflow-y-auto h-full">
          <div className="flex flex-col gap-1.5">
            {tools.map(({ tool: t, icon, label, isText }) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                className={`w-8 h-8 p-1.5 rounded-lg transition flex items-center justify-center ${
                  tool === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
                title={label}
              >
                {isText ? (
                  <span className="font-bold text-sm">{icon}</span>
                ) : (
                  React.cloneElement(icon as React.ReactElement, { size: 16 })
                )}
              </button>
            ))}

            <div className="border-t border-gray-700 my-1"></div>

            <div className="grid grid-cols-2 gap-1.5">
              {colors.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded border transition ${
                    color === c ? 'border-white ring-1 ring-white' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="border-t border-gray-700 my-1"></div>

            <div className="flex flex-col gap-1">
              <label className="text-white text-xs text-center">粗细</label>
              <input
                type="range"
                min="1"
                max="10"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-white text-xs text-center">{lineWidth}</span>
            </div>

            {tool === 'text' && (
              <>
                <div className="border-t border-gray-700 my-1"></div>
                <div className="flex flex-col gap-1">
                  <label className="text-white text-xs text-center">字号</label>
                  <input
                    type="range"
                    min="12"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-white text-xs text-center">{fontSize}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              onClick={undo}
              disabled={historyStep === 0}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition"
              title="撤销"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Undo size={16} />
              </div>
            </button>
            <button
              onClick={redo}
              disabled={historyStep === history.length - 1}
              className="p-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition"
              title="重做"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Redo size={16} />
              </div>
            </button>
            <button
              onClick={clear}
              className="p-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-white transition"
              title="清除"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Trash2 size={16} />
              </div>
            </button>

            <div className="border-t border-gray-700 my-1"></div>

            <button
              onClick={() => handleSave('annotation')}
              className="p-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-white transition"
              title="保存标注"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Save size={16} />
              </div>
            </button>
            <button
              onClick={handleScreenshot}
              className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-white transition"
              title="保存截图"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Camera size={16} />
              </div>
            </button>
            <button
              onClick={handleSaveTimestamp}
              disabled={isSavingSegment}
              className="p-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="保存涂鸦视频片段（自动前后缓冲）"
            >
              <div className="w-5 h-5 flex items-center justify-center">
                <Clock size={16} />
              </div>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-900 rounded-lg">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`shadow-2xl ${tool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'}`}
            style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
          />
        </div>
      </div>

      <NameInputDialog
        isOpen={isNameDialogOpen}
        onClose={() => {
          setIsNameDialogOpen(false);
          setPendingSaveData(null);
        }}
        onSave={handleNameSubmit}
        defaultName={`涂鸦 @ ${new Date().toLocaleString()}`}
      />

      {isTextInputMode && textInputPosition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={handleTextInputCancel}>
          <div
            className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white text-lg font-semibold mb-4">输入文字</h3>
            <input
              ref={textInputRef}
              type="text"
              value={textInputValue}
              onChange={(e) => setTextInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTextInputSubmit();
                } else if (e.key === 'Escape') {
                  handleTextInputCancel();
                }
              }}
              placeholder="输入文字内容"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleTextInputCancel}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={handleTextInputSubmit}
                disabled={!textInputValue.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
