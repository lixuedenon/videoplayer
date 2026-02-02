// src/components/ButtonCustomizationSettings.tsx
// 按钮自定义设置组件 - 整合所有设置项（按钮、录制、回放）

import React, { useState, useEffect } from 'react';
import { X, Settings, Mic, MicOff } from 'lucide-react';
import { ToggleMode, ButtonShape } from '../types/buttonCustomization';
import { getButtonSettings, saveButtonSettings } from '../utils/buttonCustomization';
import { VideoSegmentSettings } from '../types/videoSegment';
import { saveVideoSegmentSettings } from '../utils/database';

type RecordingMode = 'player' | 'screen';

interface ButtonCustomizationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: () => void;
  // 录制设置相关
  recordingMode: RecordingMode;
  setRecordingMode: (mode: RecordingMode) => void;
  includeMicrophone: boolean;
  setIncludeMicrophone: (value: boolean) => void;
  // 回放设置相关
  replayBufferBefore: number;
  setReplayBufferBefore: (value: number) => void;
  replayBufferAfter: number;
  setReplayBufferAfter: (value: number) => void;
  videoSegmentSettings: VideoSegmentSettings;
  setVideoSegmentSettings: (settings: VideoSegmentSettings) => void;
}

export const ButtonCustomizationSettings: React.FC<ButtonCustomizationSettingsProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
  recordingMode,
  setRecordingMode,
  includeMicrophone,
  setIncludeMicrophone,
  replayBufferBefore,
  setReplayBufferBefore,
  replayBufferAfter,
  setReplayBufferAfter,
  videoSegmentSettings,
  setVideoSegmentSettings
}) => {
  const [activeTab, setActiveTab] = useState<'button' | 'recording' | 'replay'>('button');
  const [mode, setMode] = useState<ToggleMode>(null);
  const [autoInterval, setAutoInterval] = useState(5);
  const [staggerInterval, setStaggerInterval] = useState(0.5);
  const [shape, setShape] = useState<ButtonShape>('circle');
  const [isLoading, setIsLoading] = useState(true);
  
  // 临时状态
  const [tempRecordingMode, setTempRecordingMode] = useState<RecordingMode>('player');
  const [tempIncludeMicrophone, setTempIncludeMicrophone] = useState(false);
  const [tempReplayBufferBefore, setTempReplayBufferBefore] = useState(10);
  const [tempReplayBufferAfter, setTempReplayBufferAfter] = useState(5);
  const [tempVideoSegmentSettings, setTempVideoSegmentSettings] = useState<VideoSegmentSettings>({
    beforeBuffer: 15,
    afterBuffer: 20,
    syncWithReplay: false
  });

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    const settings = await getButtonSettings();
    if (settings) {
      setMode(settings.mode);
      setAutoInterval(settings.auto_interval);
      setStaggerInterval(settings.stagger_interval ?? 0.5);
      setShape(settings.shape);
    }
    
    // 加载录制和回放设置
    setTempRecordingMode(recordingMode);
    setTempIncludeMicrophone(includeMicrophone);
    setTempReplayBufferBefore(replayBufferBefore);
    setTempReplayBufferAfter(replayBufferAfter);
    setTempVideoSegmentSettings(videoSegmentSettings);
    
    setIsLoading(false);
  };

  const handleSave = async () => {
    // 保存按钮设置
    await saveButtonSettings(mode, autoInterval, shape, staggerInterval);
    
    // 保存录制设置
    setRecordingMode(tempRecordingMode);
    setIncludeMicrophone(tempIncludeMicrophone);
    
    // 保存回放设置
    setReplayBufferBefore(tempReplayBufferBefore);
    setReplayBufferAfter(tempReplayBufferAfter);
    localStorage.setItem('replayBufferBefore', tempReplayBufferBefore.toString());
    localStorage.setItem('replayBufferAfter', tempReplayBufferAfter.toString());
    
    // 保存视频片段设置
    setVideoSegmentSettings(tempVideoSegmentSettings);
    await saveVideoSegmentSettings(tempVideoSegmentSettings);
    
    onSettingsChange();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="text-blue-400" size={24} />
            <h2 className="text-white text-xl font-bold">设置</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="关闭"
          >
            <X size={24} />
          </button>
        </div>

        {/* 标签页导航 */}
        <div className="flex border-b border-gray-700 flex-shrink-0">
          <button
            onClick={() => setActiveTab('button')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'button'
                ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            按钮设置
          </button>
          <button
            onClick={() => setActiveTab('recording')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'recording'
                ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            录制设置
          </button>
          <button
            onClick={() => setActiveTab('replay')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'replay'
                ? 'text-white bg-gray-800 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            回放设置
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="text-white text-center py-4">加载中...</div>
          ) : (
            <>
              {/* 按钮设置标签页 */}
              {activeTab === 'button' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-white text-sm font-medium mb-3">
                      切换模式
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === null}
                          onChange={() => setMode(null)}
                          className="w-4 h-4"
                        />
                        <span>禁用</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === 'auto'}
                          onChange={() => setMode('auto')}
                          className="w-4 h-4"
                        />
                        <span>自动切换</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                        <input
                          type="radio"
                          name="mode"
                          checked={mode === 'click'}
                          onChange={() => setMode('click')}
                          className="w-4 h-4"
                        />
                        <span>点击切换</span>
                      </label>
                    </div>
                  </div>

                  {mode === 'auto' && (
                    <>
                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          自动切换间隔
                        </label>
                        <select
                          value={autoInterval}
                          onChange={(e) => setAutoInterval(Number(e.target.value))}
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                          <option value={0.167}>10 秒</option>
                          <option value={1}>1 分钟</option>
                          <option value={3}>3 分钟</option>
                          <option value={5}>5 分钟</option>
                          <option value={10}>10 分钟</option>
                          <option value={15}>15 分钟</option>
                          <option value={30}>30 分钟</option>
                          <option value={45}>45 分钟</option>
                          <option value={60}>60 分钟</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-white text-sm font-medium mb-2">
                          交错动画间隔
                        </label>
                        <select
                          value={staggerInterval}
                          onChange={(e) => setStaggerInterval(Number(e.target.value))}
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                        >
                          <option value={0.3}>0.3 秒</option>
                          <option value={0.5}>0.5 秒</option>
                          <option value={0.8}>0.8 秒</option>
                          <option value={1}>1 秒</option>
                          <option value={1.5}>1.5 秒</option>
                          <option value={2}>2 秒</option>
                        </select>
                        <p className="text-gray-400 text-xs mt-1">
                          动画期间每个按钮切换的延迟时间
                        </p>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-white text-sm font-medium mb-2">
                      按钮形状
                    </label>
                    <select
                      value={shape}
                      onChange={(e) => setShape(e.target.value as ButtonShape)}
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="circle">圆形</option>
                      <option value="ellipse">椭圆</option>
                      <option value="rounded-rect">圆角矩形</option>
                    </select>
                  </div>
                </div>
              )}

              {/* 录制设置标签页 */}
              {activeTab === 'recording' && (
                <div className="space-y-6">
                  <div>
                    <label className="text-white text-sm font-medium mb-3 block">
                      录制模式
                    </label>
                    <select
                      value={tempRecordingMode}
                      onChange={(e) => setTempRecordingMode(e.target.value as RecordingMode)}
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="player">播放器+涂鸦</option>
                      <option value="screen">屏幕录制</option>
                    </select>
                    <p className="text-gray-400 text-xs mt-2">
                      {tempRecordingMode === 'player' 
                        ? '录制播放器内容和涂鸦标注，适合制作教学视频' 
                        : '录制整个屏幕或窗口，可录制YouTube等任意内容'}
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempIncludeMicrophone}
                        onChange={(e) => setTempIncludeMicrophone(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-gray-300 text-sm flex items-center gap-2">
                        {tempIncludeMicrophone ? <Mic size={16} /> : <MicOff size={16} />}
                        录制麦克风音频
                      </span>
                    </label>
                  </div>

                  <div className="bg-gray-800 rounded p-4 text-xs text-gray-400">
                    <p className="mb-1">💡 使用说明：</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>播放器+涂鸦</strong>：录制视频画面和涂鸦标注</li>
                      <li><strong>屏幕录制</strong>：可录制浏览器外的任意内容</li>
                      <li>麦克风权限可能需要浏览器授权</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* 回放设置标签页 */}
              {activeTab === 'replay' && (
                <div className="space-y-6">
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">
                      涂鸦回放缓冲设置
                    </label>
                    <p className="text-gray-400 text-xs mb-3">
                      点击涂鸦列表中的标注时，视频将从标注前{tempReplayBufferBefore}秒开始播放，直到标注后{tempReplayBufferAfter}秒后暂停
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-gray-300 text-xs mb-2 block">回放前缓冲时间</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="300"
                            step="1"
                            value={tempReplayBufferBefore}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setTempReplayBufferBefore(val);
                              if (tempVideoSegmentSettings.syncWithReplay) {
                                setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, beforeBuffer: val });
                              }
                            }}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              value={tempReplayBufferBefore}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(300, parseFloat(e.target.value) || 0));
                                setTempReplayBufferBefore(val);
                                if (tempVideoSegmentSettings.syncWithReplay) {
                                  setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, beforeBuffer: val });
                                }
                              }}
                              className="w-16 px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 outline-none"
                            />
                            <span className="text-white text-sm">秒</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-gray-300 text-xs mb-2 block">回放后缓冲时间</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="300"
                            step="1"
                            value={tempReplayBufferAfter}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setTempReplayBufferAfter(val);
                              if (tempVideoSegmentSettings.syncWithReplay) {
                                setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, afterBuffer: val });
                              }
                            }}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              value={tempReplayBufferAfter}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(300, parseFloat(e.target.value) || 0));
                                setTempReplayBufferAfter(val);
                                if (tempVideoSegmentSettings.syncWithReplay) {
                                  setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, afterBuffer: val });
                                }
                              }}
                              className="w-16 px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 outline-none"
                            />
                            <span className="text-white text-sm">秒</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4">
                    <label className="text-white text-sm font-medium mb-2 block">
                      视频片段保存设置
                    </label>
                    <p className="text-gray-400 text-xs mb-3">
                      点击涂鸦画布中的紫色时钟按钮保存视频片段时，自动添加的前后缓冲时间
                    </p>

                    <label className="flex items-center gap-2 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempVideoSegmentSettings.syncWithReplay || false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setTempVideoSegmentSettings({
                            ...tempVideoSegmentSettings,
                            syncWithReplay: checked,
                            beforeBuffer: checked ? tempReplayBufferBefore : tempVideoSegmentSettings.beforeBuffer,
                            afterBuffer: checked ? tempReplayBufferAfter : tempVideoSegmentSettings.afterBuffer
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 text-sm">与回放时间保持一致</span>
                    </label>

                    <div className={`space-y-4 ${tempVideoSegmentSettings.syncWithReplay ? 'opacity-50' : ''}`}>
                      <div>
                        <label className="text-gray-300 text-xs mb-2 block">前缓冲时间</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="300"
                            step="1"
                            value={tempVideoSegmentSettings.syncWithReplay ? tempReplayBufferBefore : tempVideoSegmentSettings.beforeBuffer}
                            onChange={(e) => {
                              if (!tempVideoSegmentSettings.syncWithReplay) {
                                setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, beforeBuffer: Number(e.target.value) });
                              }
                            }}
                            disabled={tempVideoSegmentSettings.syncWithReplay}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              value={tempVideoSegmentSettings.syncWithReplay ? tempReplayBufferBefore : tempVideoSegmentSettings.beforeBuffer}
                              onChange={(e) => {
                                if (!tempVideoSegmentSettings.syncWithReplay) {
                                  const val = Math.max(0, Math.min(300, Number(e.target.value) || 0));
                                  setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, beforeBuffer: val });
                                }
                              }}
                              disabled={tempVideoSegmentSettings.syncWithReplay}
                              className="w-16 px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 outline-none disabled:cursor-not-allowed"
                            />
                            <span className="text-white text-sm">秒</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-gray-300 text-xs mb-2 block">后缓冲时间</label>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="300"
                            step="1"
                            value={tempVideoSegmentSettings.syncWithReplay ? tempReplayBufferAfter : tempVideoSegmentSettings.afterBuffer}
                            onChange={(e) => {
                              if (!tempVideoSegmentSettings.syncWithReplay) {
                                setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, afterBuffer: Number(e.target.value) });
                              }
                            }}
                            disabled={tempVideoSegmentSettings.syncWithReplay}
                            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="flex items-center gap-1 min-w-[80px]">
                            <input
                              type="number"
                              min="0"
                              max="300"
                              value={tempVideoSegmentSettings.syncWithReplay ? tempReplayBufferAfter : tempVideoSegmentSettings.afterBuffer}
                              onChange={(e) => {
                                if (!tempVideoSegmentSettings.syncWithReplay) {
                                  const val = Math.max(0, Math.min(300, Number(e.target.value) || 0));
                                  setTempVideoSegmentSettings({ ...tempVideoSegmentSettings, afterBuffer: val });
                                }
                              }}
                              disabled={tempVideoSegmentSettings.syncWithReplay}
                              className="w-16 px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600 focus:border-blue-500 outline-none disabled:cursor-not-allowed"
                            />
                            <span className="text-white text-sm">秒</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded p-3 text-xs text-gray-400">
                    <p className="mb-1">💡 使用说明：</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>回放缓冲</strong>：点击涂鸦列表中的标注时，可设置向前回放和向后播放的时间</li>
                      <li><strong>片段保存</strong>：点击涂鸦画布中紫色时钟按钮时，可设置保存片段的前后范围</li>
                      <li><strong>手动保存</strong>：橙色摄像机按钮可手动选择任意保存范围</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex gap-3 p-6 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
          >
            保存设置
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};