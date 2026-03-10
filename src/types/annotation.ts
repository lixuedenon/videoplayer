// src/types/annotation.ts
// TypeScript类型定义文件

export interface Point {
  x: number;
  y: number;
  timestamp?: number;  // 点的时间戳（相对于标注开始的秒数）
}

// 动态涂鸦的时间轴笔画
export interface LiveStroke {
  tool: 'pen' | 'eraser' | 'symbol' | 'text' | 'shape';
  color: string;
  width: number;
  points: Point[];
  startTime: number;  // 相对于标注开始的时间（秒）
  endTime: number;    // 笔画完成时间
  // 符号相关字段
  symbolId?: string;
  symbolChar?: string;
  symbolSize?: number;
  symbolRotation?: number;
  // 文字相关字段
  text?: string;
  fontSize?: number;
  // 形状相关字段 - 完整的35种形状类型定义
  shapeType?: 'freepen' 
    // 基础形状
    | 'circle' | 'rectangle' | 'roundRect' | 'diamond' 
    | 'triangleUp' | 'triangleDown' | 'triangleLeft' | 'triangleRight' 
    | 'hexagon' | 'star'
    // 线条类
    | 'line' | 'vertical' | 'horizontal' | 'diagonal45' | 'diagonal135' | 'parallel'
    | 'lShape' | 'zShape' | 'arrowBoth' | 'arrowRight' | 'arrowLeft' | 'arrowUp' | 'arrowDown'
    // 标注类
    | 'cloud' | 'speech' | 'thought' | 'dashedBox' | 'bracket' | 'bookQuote'
    // 数学/专业
    | 'angle' | 'perpendicular' | 'parallelSymbol' | 'arc' | 'circlePlus' | 'circleCross';
  filled?: boolean;
  rotation?: number;  // 旋转角度（度数，0-360）
}

// 动态涂鸦数据
export interface LiveDrawingData {
  strokes: LiveStroke[];
  duration: number;  // 总时长
  canvasWidth: number;
  canvasHeight: number;
}

export interface Annotation {
  id: string;
  video_url: string;
  timestamp: number;
  live_drawing_data: LiveDrawingData;  // 动态涂鸦数据（必填）
  thumbnail?: string;
  name?: string;
  text_content?: string;
  is_live?: boolean;  // 标记是否为实时涂鸦
  created_at: string;
}