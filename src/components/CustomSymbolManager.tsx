import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Edit2, X } from 'lucide-react';

export interface CustomSymbol {
  id: string;
  name: string;
  base64: string;
  type: 'image/png' | 'image/jpeg' | 'image/svg+xml' | 'image/gif';
  size: number;
  width: number;
  height: number;
  createdAt: string;
}

interface CustomSymbolManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (symbol: CustomSymbol) => void;
}

const DB_NAME = 'CustomSymbolsDB';
const DB_VERSION = 1;
const STORE_NAME = 'symbols';

// IndexedDB工具函数
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

const saveSymbolToDB = async (symbol: CustomSymbol): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(symbol);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const getSymbolsFromDB = async (): Promise<CustomSymbol[]> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const deleteSymbolFromDB = async (id: string): Promise<void> => {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 文件转base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 获取图片尺寸
const getImageDimensions = (base64: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = reject;
    img.src = base64;
  });
};

export const CustomSymbolManager: React.FC<CustomSymbolManagerProps> = ({
  isOpen,
  onClose,
  onSelect
}) => {
  const [symbols, setSymbols] = useState<CustomSymbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载符号列表
  useEffect(() => {
    if (isOpen) {
      loadSymbols();
    }
  }, [isOpen]);

  const loadSymbols = async () => {
    try {
      const loaded = await getSymbolsFromDB();
      setSymbols(loaded);
    } catch (error) {
      console.error('加载符号失败:', error);
      alert('加载符号失败');
    }
  };

  // 上传新符号
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} 不是图片文件`);
          continue;
        }

        // 验证文件大小（最大2MB）
        if (file.size > 2 * 1024 * 1024) {
          alert(`${file.name} 文件过大（最大2MB）`);
          continue;
        }

        // 转换为base64
        const base64 = await fileToBase64(file);
        
        // 获取图片尺寸
        const { width, height } = await getImageDimensions(base64);

        // 创建符号对象
        const symbol: CustomSymbol = {
          id: `custom_${Date.now()}_${i}`,
          name: file.name.replace(/\.[^/.]+$/, ''), // 去掉扩展名
          base64,
          type: file.type as CustomSymbol['type'],
          size: file.size,
          width,
          height,
          createdAt: new Date().toISOString()
        };

        // 保存到IndexedDB
        await saveSymbolToDB(symbol);
      }

      // 重新加载列表
      await loadSymbols();
      alert('上传成功！');
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 删除符号
  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这个符号吗？')) return;

    try {
      await deleteSymbolFromDB(id);
      await loadSymbols();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败');
    }
  };

  // 重命名符号
  const startEdit = (symbol: CustomSymbol) => {
    setEditingId(symbol.id);
    setEditingName(symbol.name);
  };

  const saveEdit = async (symbol: CustomSymbol) => {
    if (!editingName.trim()) {
      alert('名称不能为空');
      return;
    }

    try {
      const updated = { ...symbol, name: editingName.trim() };
      await saveSymbolToDB(updated);
      await loadSymbols();
      setEditingId(null);
    } catch (error) {
      console.error('重命名失败:', error);
      alert('重命名失败');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-[600px] max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-white text-lg font-bold">自定义符号管理</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-700 rounded transition"
          >
            <X size={20} className="text-gray-300" />
          </button>
        </div>

        {/* 上传区域 */}
        <div className="p-4 border-b border-gray-700">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/gif"
            multiple
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded-lg transition flex items-center justify-center gap-2"
          >
            <Upload size={20} />
            {isLoading ? '上传中...' : '上传图片（PNG/JPG/SVG/GIF，最大2MB）'}
          </button>
          <p className="text-gray-400 text-xs mt-2">支持批量上传，可以同时选择多个文件</p>
        </div>

        {/* 符号列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {symbols.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Upload size={48} className="mx-auto mb-4 opacity-50" />
              <p>还没有自定义符号</p>
              <p className="text-sm mt-2">点击上方按钮上传你的图标</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {symbols.map(symbol => (
                <div
                  key={symbol.id}
                  className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition group"
                >
                  {/* 图片预览 */}
                  <div 
                    className="aspect-square bg-gray-800 rounded flex items-center justify-center mb-2 cursor-pointer"
                    onClick={() => onSelect(symbol)}
                  >
                    <img
                      src={symbol.base64}
                      alt={symbol.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>

                  {/* 名称和操作 */}
                  {editingId === symbol.id ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-gray-800 text-white text-sm rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(symbol);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <button
                        onClick={() => saveEdit(symbol)}
                        className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-500"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500"
                      >
                        ✗
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-white text-sm truncate flex-1">{symbol.name}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => startEdit(symbol)}
                          className="p-1 hover:bg-gray-800 rounded"
                          title="重命名"
                        >
                          <Edit2 size={14} className="text-gray-300" />
                        </button>
                        <button
                          onClick={() => handleDelete(symbol.id)}
                          className="p-1 hover:bg-red-600 rounded"
                          title="删除"
                        >
                          <Trash2 size={14} className="text-gray-300" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 文件信息 */}
                  <p className="text-gray-400 text-xs mt-1">
                    {symbol.width}×{symbol.height} • {(symbol.size / 1024).toFixed(1)}KB
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
          <p className="text-gray-400 text-sm">共 {symbols.length} 个自定义符号</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
