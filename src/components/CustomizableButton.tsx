import React from 'react';
import { LucideIcon } from 'lucide-react';
import { ButtonShape } from '../types/buttonCustomization';

interface CustomizableButtonProps {
  icon: LucideIcon;
  imageUrl: string | null;
  isMirrored: boolean;
  shape: ButtonShape;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  size?: number;
  title?: string;
}

export const CustomizableButton: React.FC<CustomizableButtonProps> = ({
  icon: Icon,
  imageUrl,
  isMirrored,
  shape,
  onClick,
  disabled = false,
  className = '',
  children,
  size = 24,
  title
}) => {
  const getShapeClasses = () => {
    switch (shape) {
      case 'circle':
        return 'rounded-full aspect-square';
      case 'ellipse':
        return 'rounded-full';
      case 'rounded-rect':
        return 'rounded-lg';
      default:
        return 'rounded';
    }
  };

  const baseClasses = imageUrl
    ? `overflow-hidden hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed ${getShapeClasses()} ${className}`
    : `bg-gray-800 text-white p-2 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${getShapeClasses()} ${className}`;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={baseClasses}
      style={imageUrl ? { width: `${size}px`, height: `${size}px` } : undefined}
      title={title}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
          style={{
            transform: isMirrored ? 'scaleX(-1)' : 'none',
            imageRendering: 'crisp-edges'
          }}
        />
      ) : (
        <Icon size={size} />
      )}
    </button>
  );
};
