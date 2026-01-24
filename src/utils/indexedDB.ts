import { Annotation } from '../types/annotation';
import { VideoSegment } from '../types/videoSegment';

const DB_NAME = 'VideoAnnotationDB';
const DB_VERSION = 2;  // 升级到版本2，支持动态涂鸦
const ANNOTATIONS_STORE = 'annotations';
const VIDEO_SEGMENTS_STORE = 'video_segments';

export interface IndexedDBAnnotation extends Omit<Annotation, 'id' | 'created_at'> {
  id?: string;
  created_at?: string;
  file_path?: string;
}

export interface IndexedDBVideoSegment extends Omit<VideoSegment, 'id' | 'created_at'> {
  id?: string;
  created_at?: string;
  file_path?: string;
}

let dbInstance: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction!;
      const oldVersion = event.oldVersion;

      // 创建annotations store（首次安装）
      if (!db.objectStoreNames.contains(ANNOTATIONS_STORE)) {
        const annotationsStore = db.createObjectStore(ANNOTATIONS_STORE, {
          keyPath: 'id',
          autoIncrement: false
        });
        annotationsStore.createIndex('video_url', 'video_url', { unique: false });
        annotationsStore.createIndex('timestamp', 'timestamp', { unique: false });
        annotationsStore.createIndex('name', 'name', { unique: false });
        annotationsStore.createIndex('text_content', 'text_content', { unique: false });
        annotationsStore.createIndex('created_at', 'created_at', { unique: false });
        annotationsStore.createIndex('is_live', 'is_live', { unique: false });
      } 
      // 版本升级：从1到2，添加动态涂鸦支持
      else if (oldVersion < 2) {
        const annotationsStore = transaction.objectStore(ANNOTATIONS_STORE);
        // 添加is_live索引（如果不存在）
        if (!annotationsStore.indexNames.contains('is_live')) {
          annotationsStore.createIndex('is_live', 'is_live', { unique: false });
        }
      }

      if (!db.objectStoreNames.contains(VIDEO_SEGMENTS_STORE)) {
        const segmentsStore = db.createObjectStore(VIDEO_SEGMENTS_STORE, {
          keyPath: 'id',
          autoIncrement: false
        });
        segmentsStore.createIndex('video_url', 'video_url', { unique: false });
        segmentsStore.createIndex('video_name', 'video_name', { unique: false });
        segmentsStore.createIndex('created_at', 'created_at', { unique: false });
      }
    };
  });
}

export async function addAnnotation(annotation: IndexedDBAnnotation): Promise<Annotation> {
  const db = await initDB();
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const fullAnnotation: Annotation = {
    ...annotation,
    id,
    created_at
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ANNOTATIONS_STORE], 'readwrite');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const request = store.add(fullAnnotation);

    request.onsuccess = () => {
      resolve(fullAnnotation);
    };

    request.onerror = () => {
      reject(new Error('Failed to add annotation'));
    };
  });
}

export async function getAnnotations(videoUrl?: string): Promise<Annotation[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ANNOTATIONS_STORE], 'readonly');
    const store = transaction.objectStore(ANNOTATIONS_STORE);

    let request: IDBRequest;

    if (videoUrl) {
      const index = store.index('video_url');
      request = index.getAll(videoUrl);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const results = request.result as Annotation[];
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };

    request.onerror = () => {
      reject(new Error('Failed to get annotations'));
    };
  });
}

export async function deleteAnnotation(id: string): Promise<boolean> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ANNOTATIONS_STORE], 'readwrite');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(new Error('Failed to delete annotation'));
    };
  });
}

export async function searchAnnotations(query: string): Promise<Annotation[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([ANNOTATIONS_STORE], 'readonly');
    const store = transaction.objectStore(ANNOTATIONS_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allAnnotations = request.result as Annotation[];
      const lowerQuery = query.toLowerCase();

      const filtered = allAnnotations.filter(annotation => {
        const nameMatch = annotation.name?.toLowerCase().includes(lowerQuery);
        const textMatch = annotation.text_content?.toLowerCase().includes(lowerQuery);
        return nameMatch || textMatch;
      });

      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      resolve(filtered);
    };

    request.onerror = () => {
      reject(new Error('Failed to search annotations'));
    };
  });
}

export async function addVideoSegment(segment: IndexedDBVideoSegment): Promise<VideoSegment> {
  const db = await initDB();
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const fullSegment: VideoSegment = {
    ...segment,
    id,
    created_at
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([VIDEO_SEGMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(VIDEO_SEGMENTS_STORE);
    const request = store.add(fullSegment);

    request.onsuccess = () => {
      resolve(fullSegment);
    };

    request.onerror = () => {
      reject(new Error('Failed to add video segment'));
    };
  });
}

export async function getVideoSegments(videoUrl?: string): Promise<VideoSegment[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([VIDEO_SEGMENTS_STORE], 'readonly');
    const store = transaction.objectStore(VIDEO_SEGMENTS_STORE);

    let request: IDBRequest;

    if (videoUrl) {
      const index = store.index('video_url');
      request = index.getAll(videoUrl);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const results = request.result as VideoSegment[];
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      resolve(results);
    };

    request.onerror = () => {
      reject(new Error('Failed to get video segments'));
    };
  });
}

export async function deleteVideoSegment(id: string): Promise<boolean> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([VIDEO_SEGMENTS_STORE], 'readwrite');
    const store = transaction.objectStore(VIDEO_SEGMENTS_STORE);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(new Error('Failed to delete video segment'));
    };
  });
}
