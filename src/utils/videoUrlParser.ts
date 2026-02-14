// 视频URL解析工具 - 识别不同视频平台并提取嵌入信息

export type VideoType = 'direct' | 'youtube' | 'vimeo' | 'bilibili' | 'dailymotion' | 'unknown';

export interface ParsedVideoUrl {
  type: VideoType;
  originalUrl: string;
  embedUrl?: string;
  videoId?: string;
  platform?: string;
  isEmbeddable: boolean;
}

/**
 * 解析YouTube URL
 * 支持格式:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 */
function parseYouTubeUrl(url: string): ParsedVideoUrl | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        type: 'youtube',
        originalUrl: url,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        videoId,
        platform: 'YouTube',
        isEmbeddable: true
      };
    }
  }

  return null;
}

/**
 * 解析Vimeo URL
 * 支持格式:
 * - https://vimeo.com/VIDEO_ID
 * - https://player.vimeo.com/video/VIDEO_ID
 */
function parseVimeoUrl(url: string): ParsedVideoUrl | null {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        type: 'vimeo',
        originalUrl: url,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
        videoId,
        platform: 'Vimeo',
        isEmbeddable: true
      };
    }
  }

  return null;
}

/**
 * 解析Bilibili URL
 * 支持格式:
 * - https://www.bilibili.com/video/BV...
 * - https://www.bilibili.com/video/av...
 * - https://b23.tv/... (短链接)
 */
function parseBilibiliUrl(url: string): ParsedVideoUrl | null {
  const patterns = [
    /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/,
    /bilibili\.com\/video\/(av\d+)/,
    /b23\.tv\/([a-zA-Z0-9]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      // Bilibili的嵌入支持有限，但可以尝试
      let embedUrl = url;

      if (videoId.startsWith('BV') || videoId.startsWith('av')) {
        embedUrl = `https://player.bilibili.com/player.html?bvid=${videoId}&page=1&high_quality=1`;
      }

      return {
        type: 'bilibili',
        originalUrl: url,
        embedUrl,
        videoId,
        platform: 'Bilibili',
        isEmbeddable: true
      };
    }
  }

  return null;
}

/**
 * 解析Dailymotion URL
 * 支持格式:
 * - https://www.dailymotion.com/video/VIDEO_ID
 * - https://dai.ly/VIDEO_ID
 */
function parseDailymotionUrl(url: string): ParsedVideoUrl | null {
  const patterns = [
    /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
    /dai\.ly\/([a-zA-Z0-9]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        type: 'dailymotion',
        originalUrl: url,
        embedUrl: `https://www.dailymotion.com/embed/video/${videoId}`,
        videoId,
        platform: 'Dailymotion',
        isEmbeddable: true
      };
    }
  }

  return null;
}

/**
 * 检查是否是直接视频文件URL
 */
function isDirectVideoUrl(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
  const lowerUrl = url.toLowerCase();

  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

/**
 * 主解析函数 - 识别视频URL类型
 */
export function parseVideoUrl(url: string): ParsedVideoUrl {
  if (!url) {
    return {
      type: 'unknown',
      originalUrl: url,
      isEmbeddable: false
    };
  }

  // 检查是否是直接视频文件
  if (isDirectVideoUrl(url)) {
    return {
      type: 'direct',
      originalUrl: url,
      isEmbeddable: false
    };
  }

  // 尝试解析各种平台
  const parsers = [
    parseYouTubeUrl,
    parseVimeoUrl,
    parseBilibiliUrl,
    parseDailymotionUrl
  ];

  for (const parser of parsers) {
    const result = parser(url);
    if (result) {
      return result;
    }
  }

  // 未识别的URL，尝试作为直接视频处理
  return {
    type: 'direct',
    originalUrl: url,
    isEmbeddable: false
  };
}

/**
 * 获取支持的平台列表（用于UI提示）
 */
export function getSupportedPlatforms(): Array<{
  name: string;
  examples: string[];
  features: string[];
}> {
  return [
    {
      name: 'YouTube',
      examples: [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ'
      ],
      features: ['嵌入播放', '基本控制']
    },
    {
      name: 'Vimeo',
      examples: [
        'https://vimeo.com/123456789'
      ],
      features: ['嵌入播放', '高质量视频']
    },
    {
      name: 'Bilibili',
      examples: [
        'https://www.bilibili.com/video/BV1xx411c7XZ',
        'https://www.bilibili.com/video/av123456'
      ],
      features: ['嵌入播放', '弹幕支持']
    },
    {
      name: 'Dailymotion',
      examples: [
        'https://www.dailymotion.com/video/x8abcde',
        'https://dai.ly/x8abcde'
      ],
      features: ['嵌入播放']
    },
    {
      name: '直接视频文件',
      examples: [
        'https://example.com/video.mp4',
        'https://example.com/video.webm'
      ],
      features: ['完整功能', '涂鸦', '截图', '录制']
    }
  ];
}

/**
 * 检查URL是否支持完整功能（涂鸦、截图等）
 */
export function supportsFullFeatures(videoType: VideoType): boolean {
  return videoType === 'direct';
}

/**
 * 获取平台功能限制说明
 */
export function getPlatformLimitations(videoType: VideoType): string[] {
  switch (videoType) {
    case 'youtube':
    case 'vimeo':
    case 'bilibili':
    case 'dailymotion':
      return [
        '⚠️ 嵌入式播放器功能受限',
        '❌ 无法使用涂鸦功能',
        '❌ 无法截图和录制',
        '❌ 精确时间控制受限',
        '✅ 可以正常播放'
      ];
    case 'direct':
      return ['✅ 支持所有功能'];
    default:
      return ['⚠️ 未知视频类型，可能无法播放'];
  }
}
