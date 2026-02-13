# Meta Video Converter v3.22.0

A powerful desktop application that converts images to AI-animated videos, generates images from text prompts, provides advanced image editing capabilities, and bulk upscaling using AI.

## Features

### Image to Video Conversion
- **Bulk Processing**: Convert multiple images to videos at once
- **Drag & Drop**: Easy file/folder selection with drag and drop support
- **Animation Presets**: Multiple built-in presets (Cinematic, Zoom, Pan, Parallax, etc.)
- **Custom Prompts**: Create your own animation styles with custom prompts
- **Progress Tracking**: Real-time progress tracking with file-by-file status
- **Conversion History**: Track all conversions with retry option for failed ones
- **Headless Mode**: Run conversions in the background without browser window
- **Resume Support**: Continue interrupted conversions
- **Retry Downloads**: Retry failed video downloads without regenerating

### Text to Image Generation
- **AI Image Generation**: Generate images from text prompts using Meta AI
- **Aspect Ratio Support**: Choose from 16:9 (YouTube), 9:16 (Reels), or 1:1 (Instagram)
- **Style Presets**: Realistic, Artistic, Anime, 3D Render, Fantasy, Cinematic, Minimalist
- **Bulk Generation**: Queue multiple prompts and generate them all at once
- **Import Prompts**: Load prompts from a .txt file for batch processing
- **Optional Video Conversion**: Automatically convert generated images to videos

### Gallery
- **Media Browser**: View all generated images and videos in one place
- **Filter by Type**: Filter to show All, Images only, or Videos only
- **Quick Actions**: View, edit, open folder, or delete directly from thumbnails
- **Auto-refresh**: Gallery updates automatically when new content is created

### Image Editor
Full-featured image editor accessible from the Gallery:

#### Adjustments
- **Brightness**: Adjust image brightness (0-200%)
- **Contrast**: Adjust image contrast (0-200%)
- **Saturation**: Adjust color saturation (0-200%)
- **Sharpness**: Sharpen images (0-10)
- **Blur**: Apply gaussian blur (0-10)

#### Filters
- **Grayscale**: Convert to black and white
- **Sepia**: Apply vintage sepia tone
- **Negative/Invert**: Invert all colors

#### Transform
- **Rotate**: Rotate 90° left, 90° right, or 180°
- **Flip**: Flip horizontally or vertically
- **Resize**: Custom dimensions with aspect ratio lock

#### Export Options
- **Format Selection**: Save as JPEG, PNG, or WebP
- **Quality Control**: Adjustable quality slider (10-100%)
- **Watermark**: Add custom text watermark with size and opacity controls
- **Quick Thumbnails**: Generate multiple social media sizes at once:
  - YouTube (1280x720)
  - Instagram (1080x1080)
  - Twitter (1200x675)
  - Facebook (1200x630)

#### Editor Presets
- **Save Presets**: Save your adjustment settings for reuse
- **Load Presets**: Quickly apply saved settings
- **Before/After**: Compare slider to see original vs edited

### Bulk Upscale (NEW in v3.22.0)
Dedicated tab for batch AI upscaling multiple images:

- **Drag & Drop**: Add multiple images at once
- **AI Upscaling**: High-quality enhancement using Real-ESRGAN
- **Scale Factors**: 2x, 3x, or 4x enlargement
- **Output Format**: Same as original, PNG, JPG, or WebP
- **Progress Tracking**: Real-time progress with per-file status
- **Batch Processing**: Process entire folders of images

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

To use the image/video generation features, you need to provide your Meta AI cookies:

1. Go to [meta.ai](https://www.meta.ai) and log in
2. Open DevTools (F12) → Application → Cookies → meta.ai
3. Copy the following cookie values:
   - `datr` (required)
   - `abra_sess` (required)
4. Paste them in the Settings tab of the app
5. Click "Validate Cookies" to verify

**Note**: Image editing, gallery, and bulk upscale features work without Meta AI authentication.

## Usage

### Image to Video Conversion
1. **Add Images**: Drag & drop images/folders or click "Select Files"/"Select Folder"
2. **Choose Output**: Select where to save the generated videos
3. **Select Preset**: Choose an animation style or create a custom prompt
4. **Start Conversion**: Click "Start Conversion" and wait for processing
5. **View Results**: Check the History tab or Gallery for completed videos

### Text to Image Generation
1. **Go to "Text to Image" tab**
2. **Enter Prompt**: Describe the image you want to generate
3. **Select Style**: Choose a style preset or "None" for exact prompt
4. **Choose Aspect Ratio**: 16:9, 9:16, or 1:1
5. **Add to Queue**: Click "Add to Queue" (or import from .txt file)
6. **Generate**: Click "Start Generation" to process all prompts
7. **Optional**: Enable "Convert to Video" to also animate the generated images

### Bulk Upscaling
1. **Go to "Upscale" tab**
2. **Add Images**: Drag & drop or select files/folder
3. **Choose Method**: Basic (fast) or AI/Real-ESRGAN (best quality)
4. **Select Scale**: 2x, 3x, or 4x
5. **Set Output**: Choose output folder and format
6. **Start**: Click "Start Upscaling"

### Image Editing
1. **Go to "Gallery" tab**
2. **Click Edit**: Hover over an image and click the edit (pencil) icon
3. **Make Adjustments**: Use sliders, filters, transform tools
4. **Preview**: Toggle "Before/After" to compare changes
5. **Save**: Click "Save" to overwrite or "Save as New" for a copy

## Animation Presets (Image to Video)

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

## Style Presets (Text to Image)

| Preset | Prefix Added to Prompt |
|--------|------------------------|
| Realistic Photo | "Photorealistic image of " |
| Artistic | "Artistic illustration of " |
| Anime Style | "Anime style image of " |
| 3D Render | "3D rendered image of " |
| Fantasy Art | "Fantasy art of " |
| Cinematic | "Cinematic shot of " |
| Minimalist | "Minimalist design of " |
| None | No prefix - uses your exact prompt |

## Tech Stack

- **Electron** - Desktop application framework
- **Playwright** - Browser automation for Meta AI interaction
- **Sharp** - Image processing and manipulation
- **Real-ESRGAN** - AI-powered image upscaling
- **SQLite** - Local database for history
- **Node.js** - Backend runtime

## Project Structure

```
meta-video-converter-electron/
├── assets/
│   ├── realesrgan/          # Real-ESRGAN binaries and models
│   └── icon.ico             # App icon
├── src/
│   ├── main/
│   │   ├── main.js          # Electron main process & IPC handlers
│   │   ├── preload.js       # Preload script for IPC bridge
│   │   ├── converter.js     # Meta AI automation logic
│   │   └── database.js      # SQLite database for history
│   └── renderer/
│       ├── index.html       # Main UI with all tabs
│       ├── app.js           # Renderer process logic
│       └── styles.css       # UI styling (glassmorphic dark theme)
├── dist/                    # Build output
├── package.json
└── README.md
```

## Changelog

### v3.22.0
- Added **Bulk Upscale** tab for batch image upscaling
- Support for Basic (Lanczos3) and AI (Real-ESRGAN) upscaling methods
- Scale factors: 2x, 3x, 4x
- Output format selection (same/PNG/JPG/WebP)
- Progress tracking with per-file status

### v3.21.x
- Added **Gallery** tab with media browser
- Added **Image Editor** with adjustments, filters, transform, upscale
- Added **Before/After** compare slider
- Added **Watermark** support
- Added **Quick Thumbnails** generation
- Added **Editor Presets** save/load
- Fixed AI upscale artifacts with proper model selection
- Fixed file locking issues on Windows
- Fixed gallery thumbnail overlapping

### v3.20.x
- Added **Text to Image** generation
- Aspect ratio support (16:9, 9:16, 1:1)
- Style presets for image generation
- Bulk prompt import from .txt files
- Optional automatic video conversion

### v3.1x.x
- Initial bulk image to video conversion
- Animation presets
- Retry downloads feature
- Headless mode
- Conversion history with retry

## Troubleshooting

### Cookies Invalid
- Make sure you're logged into Meta AI in your browser
- Copy the exact cookie values without any extra spaces
- Cookies may expire - refresh them if validation fails

### Conversion Fails
- Check your internet connection
- Meta AI may have rate limits - increase delay between files (Settings)
- Try disabling headless mode in Settings

### AI Upscale Not Working
- Real-ESRGAN binaries are bundled with the app
- Make sure the `assets/realesrgan` folder contains the executable
- Check that your GPU drivers are up to date (Vulkan support required)

### Video Not Downloading
- The app uses multiple fallback download methods
- Click "Retry Downloads" for failed downloads
- If URL expired, use "Retry Generation" to regenerate

## License

MIT License

## Author

**gr8xpert** (Shahzaib Aslam)

## Disclaimer

This tool is for personal use only. Please respect Meta AI's terms of service and usage limits.
