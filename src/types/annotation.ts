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

export interface Annotation {
  id: string;
  video_url: string;
  timestamp: number;
  drawing_data: DrawingData;
  thumbnail?: string;
  name?: string;
  text_content?: string;
  created_at: string;
}
