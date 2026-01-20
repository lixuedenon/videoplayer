import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { ButtonName } from '../types/buttonCustomization';
import {
  getButtonImages,
  addButtonImage,
  deleteButtonImage,
  clearButtonImages
} from '../utils/buttonCustomization';

interface ButtonImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const buttonLabels: Record<ButtonName, string> = {
  play: 'Play',
  next: 'Next',
  prev: 'Previous',
  forward: 'Skip Forward',
  backward: 'Skip Backward',
  add_file: 'Add File',
  add_url: 'Add URL',
  folder: 'Folder'
};

export const ButtonImageUpload: React.FC<ButtonImageUploadProps> = ({
  isOpen,
  onClose,
  onUploadComplete
}) => {
  const [selectedButton, setSelectedButton] = useState<ButtonName>('play');
  const [images, setImages] = useState<Array<{ id: string; url: string; index: number }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, selectedButton]);

  const loadImages = async () => {
    const buttonImages = await getButtonImages(selectedButton);
    setImages(
      buttonImages.map(img => ({
        id: img.id,
        url: img.image_url,
        index: img.order_index
      }))
    );
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 20) {
      setUploadMessage('⚠️ Maximum 20 images per button');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }

    setIsLoading(true);
    setUploadMessage('');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        await new Promise<void>((resolve, reject) => {
          reader.onload = async () => {
            try {
              const dataUrl = reader.result as string;
              await addButtonImage(selectedButton, dataUrl);
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      await loadImages();
      onUploadComplete();
      setUploadMessage(`✓ Successfully uploaded ${files.length} image${files.length > 1 ? 's' : ''} to ${buttonLabels[selectedButton]}`);
      setTimeout(() => setUploadMessage(''), 5000);
    } catch (error) {
      console.error('Error uploading images:', error);
      setUploadMessage('✗ Failed to upload images. Please try again.');
      setTimeout(() => setUploadMessage(''), 5000);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    const success = await deleteButtonImage(imageId);
    if (success) {
      await loadImages();
      onUploadComplete();
      setUploadMessage('✓ Image deleted');
      setTimeout(() => setUploadMessage(''), 3000);
    } else {
      setUploadMessage('✗ Failed to delete image');
      setTimeout(() => setUploadMessage(''), 3000);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Clear all images for ${buttonLabels[selectedButton]}?`)) {
      return;
    }

    const success = await clearButtonImages(selectedButton);
    if (success) {
      await loadImages();
      onUploadComplete();
      setUploadMessage('✓ All images cleared');
      setTimeout(() => setUploadMessage(''), 3000);
    } else {
      setUploadMessage('✗ Failed to clear images');
      setTimeout(() => setUploadMessage(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-blue-400" size={24} />
            <h2 className="text-white text-xl font-bold">Upload Button Images</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="关闭"
          >
            <X size={24} />
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-white text-sm font-medium mb-2">
            Select Button
          </label>
          <select
            value={selectedButton}
            onChange={(e) => setSelectedButton(e.target.value as ButtonName)}
            className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
          >
            {(Object.keys(buttonLabels) as ButtonName[]).map(buttonName => (
              <option key={buttonName} value={buttonName}>
                {buttonLabels[buttonName]}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="text-white text-sm font-medium">
              Images ({images.length}/20)
            </label>
            {images.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
              >
                <Trash2 size={14} />
                Clear All
              </button>
            )}
          </div>

          {uploadMessage && (
            <div className={`mb-3 p-3 rounded text-sm ${
              uploadMessage.startsWith('✓')
                ? 'bg-green-900/50 text-green-300 border border-green-700'
                : 'bg-red-900/50 text-red-300 border border-red-700'
            }`}>
              {uploadMessage}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3 mb-4">
            {images.map((image) => (
              <div key={image.id} className="relative group">
                <img
                  src={image.url}
                  alt={`Button image ${image.index + 1}`}
                  className="w-full h-32 object-contain rounded bg-gray-800 p-2"
                  style={{ imageRendering: 'crisp-edges' }}
                />
                <button
                  onClick={() => handleDeleteImage(image.id)}
                  className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除图片"
                >
                  <Trash2 size={14} />
                </button>
                <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                  {image.index + 1}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || images.length >= 20}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload size={18} />
            {isLoading ? 'Uploading...' : 'Upload Images'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <div className="bg-gray-800 rounded p-3 text-sm text-gray-300">
          <p className="mb-1">Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Upload up to 20 images per button</li>
            <li>System will auto-generate horizontally flipped versions</li>
            <li>Images will rotate in upload order</li>
          </ul>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
