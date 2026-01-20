import { VideoFile } from '../types/video';

const SUPPORTED_VIDEO_FORMATS = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.m4v',
  '.ogv'
];

const DB_NAME = 'VideoPlayerDB';
const DB_VERSION = 4;
const HANDLE_STORE = 'fileHandles';

let db: IDBDatabase | null = null;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(HANDLE_STORE)) {
        database.createObjectStore(HANDLE_STORE);
      }
    };
  });
};

export const requestPersistentStorage = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Persistent storage granted: ${isPersisted}`);
    return isPersisted;
  }
  return false;
};

export const checkPersistentStorage = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return false;
};

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  await requestPersistentStorage();

  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([HANDLE_STORE], 'readwrite');
    const store = transaction.objectStore(HANDLE_STORE);
    const request = store.put(handle, 'directory');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([HANDLE_STORE], 'readonly');
      const store = transaction.objectStore(HANDLE_STORE);
      const request = store.get('directory');

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error getting directory handle:', error);
    return null;
  }
};

export const verifyPermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
  const options = { mode: 'read' as FileSystemPermissionMode };

  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }

  if ((await handle.requestPermission(options)) === 'granted') {
    return true;
  }

  return false;
};

export const isVideoFile = (filename: string): boolean => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return SUPPORTED_VIDEO_FORMATS.includes(ext);
};

export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };

    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(0);
    };

    video.src = URL.createObjectURL(file);
  });
};

export const loadVideosFromDirectory = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<VideoFile[]> => {
  const videos: VideoFile[] = [];
  let order = 0;

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && isVideoFile(entry.name)) {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      const duration = await getVideoDuration(file);

      videos.push({
        name: entry.name,
        path: file.name,
        file,
        duration,
        progress: 0,
        order: order++
      });
    }
  }

  videos.sort((a, b) => a.name.localeCompare(b.name));
  videos.forEach((video, index) => {
    video.order = index;
  });

  return videos;
};

export const isFileSystemAccessSupported = (): boolean => {
  return 'showDirectoryPicker' in window;
};

export const requestDirectoryAccess = async (): Promise<FileSystemDirectoryHandle | null> => {
  try {
    if ('showDirectoryPicker' in window) {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read'
      });
      return dirHandle;
    }
    return null;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Error accessing directory:', error);
    }
    return null;
  }
};

export const loadVideosFromFileList = async (files: FileList): Promise<VideoFile[]> => {
  const videos: VideoFile[] = [];
  const fileArray = Array.from(files);

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    if (isVideoFile(file.name)) {
      const duration = await getVideoDuration(file);
      videos.push({
        name: file.name,
        path: file.name,
        file,
        duration,
        progress: 0,
        order: i
      });
    }
  }

  videos.sort((a, b) => a.name.localeCompare(b.name));
  videos.forEach((video, index) => {
    video.order = index;
  });

  return videos;
};

export const createVideoUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

export const revokeVideoUrl = (url: string): void => {
  URL.revokeObjectURL(url);
};

const IMAGE_DB_NAME = 'ButtonImagesDB';
const IMAGE_DB_VERSION = 4;
const IMAGE_STORE = 'images';

let imageDB: IDBDatabase | null = null;

const initImageDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (imageDB) {
      resolve(imageDB);
      return;
    }

    const request = indexedDB.open(IMAGE_DB_NAME, IMAGE_DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      imageDB = request.result;
      resolve(imageDB);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(IMAGE_STORE)) {
        const store = database.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
        store.createIndex('buttonName', 'buttonName', { unique: false });
      }
    };
  });
};

export const saveImage = async (
  id: string,
  imageUrl: string,
  buttonName: string,
  orderIndex: number
): Promise<void> => {
  const database = await initImageDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([IMAGE_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const request = store.put({ id, imageUrl, buttonName, orderIndex });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadImage = async (id: string): Promise<{ id: string; imageUrl: string; buttonName: string; orderIndex: number } | null> => {
  const database = await initImageDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([IMAGE_STORE], 'readonly');
    const store = transaction.objectStore(IMAGE_STORE);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const deleteImage = async (id: string): Promise<void> => {
  const database = await initImageDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([IMAGE_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearImages = async (buttonName: string): Promise<void> => {
  const database = await initImageDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([IMAGE_STORE], 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    const index = store.index('buttonName');
    const request = index.openCursor(IDBKeyRange.only(buttonName));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllImagesByButton = async (buttonName: string): Promise<any[]> => {
  const database = await initImageDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([IMAGE_STORE], 'readonly');
    const store = transaction.objectStore(IMAGE_STORE);
    const index = store.index('buttonName');
    const request = index.getAll(buttonName);

    request.onsuccess = () => {
      const results = request.result || [];
      results.sort((a, b) => a.orderIndex - b.orderIndex);
      const images = results.map(item => ({
        id: item.id,
        button_name: item.buttonName,
        image_url: item.imageUrl,
        order_index: item.orderIndex,
        user_id: 'local',
        created_at: new Date().toISOString()
      }));
      resolve(images);
    };
    request.onerror = () => reject(request.error);
  });
};
