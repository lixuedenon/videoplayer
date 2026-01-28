import React, { useRef, useEffect, useState } from 'react';
import { Paintbrush, Eraser, Trash2, Undo, Square, Save, Type, MousePointer } from 'lucide-react';
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

type DrawingTool = 'pen' | 'eraser' | 'symbol' | 'text' | 'shape' | 'select';

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
  rotation?: number;  // 旋转角度（度数，0-360）
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
  const [isShapeDrawing, setIsShapeDrawing] = useState(false);
  const [shapeStartPoint, setShapeStartPoint] = useState<Point | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [startTimestamp, setStartTimestamp] = useState<number>(0);
  const [currentStrokeStartTime, setCurrentStrokeStartTime] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [inputName, setInputName] = useState('');
  
  // 选择工具相关状态
  const [selectedStrokeIndex, setSelectedStrokeIndex] = useState<number | null>(null);
  const [isDraggingStroke, setIsDraggingStroke] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [activeControlPoint, setActiveControlPoint] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr', 'rotate'

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

  // 监听strokes变化，自动重绘
  useEffect(() => {
    if (isActive) {
      redrawAll();
    }
  }, [strokes, isActive, selectedStrokeIndex]);

  // 键盘事件：Delete删除选中
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive) return;
      
      if (e.key === 'Delete' && selectedStrokeIndex !== null) {
        const newStrokes = strokes.filter((_, index) => index !== selectedStrokeIndex);
        setStrokes(newStrokes);
        setSelectedStrokeIndex(null);
      } else if (e.key === 'Escape') {
        setSelectedStrokeIndex(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, selectedStrokeIndex, strokes]);

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
      
      // 形状类型：使用drawShape绘制
      if (stroke.tool === 'shape' && stroke.shapeType && stroke.points.length >= 2) {
        drawShape(ctx, stroke.shapeType, stroke.points[0], stroke.points[1], {
          color: stroke.color,
          width: stroke.width,
          filled: stroke.filled || false,
          rotation: stroke.rotation
        });
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
    
    // 选择工具：点击选中或操作控制点
    if (currentTool === 'select') {
      // 检查是否点击了控制点
      if (selectedStrokeIndex !== null) {
        const selectedStroke = strokes[selectedStrokeIndex];
        const controlPoint = getControlPointAtPosition(point, selectedStroke);
        
        if (controlPoint) {
          setActiveControlPoint(controlPoint);
          setDragStartPoint(point);
          return;
        }
      }
      
      // 检查是否点击了某个stroke
      for (let i = strokes.length - 1; i >= 0; i--) {
        if (isPointInStroke(point, strokes[i])) {
          setSelectedStrokeIndex(i);
          setIsDraggingStroke(true);
          setDragStartPoint(point);
          
          // 立即重绘以显示选中框
          setTimeout(() => {
            const canvas = canvasRef.current;
            if (canvas) {
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // 重绘所有strokes
                strokes.forEach(stroke => {
                  if (stroke.tool === 'text') {
                    drawText(ctx, stroke);
                  } else if (stroke.tool === 'symbol') {
                    drawSymbol(ctx, stroke);
                  } else if (stroke.tool === 'shape' && stroke.shapeType && stroke.points.length >= 2) {
                    drawShape(ctx, stroke.shapeType, stroke.points[0], stroke.points[1], {
                      color: stroke.color,
                      width: stroke.width,
                      filled: stroke.filled || false,
                      rotation: stroke.rotation
                    });
                  } else if (stroke.points.length >= 2) {
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.width;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    if (stroke.tool === 'eraser') {
                      ctx.globalCompositeOperation = 'destination-out';
                    }
                    ctx.beginPath();
                    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                    for (let j = 1; j < stroke.points.length; j++) {
                      ctx.lineTo(stroke.points[j].x, stroke.points[j].y);
                    }
                    ctx.stroke();
                    ctx.globalCompositeOperation = 'source-over';
                  }
                });
                
                // 绘制选中框
                drawSelectionBox(ctx, strokes[i]);
              }
            }
          }, 0);
          
          return;
        }
      }
      
      // 点击空白，取消选择
      setSelectedStrokeIndex(null);
      return;
    }
    
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
    
    // 形状工具：开始拖拽绘制
    if (currentTool === 'shape') {
      if (!selectedShape || !videoElement) return;
      setIsShapeDrawing(true);
      setShapeStartPoint(point);
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
    const point = getCanvasCoordinates(e);
    
    // 选择工具：拖拽移动或变换
    if (currentTool === 'select' && selectedStrokeIndex !== null && dragStartPoint) {
      const dx = point.x - dragStartPoint.x;
      const dy = point.y - dragStartPoint.y;
      
      const selectedStroke = strokes[selectedStrokeIndex];
      let previewStroke = { ...selectedStroke };
      
      if (activeControlPoint) {
        // 操作控制点：缩放/旋转
        if (activeControlPoint === 'rotate') {
          // 旋转逻辑
          if (previewStroke.tool === 'shape' && previewStroke.points.length >= 2) {
            const [p1, p2] = previewStroke.points;
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            
            // 计算旋转角度
            const angle = Math.atan2(point.y - centerY, point.x - centerX);
            const degrees = (angle * 180 / Math.PI + 90 + 360) % 360;
            previewStroke.rotation = degrees;
          }
        } else {
          // 缩放/拉伸
          if (previewStroke.tool === 'shape' && previewStroke.points.length >= 2) {
            const [p1, p2] = previewStroke.points;
            let left = Math.min(p1.x, p2.x), right = Math.max(p1.x, p2.x);
            let top = Math.min(p1.y, p2.y), bottom = Math.max(p1.y, p2.y);
            
            // 只保留右下角缩放
            if (activeControlPoint === 'br') {
              right += dx;
              bottom += dy;
            }
            
            previewStroke.points = [{ x: left, y: top }, { x: right, y: bottom }];
          } else if (previewStroke.tool === 'text' || previewStroke.tool === 'symbol') {
            // 文字/符号缩放：改变大小
            const scaleFactor = 1 + (dx + dy) / 100;
            if (previewStroke.tool === 'text') {
              previewStroke.fontSize = Math.max(12, (previewStroke.fontSize || 24) * scaleFactor);
            } else {
              previewStroke.symbolSize = Math.max(20, (previewStroke.symbolSize || 40) * scaleFactor);
            }
          }
        }
        
      } else if (isDraggingStroke) {
        // 移动整个stroke
        previewStroke.points = selectedStroke.points.map(p => ({
          x: p.x + dx,
          y: p.y + dy
        }));
      }
      
      // 实时绘制预览（不保存到strokes）
      redrawAll();
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 绘制预览的stroke
          if (previewStroke.tool === 'text') {
            drawText(ctx, previewStroke);
          } else if (previewStroke.tool === 'symbol') {
            drawSymbol(ctx, previewStroke);
          } else if (previewStroke.tool === 'shape' && previewStroke.shapeType && previewStroke.points.length >= 2) {
            drawShape(ctx, previewStroke.shapeType, previewStroke.points[0], previewStroke.points[1], {
              color: previewStroke.color,
              width: previewStroke.width,
              filled: previewStroke.filled || false,
              rotation: previewStroke.rotation
            });
          } else if (previewStroke.points.length >= 2) {
            ctx.strokeStyle = previewStroke.color;
            ctx.lineWidth = previewStroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(previewStroke.points[0].x, previewStroke.points[0].y);
            for (let i = 1; i < previewStroke.points.length; i++) {
              ctx.lineTo(previewStroke.points[i].x, previewStroke.points[i].y);
            }
            ctx.stroke();
          }
          
          // 重新绘制选中框在预览stroke上
          drawSelectionBox(ctx, previewStroke);
        }
      }
      
      return;
    }
    
    // 形状拖拽预览
    if (isShapeDrawing && shapeStartPoint && selectedShape) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // 重绘所有已有stroke
      redrawAll();
      
      // 绘制预览形状
      drawShape(ctx, selectedShape.type, shapeStartPoint, point, {
        color: penColor,
        width: penWidth,
        filled: false
      });
      return;
    }
    
    // 画笔/橡皮擦
    if (!isDrawing) return;

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

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getCanvasCoordinates(e);
    
    // 选择工具：结束拖拽并保存
    if (currentTool === 'select' && selectedStrokeIndex !== null && dragStartPoint) {
      const dx = point.x - dragStartPoint.x;
      const dy = point.y - dragStartPoint.y;
      
      const selectedStroke = strokes[selectedStrokeIndex];
      const newStroke = { ...selectedStroke };
      
      if (activeControlPoint) {
        if (activeControlPoint === 'rotate') {
          // 旋转完成，保存
          if (newStroke.tool === 'shape' && newStroke.points.length >= 2) {
            const [p1, p2] = newStroke.points;
            const centerX = (p1.x + p2.x) / 2;
            const centerY = (p1.y + p2.y) / 2;
            const angle = Math.atan2(point.y - centerY, point.x - centerX);
            const degrees = (angle * 180 / Math.PI + 90 + 360) % 360;
            newStroke.rotation = degrees;
          }
        } else if (activeControlPoint === 'br') {
          // 缩放完成，保存
          if (newStroke.tool === 'shape' && newStroke.points.length >= 2) {
            const [p1, p2] = newStroke.points;
            let left = Math.min(p1.x, p2.x), right = Math.max(p1.x, p2.x);
            let top = Math.min(p1.y, p2.y), bottom = Math.max(p1.y, p2.y);
            
            right += dx;
            bottom += dy;
            
            newStroke.points = [{ x: left, y: top }, { x: right, y: bottom }];
          } else if (newStroke.tool === 'text' || newStroke.tool === 'symbol') {
            // 文字/符号的缩放
            const scaleFactor = 1 + (dx + dy) / 100;
            if (newStroke.tool === 'text') {
              newStroke.fontSize = Math.max(12, (newStroke.fontSize || 24) * scaleFactor);
            } else {
              newStroke.symbolSize = Math.max(20, (newStroke.symbolSize || 40) * scaleFactor);
            }
          }
          
          const newStrokes = [...strokes];
          newStrokes[selectedStrokeIndex] = newStroke;
          setStrokes(newStrokes);
        }
        
      } else if (isDraggingStroke) {
        // 移动完成，保存
        newStroke.points = selectedStroke.points.map(p => ({
          x: p.x + dx,
          y: p.y + dy
        }));
        
        const newStrokes = [...strokes];
        newStrokes[selectedStrokeIndex] = newStroke;
        setStrokes(newStrokes);
      }
      
      setIsDraggingStroke(false);
      setActiveControlPoint(null);
      setDragStartPoint(null);
      
      // 松开后手动重绘以保持选中框显示
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 重绘所有strokes（使用最新的newStrokes）
        const latestStrokes = isDraggingStroke || activeControlPoint ? 
          (() => {
            const updated = [...strokes];
            updated[selectedStrokeIndex] = newStroke;
            return updated;
          })() : strokes;
          
        latestStrokes.forEach(stroke => {
          if (stroke.tool === 'text') {
            drawText(ctx, stroke);
          } else if (stroke.tool === 'symbol') {
            drawSymbol(ctx, stroke);
          } else if (stroke.tool === 'shape' && stroke.shapeType && stroke.points.length >= 2) {
            drawShape(ctx, stroke.shapeType, stroke.points[0], stroke.points[1], {
              color: stroke.color,
              width: stroke.width,
              filled: stroke.filled || false,
              rotation: stroke.rotation
            });
          } else if (stroke.points.length >= 2) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (stroke.tool === 'eraser') {
              ctx.globalCompositeOperation = 'destination-out';
            }
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let j = 1; j < stroke.points.length; j++) {
              ctx.lineTo(stroke.points[j].x, stroke.points[j].y);
            }
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
          }
        });
        
        // 重新绘制选中框
        if (selectedStrokeIndex !== null && selectedStrokeIndex < latestStrokes.length) {
          drawSelectionBox(ctx, latestStrokes[selectedStrokeIndex]);
        }
      }, 0);
      
      return;
    }
    
    // 形状拖拽完成
    if (isShapeDrawing && shapeStartPoint && selectedShape && videoElement) {
      const shapeStroke: Stroke = {
        tool: 'shape',
        color: penColor,
        width: penWidth,
        points: [shapeStartPoint, point],
        startTime: videoElement.currentTime - startTimestamp,
        endTime: videoElement.currentTime - startTimestamp,
        shapeType: selectedShape.type,
        filled: false
      };
      
      setStrokes(prev => [...prev, shapeStroke]);
      setIsShapeDrawing(false);
      setShapeStartPoint(null);
      
      // 注意：不要立即调用redrawCanvas，让useEffect处理
      return;
    }
    
    // 画笔/橡皮擦
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
    if (shape.type === 'freepen') {
      setCurrentTool('pen');
      setSelectedShape(null);
    } else {
      setCurrentTool('shape');
      setSelectedShape(shape);
    }
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

  const drawShape = (ctx: CanvasRenderingContext2D, shapeType: ShapeType, start: Point, end: Point, options: { color: string; width: number; filled: boolean; rotation?: number }) => {
    ctx.save();
    
    const width = end.x - start.x;
    const height = end.y - start.y;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    
    // 如果有旋转，应用旋转变换
    if (options.rotation) {
      ctx.translate(centerX, centerY);
      ctx.rotate(options.rotation * Math.PI / 180);
      ctx.translate(-centerX, -centerY);
    }
    
    ctx.strokeStyle = options.color;
    ctx.fillStyle = options.color;
    ctx.lineWidth = options.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    switch (shapeType) {
      // 基础形状
      case 'circle': {
        const radius = Math.sqrt(width * width + height * height) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'rectangle': {
        ctx.beginPath();
        ctx.rect(start.x, start.y, width, height);
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'roundRect': {
        const radius = Math.min(Math.abs(width), Math.abs(height)) / 5;
        ctx.beginPath();
        ctx.roundRect(start.x, start.y, width, height, radius);
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'diamond': {
        ctx.beginPath();
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(end.x, centerY);
        ctx.lineTo(centerX, end.y);
        ctx.lineTo(start.x, centerY);
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'triangleUp': {
        ctx.beginPath();
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.lineTo(end.x, end.y);
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'triangleDown': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, start.y);
        ctx.lineTo(centerX, end.y);
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'triangleLeft': {
        ctx.beginPath();
        ctx.moveTo(start.x, centerY);
        ctx.lineTo(end.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'triangleRight': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, centerY);
        ctx.lineTo(start.x, end.y);
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'hexagon': {
        const r = Math.min(Math.abs(width), Math.abs(height)) / 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      case 'star': {
        const outerR = Math.min(Math.abs(width), Math.abs(height)) / 2;
        const innerR = outerR * 0.4;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        options.filled ? ctx.fill() : ctx.stroke();
        break;
      }
      
      // 线条类
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }
      case 'vertical': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.stroke();
        break;
      }
      case 'horizontal': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, start.y);
        ctx.stroke();
        break;
      }
      case 'diagonal45': {
        const size = Math.max(Math.abs(width), Math.abs(height));
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + size, start.y + size);
        ctx.stroke();
        break;
      }
      case 'diagonal135': {
        const size = Math.max(Math.abs(width), Math.abs(height));
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + size, start.y - size);
        ctx.stroke();
        break;
      }
      case 'parallel': {
        const offset = Math.abs(height) / 3;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, start.y);
        ctx.moveTo(start.x, start.y + offset);
        ctx.lineTo(end.x, start.y + offset);
        ctx.moveTo(start.x, start.y + offset * 2);
        ctx.lineTo(end.x, start.y + offset * 2);
        ctx.stroke();
        break;
      }
      case 'lShape': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }
      case 'zShape': {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        break;
      }
      case 'arrowBoth':
      case 'arrowRight':
      case 'arrowLeft':
      case 'arrowUp':
      case 'arrowDown': {
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowLength = 15;
        
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        
        // 箭头
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - arrowLength * Math.cos(angle - Math.PI / 6), end.y - arrowLength * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - arrowLength * Math.cos(angle + Math.PI / 6), end.y - arrowLength * Math.sin(angle + Math.PI / 6));
        
        if (shapeType === 'arrowBoth') {
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(start.x + arrowLength * Math.cos(angle - Math.PI / 6), start.y + arrowLength * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(start.x + arrowLength * Math.cos(angle + Math.PI / 6), start.y + arrowLength * Math.sin(angle + Math.PI / 6));
        }
        ctx.stroke();
        break;
      }
      
      // 标注类
      case 'cloud': {
        // 云形：波浪边框
        const radius = Math.min(Math.abs(width), Math.abs(height)) / 8;
        const numArcs = 8;
        ctx.beginPath();
        for (let i = 0; i <= numArcs; i++) {
          const angle = (i / numArcs) * Math.PI * 2;
          const x = centerX + (Math.abs(width) / 2) * Math.cos(angle) + radius * Math.cos(angle * 3);
          const y = centerY + (Math.abs(height) / 2) * Math.sin(angle) + radius * Math.sin(angle * 3);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'speech': {
        // 对话框：圆角矩形 + 三角尾巴（左下）
        const radius = 10;
        const mainWidth = width * 0.9;
        const mainHeight = height * 0.8;
        ctx.beginPath();
        ctx.roundRect(start.x, start.y, mainWidth, mainHeight, radius);
        ctx.stroke();
        // 三角尾巴
        ctx.beginPath();
        ctx.moveTo(start.x + mainWidth * 0.2, start.y + mainHeight);
        ctx.lineTo(start.x + mainWidth * 0.1, end.y);
        ctx.lineTo(start.x + mainWidth * 0.35, start.y + mainHeight);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'thought': {
        // 思考泡：圆角矩形 + 三个小圆圈
        const radius = 10;
        const mainWidth = width * 0.9;
        const mainHeight = height * 0.75;
        ctx.beginPath();
        ctx.roundRect(start.x, start.y, mainWidth, mainHeight, radius);
        ctx.stroke();
        // 三个小圆圈（从大到小）
        const bubble1R = Math.abs(width) * 0.08;
        const bubble2R = Math.abs(width) * 0.05;
        const bubble3R = Math.abs(width) * 0.03;
        ctx.beginPath();
        ctx.arc(start.x + mainWidth * 0.15, start.y + mainHeight + bubble1R * 2, bubble1R, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(start.x + mainWidth * 0.08, start.y + mainHeight + bubble1R * 3.5, bubble2R, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(start.x + mainWidth * 0.03, end.y - bubble3R, bubble3R, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'dashedBox': {
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.rect(start.x, start.y, width, height);
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      }
      case 'bracket': {
        const w = Math.abs(width);
        const h = Math.abs(height);
        ctx.beginPath();
        ctx.moveTo(start.x + w * 0.2, start.y);
        ctx.lineTo(start.x, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.lineTo(start.x + w * 0.2, end.y);
        ctx.moveTo(start.x + w * 0.8, start.y);
        ctx.lineTo(end.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(start.x + w * 0.8, end.y);
        ctx.stroke();
        break;
      }
      case 'bookQuote': {
        ctx.font = `${Math.abs(height)}px Arial`;
        ctx.fillText('〖', start.x, start.y + Math.abs(height));
        ctx.fillText('〗', end.x - 20, start.y + Math.abs(height));
        break;
      }
      
      // 数学/专业
      case 'angle': {
        ctx.beginPath();
        ctx.moveTo(start.x, end.y);
        ctx.lineTo(start.x, start.y);
        ctx.lineTo(end.x, start.y);
        ctx.stroke();
        // 弧线
        const r = Math.min(Math.abs(width), Math.abs(height)) / 4;
        ctx.beginPath();
        ctx.arc(start.x, start.y, r, 0, Math.PI / 2);
        ctx.stroke();
        break;
      }
      case 'perpendicular': {
        ctx.beginPath();
        ctx.moveTo(centerX, start.y);
        ctx.lineTo(centerX, end.y);
        ctx.moveTo(start.x, centerY);
        ctx.lineTo(end.x, centerY);
        // 直角标记
        const size = 10;
        ctx.moveTo(centerX - size, centerY);
        ctx.lineTo(centerX - size, centerY - size);
        ctx.lineTo(centerX, centerY - size);
        ctx.stroke();
        break;
      }
      case 'parallelSymbol': {
        const offset = Math.abs(width) / 4;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x, end.y);
        ctx.moveTo(start.x + offset, start.y);
        ctx.lineTo(start.x + offset, end.y);
        ctx.stroke();
        break;
      }
      case 'arc': {
        const r = Math.abs(width) / 2;
        ctx.beginPath();
        ctx.arc(centerX, end.y, r, Math.PI, 0, false);
        ctx.stroke();
        break;
      }
      case 'circlePlus':
      case 'circleCross': {
        const r = Math.min(Math.abs(width), Math.abs(height)) / 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        if (shapeType === 'circlePlus') {
          ctx.moveTo(centerX, centerY - r * 0.6);
          ctx.lineTo(centerX, centerY + r * 0.6);
          ctx.moveTo(centerX - r * 0.6, centerY);
          ctx.lineTo(centerX + r * 0.6, centerY);
        } else {
          ctx.moveTo(centerX - r * 0.6, centerY - r * 0.6);
          ctx.lineTo(centerX + r * 0.6, centerY + r * 0.6);
          ctx.moveTo(centerX + r * 0.6, centerY - r * 0.6);
          ctx.lineTo(centerX - r * 0.6, centerY + r * 0.6);
        }
        ctx.stroke();
        break;
      }
      
      default: {
        // 默认画矩形
        ctx.beginPath();
        ctx.rect(start.x, start.y, width, height);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  };

  // 检测点击是否在stroke边界内
  const isPointInStroke = (point: Point, stroke: Stroke): boolean => {
    if (stroke.tool === 'text' || stroke.tool === 'symbol') {
      // 文字/符号：检测点是否在范围内
      if (stroke.points.length === 0) return false;
      const p = stroke.points[0];
      const size = stroke.tool === 'text' ? (stroke.fontSize || 24) : (stroke.symbolSize || 40);
      return Math.abs(point.x - p.x) < size * 2 && Math.abs(point.y - p.y) < size;
    } else if (stroke.tool === 'shape' && stroke.points.length >= 2) {
      // 形状：检测点是否在边界框内
      const [p1, p2] = stroke.points;
      const minX = Math.min(p1.x, p2.x) - 10;
      const maxX = Math.max(p1.x, p2.x) + 10;
      const minY = Math.min(p1.y, p2.y) - 10;
      const maxY = Math.max(p1.y, p2.y) + 10;
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    } else if (stroke.points.length >= 2) {
      // 画笔/橡皮：检测点是否接近路径
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        const dist = distanceToLineSegment(point, p1, p2);
        if (dist < stroke.width + 5) return true;
      }
    }
    return false;
  };

  // 计算点到线段的距离
  const distanceToLineSegment = (point: Point, p1: Point, p2: Point): number => {
    const A = point.x - p1.x;
    const B = point.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = p1.x;
      yy = p1.y;
    } else if (param > 1) {
      xx = p2.x;
      yy = p2.y;
    } else {
      xx = p1.x + param * C;
      yy = p1.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 获取stroke的边界框
  const getStrokeBoundingBox = (stroke: Stroke): { x: number; y: number; width: number; height: number } | null => {
    if (stroke.tool === 'text' || stroke.tool === 'symbol') {
      if (stroke.points.length === 0) return null;
      const p = stroke.points[0];
      const size = stroke.tool === 'text' ? (stroke.fontSize || 24) : (stroke.symbolSize || 40);
      return { x: p.x - size, y: p.y - size / 2, width: size * 4, height: size * 1.5 };
    } else if (stroke.tool === 'shape' && stroke.points.length >= 2) {
      const [p1, p2] = stroke.points;
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const width = Math.abs(p2.x - p1.x);
      const height = Math.abs(p2.y - p1.y);
      return { x, y, width, height };
    } else if (stroke.points.length >= 2) {
      const xs = stroke.points.map(p => p.x);
      const ys = stroke.points.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    return null;
  };

  // 绘制选中控制框
  const drawSelectionBox = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    const bbox = getStrokeBoundingBox(stroke);
    if (!bbox) return;
    
    const padding = 3;  // 减小到3px，更贴近形状
    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const w = bbox.width + padding * 2;
    const h = bbox.height + padding * 2;
    
    // 绘制虚线边框
    ctx.save();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    
    // 绘制8个控制点
    const controlSize = 8;
    const points = [
      { id: 'br', x: x + w, y: y + h },  // 只保留右下角
    ];
    
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    
    points.forEach(point => {
      ctx.fillRect(point.x - controlSize / 2, point.y - controlSize / 2, controlSize, controlSize);
      ctx.strokeRect(point.x - controlSize / 2, point.y - controlSize / 2, controlSize, controlSize);
    });
    
    // 绘制旋转手柄
    const rotateHandleY = y - 30;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, rotateHandleY + 10);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x + w / 2, rotateHandleY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
  };

  // 检测点击的控制点
  const getControlPointAtPosition = (point: Point, stroke: Stroke): string | null => {
    const bbox = getStrokeBoundingBox(stroke);
    if (!bbox) return null;
    
    const padding = 3;  // 与drawSelectionBox保持一致
    const x = bbox.x - padding;
    const y = bbox.y - padding;
    const w = bbox.width + padding * 2;
    const h = bbox.height + padding * 2;
    const hitRadius = 10;
    
    const points = [
      { id: 'br', x: x + w, y: y + h },
      { id: 'rotate', x: x + w / 2, y: y - 30 },
    ];
    
    for (const cp of points) {
      const dist = Math.sqrt(Math.pow(point.x - cp.x, 2) + Math.pow(point.y - cp.y, 2));
      if (dist < hitRadius) return cp.id;
    }
    
    return null;
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
        className={`absolute top-0 left-0 w-full h-full ${
          currentTool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
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
        {/* 画笔（含形状） */}
        <div className="flex gap-2">
          <ShapeSymbolPicker
            isVisible={showShapePanel}
            selectedShape={selectedShape}
            onSelect={handleShapeSelect}
            onMouseEnter={() => setShowShapePanel(true)}
            onMouseLeave={() => setShowShapePanel(false)}
            onUploadClick={() => setShowCustomSymbolManager(true)}
          />
          <button
            onClick={() => setCurrentTool('eraser')}
            className={`p-2 rounded transition ${
              currentTool === 'eraser' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="橡皮擦"
          >
            <Eraser size={20} />
          </button>
          
          {/* 选择工具 */}
          <button
            onClick={() => {
              setCurrentTool('select');
              setSelectedStrokeIndex(null);
            }}
            className={`p-2 rounded transition ${
              currentTool === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="选择工具（点击选中形状，拖拽控制点调整）"
          >
            <MousePointer size={20} />
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
