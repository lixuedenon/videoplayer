// src/components/LiveDrawingReplay.tsx
// 动态涂鸦回放组件

import React, { useEffect, useRef } from 'react';
import type { LiveDrawingData } from '../types/annotation';
import type { ShapeType } from './ShapeSymbolPicker';

interface LiveDrawingReplayProps {
  videoElement: HTMLVideoElement;
  liveDrawingData: LiveDrawingData;
  startTimestamp: number;
  isActive: boolean;
}

export const LiveDrawingReplay: React.FC<LiveDrawingReplayProps> = ({
  videoElement,
  liveDrawingData,
  startTimestamp,
  isActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastLoggedSecondRef = useRef<number>(-1);

  useEffect(() => {
    console.log('[LiveDrawingReplay] Effect triggered:', {
      isActive,
      hasVideoElement: !!videoElement,
      hasCanvas: !!canvasRef.current,
      strokesCount: liveDrawingData.strokes?.length,
      startTimestamp
    });

    if (!isActive || !videoElement || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // 设置canvas尺寸
    canvas.width = liveDrawingData.canvasWidth;
    canvas.height = liveDrawingData.canvasHeight;

    const canvasRect = canvas.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(canvas);
    console.log('[LiveDrawingReplay] Canvas setup:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      strokesCount: liveDrawingData.strokes.length
    });

    // 关键：打印所有笔画的时间信息
    console.log('[LiveDrawingReplay] Strokes timing:', liveDrawingData.strokes.map((s, i) => ({
      index: i,
      tool: s.tool,
      startTime: s.startTime?.toFixed(2) || 'N/A',
      endTime: s.endTime?.toFixed(2) || 'N/A',
      duration: ((s.endTime || 0) - (s.startTime || 0)).toFixed(2)
    })));

    const renderFrame = () => {
      if (!isActive) return;

      const currentVideoTime = videoElement.currentTime;

      // 关键修复：笔画的startTime/endTime是相对时间（从0开始）
      // 需要计算相对于涂鸦开始时间的偏移量
      const relativeTime = currentVideoTime - startTimestamp;

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制所有应该显示的笔画
      let drawnCount = 0;

      // 打印所有笔画的详细信息（每秒打印一次）
      const currentSecond = Math.floor(currentVideoTime);
      if (currentSecond !== lastLoggedSecondRef.current) {
        lastLoggedSecondRef.current = currentSecond;
        console.log('🎨 [Strokes Detail]', {
          videoTime: currentVideoTime.toFixed(2),
          relativeTime: relativeTime.toFixed(2),
          strokes: liveDrawingData.strokes.map((s, i) => ({
            index: i,
            tool: s.tool,
            points: s.points?.length || 0,
            start: s.startTime.toFixed(2),
            end: s.endTime.toFixed(2),
            duration: (s.endTime - s.startTime).toFixed(2)
          }))
        });
      }

      liveDrawingData.strokes.forEach((stroke, index) => {
        // 只绘制已经开始的笔画（使用相对时间比较）
        // 添加小容差以处理精度问题
        if (relativeTime < (stroke.startTime - 0.01)) return;
        drawnCount++;

        // 检查笔画是否已完成（适用于所有类型）
        const isComplete = relativeTime >= stroke.endTime;
        const strokeDuration = stroke.endTime - stroke.startTime;
        const strokeProgress = Math.min(1, Math.max(0, (relativeTime - stroke.startTime) / strokeDuration));

        // 计算当前时刻的变换状态（使用关键帧插值）
        let currentPoints = stroke.points;
        let currentRotation = stroke.rotation;
        let currentSymbolSize = stroke.symbolSize;
        let currentFontSize = stroke.fontSize;

        if (stroke.transforms && stroke.transforms.length > 0) {
          // 找到当前时间对应的关键帧区间
          const transforms = stroke.transforms;

          // 找到最后一个时间小于等于当前时间的关键帧
          let prevKeyframe = null;
          let nextKeyframe = null;

          for (let i = 0; i < transforms.length; i++) {
            if (transforms[i].time <= relativeTime) {
              prevKeyframe = transforms[i];
            } else if (nextKeyframe === null && transforms[i].time > relativeTime) {
              nextKeyframe = transforms[i];
              break;
            }
          }

          // 如果有关键帧，进行插值
          if (prevKeyframe) {
            if (nextKeyframe) {
              // 在两个关键帧之间插值
              const t = (relativeTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);

              if (prevKeyframe.points && nextKeyframe.points) {
                currentPoints = prevKeyframe.points.map((p, i) => ({
                  x: p.x + (nextKeyframe.points![i].x - p.x) * t,
                  y: p.y + (nextKeyframe.points![i].y - p.y) * t
                }));
              }

              if (prevKeyframe.rotation !== undefined && nextKeyframe.rotation !== undefined) {
                currentRotation = prevKeyframe.rotation + (nextKeyframe.rotation - prevKeyframe.rotation) * t;
              }

              if (prevKeyframe.symbolSize !== undefined && nextKeyframe.symbolSize !== undefined) {
                currentSymbolSize = prevKeyframe.symbolSize + (nextKeyframe.symbolSize - prevKeyframe.symbolSize) * t;
              }

              if (prevKeyframe.fontSize !== undefined && nextKeyframe.fontSize !== undefined) {
                currentFontSize = prevKeyframe.fontSize + (nextKeyframe.fontSize - prevKeyframe.fontSize) * t;
              }
            } else {
              // 使用最后一个关键帧的值
              if (prevKeyframe.points) currentPoints = prevKeyframe.points;
              if (prevKeyframe.rotation !== undefined) currentRotation = prevKeyframe.rotation;
              if (prevKeyframe.symbolSize !== undefined) currentSymbolSize = prevKeyframe.symbolSize;
              if (prevKeyframe.fontSize !== undefined) currentFontSize = prevKeyframe.fontSize;
            }
          }
        }

        // 文字类型：使用插值后的值
        if (stroke.tool === 'text' && stroke.text) {
          ctx.save();
          ctx.font = `${currentFontSize || 24}px Arial`;
          ctx.fillStyle = stroke.color;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(stroke.text, currentPoints[0].x, currentPoints[0].y);
          ctx.restore();
          return;
        }

        // 符号类型：使用插值后的值
        if (stroke.tool === 'symbol' && stroke.symbolChar) {
          ctx.save();
          ctx.translate(currentPoints[0].x, currentPoints[0].y);
          if (currentRotation) {
            ctx.rotate((currentRotation * Math.PI) / 180);
          }
          ctx.font = `${currentSymbolSize || 40}px Arial`;
          ctx.fillStyle = stroke.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(stroke.symbolChar, 0, 0);
          ctx.restore();
          return;
        }

        // 形状类型：使用插值后的值
        if (stroke.tool === 'shape' && stroke.shapeType && currentPoints.length >= 2) {
          ctx.save();

          // 如果形状正在绘制中（首次创建），按进度插值
          let endPoint = currentPoints[1];
          if (!isComplete && (!stroke.transforms || stroke.transforms.length === 0)) {
            const startPoint = currentPoints[0];
            endPoint = {
              x: startPoint.x + (currentPoints[1].x - startPoint.x) * strokeProgress,
              y: startPoint.y + (currentPoints[1].y - startPoint.y) * strokeProgress
            };
          }

          drawShape(ctx, stroke.shapeType, currentPoints[0], endPoint, {
            color: stroke.color,
            width: stroke.width,
            filled: stroke.filled || false,
            rotation: currentRotation
          });
          ctx.restore();
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

        if (isComplete) {
          // 笔画已完成，绘制全部
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
        } else {
          // 笔画正在进行中，根据点的时间戳精确绘制
          const hasTimestamps = stroke.points.some(p => p.timestamp !== undefined);

          if (hasTimestamps) {
            // 使用时间戳精确回放
            const visiblePoints = stroke.points.filter(p =>
              p.timestamp === undefined || p.timestamp <= relativeTime
            );

            if (visiblePoints.length >= 2) {
              ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
              for (let i = 1; i < visiblePoints.length; i++) {
                ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
              }
            } else if (visiblePoints.length === 1) {
              // 只有起始点，画个小圆点
              ctx.arc(visiblePoints[0].x, visiblePoints[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // 兼容旧数据：按比例绘制
            const pointsToShow = Math.max(2, Math.floor(stroke.points.length * strokeProgress));

            if (pointsToShow >= 2) {
              ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
              for (let i = 1; i < pointsToShow; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
              }
            }
          }
        }

        ctx.stroke();
      });

      ctx.globalCompositeOperation = 'source-over';

      // 绘制调试信息：显示有多少笔画被绘制
      ctx.font = '16px Arial';
      ctx.fillStyle = 'yellow';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 2;
      ctx.fillText(`Strokes: ${drawnCount}/${liveDrawingData.strokes.length}`, 10, 25);
      ctx.fillText(`Video: ${currentVideoTime.toFixed(2)}s`, 10, 45);
      ctx.fillText(`Relative: ${relativeTime.toFixed(2)}s`, 10, 65);
      ctx.fillText(`Start: ${startTimestamp.toFixed(2)}s`, 10, 85);
      ctx.shadowBlur = 0;

      // 继续下一帧
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    // 启动渲染循环
    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, videoElement, liveDrawingData, startTimestamp]);

  // 形状绘制函数（与LiveDrawingOverlay保持一致）
  const drawShape = (
    ctx: CanvasRenderingContext2D, 
    shapeType: ShapeType, 
    start: { x: number; y: number }, 
    end: { x: number; y: number }, 
    options: { color: string; width: number; filled: boolean; rotation?: number }
  ) => {
    ctx.save();
    
    const width = end.x - start.x;
    const height = end.y - start.y;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    
    // 如果有旋转，应用旋转变换
    if (options.rotation !== undefined && options.rotation !== 0) {
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
        const radius = 10;
        const mainWidth = width * 0.9;
        const mainHeight = height * 0.75;
        ctx.beginPath();
        ctx.roundRect(start.x, start.y, mainWidth, mainHeight, radius);
        ctx.stroke();
        // 三个小圆圈
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

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 25 }}
    />
  );
};