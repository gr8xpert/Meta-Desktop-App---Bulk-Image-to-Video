const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Config
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // File dialogs
  selectFolder: (type) => ipcRenderer.invoke('select-folder', type),
  selectFiles: () => ipcRenderer.invoke('select-files'),

  // Scanning
  scanFolder: (path, includeSubfolders) => ipcRenderer.invoke('scan-folder', path, includeSubfolders),
  getThumbnail: (path) => ipcRenderer.invoke('get-thumbnail', path),

  // Cookies
  validateCookies: (cookies) => ipcRenderer.invoke('validate-cookies', cookies),

  // Conversion
  startConversion: (options) => ipcRenderer.invoke('start-conversion', options),
  stopConversion: () => ipcRenderer.invoke('stop-conversion'),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (event, data) => callback(data)),

  // History
  getHistory: (options) => ipcRenderer.invoke('get-history', options),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Resume
  getResumeData: () => ipcRenderer.invoke('get-resume-data'),
  saveResumeData: (data) => ipcRenderer.invoke('save-resume-data', data),

  // Utilities
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  showInFolder: (path) => ipcRenderer.invoke('show-in-folder', path),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  getPresets: () => ipcRenderer.invoke('get-presets'),
  fileExists: (path) => ipcRenderer.invoke('file-exists', path),

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // Retry download
  retryDownload: (data) => ipcRenderer.invoke('retry-download', data),

  // Text-to-Image
  startTTIGeneration: (options) => ipcRenderer.invoke('start-tti-generation', options),
  stopTTIGeneration: () => ipcRenderer.invoke('stop-tti-generation'),
  onTTIProgress: (callback) => ipcRenderer.on('tti-progress', (event, data) => callback(data)),
  getTTIPresets: () => ipcRenderer.invoke('get-tti-presets'),
  importPromptsFile: () => ipcRenderer.invoke('import-prompts-file'),

  // Gallery
  scanGallery: (folderPath) => ipcRenderer.invoke('scan-gallery', folderPath),
  deleteGalleryItem: (filePath) => ipcRenderer.invoke('delete-gallery-item', filePath),

  // Image Editing
  loadImageForEdit: (imagePath) => ipcRenderer.invoke('load-image-for-edit', imagePath),
  previewImageEdit: (data) => ipcRenderer.invoke('preview-image-edit', data),
  saveEditedImage: (data) => ipcRenderer.invoke('save-edited-image', data),

  // Advanced Image Editing
  rotateImage: (data) => ipcRenderer.invoke('rotate-image', data),
  flipImage: (data) => ipcRenderer.invoke('flip-image', data),
  cropImage: (data) => ipcRenderer.invoke('crop-image', data),
  resizeImage: (data) => ipcRenderer.invoke('resize-image', data),
  addWatermark: (data) => ipcRenderer.invoke('add-watermark', data),
  exportImage: (data) => ipcRenderer.invoke('export-image', data),

  // Upscaling
  upscaleBasic: (data) => ipcRenderer.invoke('upscale-basic', data),
  upscaleAI: (data) => ipcRenderer.invoke('upscale-ai', data),
  checkRealesrgan: () => ipcRenderer.invoke('check-realesrgan'),
  installRealesrgan: () => ipcRenderer.invoke('install-realesrgan'),
  onRealesrganProgress: (callback) => ipcRenderer.on('realesrgan-progress', (e, data) => callback(data)),

  // Presets
  savePreset: (data) => ipcRenderer.invoke('save-preset', data),
  loadPresets: () => ipcRenderer.invoke('load-presets'),
  deletePreset: (data) => ipcRenderer.invoke('delete-preset', data),

  // Batch & Thumbnails
  generateThumbnails: (data) => ipcRenderer.invoke('generate-thumbnails', data),
  batchEditImages: (data) => ipcRenderer.invoke('batch-edit-images', data),
  onBatchEditProgress: (callback) => ipcRenderer.on('batch-edit-progress', (e, data) => callback(data)),

  // Bulk Upscale
  startBulkUpscale: (options) => ipcRenderer.invoke('start-bulk-upscale', options),
  stopBulkUpscale: () => ipcRenderer.invoke('stop-bulk-upscale'),
  onBulkUpscaleProgress: (callback) => ipcRenderer.on('bulk-upscale-progress', (e, data) => callback(data)),

  // Video Editor
  selectVideos: () => ipcRenderer.invoke('select-videos'),
  selectAudio: () => ipcRenderer.invoke('select-audio'),
  getVideoInfo: (path) => ipcRenderer.invoke('get-video-info', path),
  generateCaptions: (videoPaths) => ipcRenderer.invoke('generate-captions', videoPaths),
  exportVideo: (options) => ipcRenderer.invoke('export-video', options),
  cancelVideoExport: () => ipcRenderer.invoke('cancel-video-export'),
  onVideoExportProgress: (callback) => ipcRenderer.on('video-export-progress', (e, data) => callback(data))
});
