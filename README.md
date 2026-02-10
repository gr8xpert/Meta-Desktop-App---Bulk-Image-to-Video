# Meta Video Converter - Bulk Image to Video

A desktop application that converts images to AI-animated videos using Meta AI's image animation feature. Process multiple images in bulk with customizable animation presets.

## Features

- **Bulk Processing**: Convert multiple images to videos at once
- **Drag & Drop**: Easy file/folder selection with drag and drop support
- **Animation Presets**: Multiple built-in presets (Cinematic, Zoom, Pan, Parallax, etc.)
- **Custom Prompts**: Create your own animation styles with custom prompts
- **Progress Tracking**: Real-time progress with ETA estimation
- **Conversion History**: Track all conversions with retry option for failed ones
- **Headless Mode**: Run conversions in the background without browser window
- **Resume Support**: Continue interrupted conversions

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

1. Clone the repository:
```bash
git clone https://github.com/gr8xpert/Meta-Desktop-App---Bulk-Image-to-Video.git
cd Meta-Desktop-App---Bulk-Image-to-Video
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm start
```

4. Build portable executable:
```bash
npm run build:win
```

The portable `.exe` will be created in the `dist` folder.

## Configuration

### Meta AI Authentication

To use this app, you need to provide your Meta AI cookies:

1. Go to [meta.ai](https://www.meta.ai) and log in
2. Open DevTools (F12) → Application → Cookies → meta.ai
3. Copy the following cookie values:
   - `datr` (required)
   - `abra_sess` (required)
   - `wd` (optional)
   - `dpr` (optional)
4. Paste them in the Settings tab of the app
5. Click "Validate Cookies" to verify

## Usage

1. **Add Images**: Drag & drop images/folders or click "Select Files"/"Select Folder"
2. **Choose Output**: Select where to save the generated videos
3. **Select Preset**: Choose an animation style or create a custom prompt
4. **Start Conversion**: Click "Start Conversion" and wait for processing
5. **View Results**: Check the History tab for completed videos

## Animation Presets

| Preset | Description |
|--------|-------------|
| Cinematic | Smooth cinematic motion with dramatic camera movement |
| Zoom In | Slowly zoom into the center with subtle motion |
| Zoom Out | Slowly zoom out revealing more of the scene |
| Pan Left | Smooth horizontal pan from right to left |
| Pan Right | Smooth horizontal pan from left to right |
| Parallax | Depth effect with foreground/background moving differently |
| Floating | Gentle floating motion, dreamlike and ethereal |
| Dramatic | Dramatic slow motion with intense atmosphere |
| Nature | Natural movement like wind, water, or wildlife |
| Portrait | Subtle life-like motion for portraits |
| Custom | Your own custom animation prompt |

## Tech Stack

- **Electron** - Desktop application framework
- **Playwright** - Browser automation for Meta AI interaction
- **Node.js** - Backend runtime

## Project Structure

```
meta-video-converter-electron/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main process
│   │   ├── preload.js     # Preload script for IPC
│   │   ├── converter.js   # Meta AI automation logic
│   │   └── database.js    # SQLite database for history
│   └── renderer/
│       ├── index.html     # Main UI
│       ├── app.js         # Renderer process logic
│       └── styles.css     # UI styling
├── package.json
└── README.md
```

## Troubleshooting

### Cookies Invalid
- Make sure you're logged into Meta AI in your browser
- Copy the exact cookie values without any extra spaces
- Cookies may expire - refresh them if validation fails

### Conversion Fails
- Check your internet connection
- Meta AI may have rate limits - increase delay between files
- Try disabling headless mode in Settings

### Video Not Downloading
- The app uses multiple fallback download methods
- If headless mode fails, it will automatically retry with visible browser

## License

MIT License

## Author

**gr8xpert**

## Disclaimer

This tool is for personal use only. Please respect Meta AI's terms of service and usage limits.
