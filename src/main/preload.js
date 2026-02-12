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
  saveEditedImage: (data) => ipcRenderer.invoke('save-edited-image', data)
});
