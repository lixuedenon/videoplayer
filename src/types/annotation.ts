export type DrawingTool = 'select' | 'pen' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'highlighter' | 'checkmark' | 'cross' | 'number1' | 'number2' | 'number3' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface DrawingStroke {
  tool: DrawingTool;
  points: Point[];
  color: string;
  lineWidth: number;
  opacity: number;
}

export interface TextAnnotation {
  tool: 'text';
  text: string;
  position: Point;
  color: string;
  fontSize: number;
}

export interface ShapeAnnotation {
  tool: 'arrow' | 'circle' | 'rectangle' | 'line' | 'checkmark' | 'cross' | 'number1' | 'number2' | 'number3';
  start: Point;
  end: Point;
  color: string;
  lineWidth: number;
}

export type DrawingElement = DrawingStroke | TextAnnotation | ShapeAnnotation;

export interface DrawingData {
  elements: DrawingElement[];
  canvasWidth: number;
  canvasHeight: number;
}

// 动态涂鸦的时间轴笔画
export interface LiveStroke {
  tool: 'pen' | 'eraser';
  color: string;
  width: number;
  points: Point[];
  startTime: number;  // 相对于标注开始的时间（秒）
  endTime: number;    // 笔画完成时间
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
  drawing_data: DrawingData;
  live_drawing_data?: LiveDrawingData;  // 动态涂鸦数据
  is_live?: boolean;  // 是否为动态涂鸦
  thumbnail?: string;
  name?: string;
  text_content?: string;
  created_at: string;
}
