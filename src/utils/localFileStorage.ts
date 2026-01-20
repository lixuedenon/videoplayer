const DIRECTORY_HANDLE_KEY = 'video_annotation_directory_handle';
const PERMISSION_GRANTED_KEY = 'directory_permission_granted';

let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null;

export async function checkFileSystemSupport(): Promise<boolean> {
  return 'showDirectoryPicker' in window;
}

export async function requestDirectoryAccess(): Promise<FileSystemDirectoryHandle | null> {
  if (!checkFileSystemSupport()) {
    console.error('File System Access API is not supported');
    return null;
  }

  try {
    const dirHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'downloads'
    });

    cachedDirectoryHandle = dirHandle;

    try {
      const permissionStatus = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permissionStatus === 'granted') {
        localStorage.setItem(PERMISSION_GRANTED_KEY, 'true');
      }
    } catch (e) {
      console.warn('Could not request persistent permission:', e);
    }

    return dirHandle;
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Error requesting directory access:', error);
    }
    return null;
  }
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedDirectoryHandle) {
    try {
      const permissionStatus = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
      if (permissionStatus === 'granted') {
        return cachedDirectoryHandle;
      }
    } catch (e) {
      console.warn('Cached handle permission check failed:', e);
    }
  }

  return await requestDirectoryAccess();
}

export async function createVideoFolder(videoName: string): Promise<FileSystemDirectoryHandle | null> {
  const rootHandle = await getDirectoryHandle();
  if (!rootHandle) {
    return null;
  }

  try {
    const sanitizedName = sanitizeFileName(videoName);
    const videoFolder = await rootHandle.getDirectoryHandle(sanitizedName, { create: true });
    return videoFolder;
  } catch (error) {
    console.error('Error creating video folder:', error);
    return null;
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim();
}

export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}-${minutes.toString().padStart(2, '0')}-${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}-${secs.toString().padStart(2, '0')}`;
}

export async function saveScreenshot(
  videoName: string,
  timestamp: number,
  blob: Blob
): Promise<string | null> {
  try {
    const videoFolder = await createVideoFolder(videoName);
    if (!videoFolder) {
      throw new Error('Could not create video folder');
    }

    const filename = `${formatTimestamp(timestamp)}_screenshot.png`;
    const fileHandle = await videoFolder.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return `${sanitizeFileName(videoName)}/${filename}`;
  } catch (error) {
    console.error('Error saving screenshot:', error);
    return null;
  }
}

export async function saveVideoSegment(
  videoName: string,
  timestamp: number,
  blob: Blob
): Promise<string | null> {
  try {
    const videoFolder = await createVideoFolder(videoName);
    if (!videoFolder) {
      throw new Error('Could not create video folder');
    }

    const filename = `${formatTimestamp(timestamp)}_segment.webm`;
    const fileHandle = await videoFolder.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    return `${sanitizeFileName(videoName)}/${filename}`;
  } catch (error) {
    console.error('Error saving video segment:', error);
    return null;
  }
}

export async function readFile(filePath: string): Promise<File | null> {
  try {
    const rootHandle = await getDirectoryHandle();
    if (!rootHandle) {
      return null;
    }

    const parts = filePath.split('/');
    if (parts.length !== 2) {
      throw new Error('Invalid file path format');
    }

    const [folderName, fileName] = parts;
    const folderHandle = await rootHandle.getDirectoryHandle(folderName);
    const fileHandle = await folderHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();

    return file;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
}

export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    const rootHandle = await getDirectoryHandle();
    if (!rootHandle) {
      return false;
    }

    const parts = filePath.split('/');
    if (parts.length !== 2) {
      throw new Error('Invalid file path format');
    }

    const [folderName, fileName] = parts;
    const folderHandle = await rootHandle.getDirectoryHandle(folderName);
    await folderHandle.removeEntry(fileName);

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
}

export async function getFileURL(filePath: string): Promise<string | null> {
  try {
    const file = await readFile(filePath);
    if (!file) {
      return null;
    }

    return URL.createObjectURL(file);
  } catch (error) {
    console.error('Error creating file URL:', error);
    return null;
  }
}

export function hasDirectoryPermission(): boolean {
  return localStorage.getItem(PERMISSION_GRANTED_KEY) === 'true';
}

export function clearDirectoryPermission(): void {
  localStorage.removeItem(PERMISSION_GRANTED_KEY);
  cachedDirectoryHandle = null;
}
