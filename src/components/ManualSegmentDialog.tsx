import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ManualSegmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentTime: number;
  duration: number;
  onDownload: (startTime: number, endTime: number) => void;
}

export function ManualSegmentDialog({
  isOpen,
  onClose,
  currentTime,
  duration,
  onDownload
}: ManualSegmentDialogProps) {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const start = Math.max(0, currentTime - 10);
      const end = Math.min(duration, currentTime + 10);
      setStartTime(start);
      setEndTime(end);
    }
  }, [isOpen, currentTime, duration]);

  const handleDownload = async () => {
    if (startTime >= endTime) {
      alert('开始时间必须小于结束时间');
      return;
    }

    if (endTime - startTime > 600) {
      alert('视频片段长度不能超过 10 分钟');
      return;
    }

    setIsDownloading(true);
    await onDownload(startTime, endTime);
    setIsDownloading(false);
    onClose();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeInputChange = (value: string, setter: (val: number) => void) => {
    const parts = value.split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0]) || 0;
      const secs = parseInt(parts[1]) || 0;
      const totalSeconds = mins * 60 + secs;
      setter(Math.max(0, Math.min(duration, totalSeconds)));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-[500px] max-w-[90vw]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">手动选择视频片段</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              开始时间
            </label>
            <input
              type="text"
              value={formatTime(startTime)}
              onChange={(e) => handleTimeInputChange(e.target.value, setStartTime)}
              placeholder="0:00"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={startTime}
              onChange={(e) => setStartTime(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              结束时间
            </label>
            <input
              type="text"
              value={formatTime(endTime)}
              onChange={(e) => handleTimeInputChange(e.target.value, setEndTime)}
              placeholder="0:00"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={endTime}
              onChange={(e) => setEndTime(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div className="bg-gray-700 p-4 rounded">
            <p className="text-sm text-gray-300">
              <strong>片段长度：</strong> {(endTime - startTime).toFixed(1)} 秒
            </p>
            <p className="text-sm text-gray-300 mt-2">
              <strong>时间范围：</strong> {formatTime(startTime)} - {formatTime(endTime)}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            disabled={isDownloading}
          >
            取消
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading || startTime >= endTime}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Download size={18} />
            {isDownloading ? '下载中...' : '下载片段'}
          </button>
        </div>
      </div>
    </div>
  );
}
