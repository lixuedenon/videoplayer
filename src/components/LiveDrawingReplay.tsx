import React, { useEffect, useRef } from 'react';
import type { LiveDrawingData } from '../types/annotation';

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

  useEffect(() => {
    if (!isActive || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置canvas尺寸
    canvas.width = liveDrawingData.canvasWidth;
    canvas.height = liveDrawingData.canvasHeight;

    const renderFrame = () => {
      if (!isActive) return;

      const currentVideoTime = videoElement.currentTime;
      const relativeTime = currentVideoTime - startTimestamp;

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制所有应该显示的笔画
      liveDrawingData.strokes.forEach(stroke => {
        // 只绘制已经开始的笔画
        if (relativeTime < stroke.startTime) return;

        const isComplete = relativeTime >= stroke.endTime;
        
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
          // 笔画正在进行中，按比例绘制
          const strokeDuration = stroke.endTime - stroke.startTime;
          const strokeProgress = (relativeTime - stroke.startTime) / strokeDuration;
          const pointsToShow = Math.floor(stroke.points.length * strokeProgress);

          if (pointsToShow >= 2) {
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < pointsToShow; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
          }
        }

        ctx.stroke();
      });

      ctx.globalCompositeOperation = 'source-over';

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

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 25 }}
    />
  );
};
