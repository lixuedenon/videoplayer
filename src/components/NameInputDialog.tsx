import React, { useState, useEffect, useRef } from 'react';
import { X, Save } from 'lucide-react';

interface NameInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  defaultName?: string;
}

export const NameInputDialog: React.FC<NameInputDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultName = ''
}) => {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousIsOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !previousIsOpenRef.current) {
      setName(defaultName);
    }
    previousIsOpenRef.current = isOpen;

    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [defaultName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-xl font-semibold">保存涂鸦</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="annotation-name" className="block text-white text-sm font-medium mb-2">
              涂鸦名称
            </label>
            <input
              ref={inputRef}
              id="annotation-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入涂鸦名称，方便查询"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
            <p className="text-gray-400 text-xs mt-2">
              提示：起一个有意义的名字，便于后续搜索和查找
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
