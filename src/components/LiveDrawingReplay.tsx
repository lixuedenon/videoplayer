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

  console.log('🎬 LiveDrawingReplay render:', {
    isActive,
    hasCanvas: !!canvasRef.current,
    hasVideoElement: !!videoElement,
    dataStrokes: liveDrawingData?.strokes?.length,
    startTimestamp
  });

  useEffect(() => {
    console.log('🎬 LiveDrawingReplay useEffect triggered:', {
      isActive,
      hasCanvas: !!canvasRef.current,
      canvasWidth: liveDrawingData.canvasWidth,
      canvasHeight: liveDrawingData.canvasHeight
    });

    if (!isActive || !canvasRef.current) {
      console.log('❌ LiveDrawingReplay: conditions not met', {
        isActive,
        hasCanvas: !!canvasRef.current
      });
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    console.log('🖌️ Canvas context:', {
      hasCtx: !!ctx,
      canvas: canvas,
      canvasInDOM: document.body.contains(canvas)
    });
    
    if (!ctx) {
      console.error('❌ Failed to get canvas context!');
      return;
    }

    // 设置canvas尺寸
    canvas.width = liveDrawingData.canvasWidth;
    canvas.height = liveDrawingData.canvasHeight;
    
    console.log('✅ Canvas initialized:', {
      width: canvas.width,
      height: canvas.height,
      strokesCount: liveDrawingData.strokes.length
    });

    const renderFrame = () => {
      if (!isActive) {
        console.log('⏹️ renderFrame stopped: isActive=false');
        return;
      }

      const currentVideoTime = videoElement.currentTime;
      const relativeTime = currentVideoTime - startTimestamp;

      console.log('🎨 renderFrame:', {
        currentVideoTime,
        startTimestamp,
        relativeTime,
        strokesCount: liveDrawingData.strokes.length
      });

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let drawnStrokes = 0;

      // 绘制所有应该显示的笔画
      liveDrawingData.strokes.forEach((stroke, index) => {
        // 只绘制已经开始的笔画
        if (relativeTime < stroke.startTime) {
          console.log(`⏭️ Stroke ${index} not started yet:`, stroke.startTime, '>', relativeTime);
          return;
        }

        const isComplete = relativeTime >= stroke.endTime;
        
        console.log(`🖌️ Drawing stroke ${index}:`, {
          startTime: stroke.startTime,
          endTime: stroke.endTime,
          relativeTime,
          isComplete,
          pointsCount: stroke.points.length
        });
        
        if (stroke.points.length < 2) {
          console.log('⚠️ Stroke has less than 2 points');
          return;
        }

        drawnStrokes++;

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

      console.log(`✅ Frame rendered, drew ${drawnStrokes} strokes`);

      ctx.globalCompositeOperation = 'source-over';

      // 继续下一帧
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    // 启动渲染循环
    renderFrame();

    return () => {
      console.log('🔴 LiveDrawingReplay cleanup - unmounting');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, videoElement, liveDrawingData, startTimestamp]);

  console.log('🎨 LiveDrawingReplay return, isActive:', isActive);

  if (!isActive) {
    console.log('❌ LiveDrawingReplay: isActive=false, returning null');
    return null;
  }

  console.log('✅ LiveDrawingReplay: returning canvas element');

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{ zIndex: 25 }}
    />
  );
};
