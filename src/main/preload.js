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
  closeWindow: () => ipcRenderer.invoke('close-window')
});
