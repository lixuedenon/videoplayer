import { VideoSegment } from '../types/videoSegment';
import { Annotation, DrawingElement, TextAnnotation } from '../types/annotation';
import * as indexedDB from './indexedDB';

export const searchVideoSegments = async (query: string): Promise<VideoSegment[]> => {
  if (!query.trim()) return [];

  try {
    const allSegments = await indexedDB.getVideoSegments();
    const lowerQuery = query.toLowerCase();

    const matchingSegments = allSegments.filter(segment => {
      return segment.text_content?.toLowerCase().includes(lowerQuery);
    });

    return matchingSegments.slice(0, 20);
  } catch (error) {
    console.error('Error searching video segments:', error);
    return [];
  }
};

export const searchAnnotations = async (query: string): Promise<Annotation[]> => {
  if (!query.trim()) return [];

  try {
    const allAnnotations = await indexedDB.getAnnotations();
    const lowerQuery = query.toLowerCase();

    const matchingAnnotations = allAnnotations.filter(annotation => {
      if (!annotation.drawing_data) return false;

      const drawingData = annotation.drawing_data;
      const elements = drawingData.elements || [];

      return elements.some((element: DrawingElement) => {
        if (element.tool === 'text') {
          const textElement = element as TextAnnotation;
          return textElement.text.toLowerCase().includes(lowerQuery);
        }
        return false;
      });
    });

    return matchingAnnotations.slice(0, 20);
  } catch (error) {
    console.error('Error searching annotations:', error);
    return [];
  }
};

export const extractTextFromAnnotation = (annotation: Annotation): string => {
  if (!annotation.drawing_data) return '';

  const elements = annotation.drawing_data.elements || [];
  const textElements = elements.filter(
    (element): element is TextAnnotation => element.tool === 'text'
  );

  return textElements.map(element => element.text).join(' ');
};
