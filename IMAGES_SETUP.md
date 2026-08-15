# NewlyNow Store - Images Setup Guide

Complete guide for downloading, managing, and integrating 1000+ images from Google Drive into the NewlyNow store.

## Current Status

✅ **Infrastructure Ready:**
- 40 base images downloaded and cataloged
- Animation framework (scroll-reveal, parallax, stagger effects)
- Video banner system for trx-1.mp4
- Image manager with smart distribution
- Manifest system (JSON) for image tracking

## How to Download Bulk Images

### Option 1: Using Direct Drive URLs (Recommended)

1. **Get the Drive Folder ID:**
   - Open the Drive folder in a browser
   - Copy the folder ID from the URL: `https://drive.google.com/drive/folders/{FOLDER_ID}`

2. **Generate Direct Download Links:**
   ```bash
   # Export all file IDs from the Drive folder
   # Create a file named urls.txt with one URL per line:
   # Format: https://drive.google.com/uc?export=download&id={FILE_ID}
   ```

3. **Run the download:**
   ```bash
   python3 download-manager.py --urls urls.txt
   ```

### Option 2: Using Google Drive CLI

```bash
# Install gdrive CLI
go install github.com/prasmussen/gdrive@latest

# Download recursively to assets/store
gdrive download --recursive {FOLDER_ID} --path assets/store
```

### Option 3: Manual Download

1. Open the Drive folder
2. Select all images (Ctrl/Cmd+A)
3. Download as ZIP
4. Extract to `assets/store/`
5. Run: `python3 download-manager.py --scan`

### Option 4: Using curl with Drive Share Link

```bash
# For a Drive folder shared publicly
curl -L "https://drive.google.com/uc?export=download&id={FILE_ID}" -o assets/store/image.jpg
```

## After Downloading Images

### 1. Scan and Categorize

```bash
# Automatically scan and create manifest
python3 download-manager.py --scan
```

This will:
- Scan all images in `assets/store/`
- Categorize by size (pool: <100KB, big: 100KB+)
- Generate `manifest.json`

### 2. Distribution

The `image-manager.js` automatically:
- Loads manifest.json
- Distributes images across 12 categories evenly
- Applies images to service cards
- Preloads first batch for performance

### 3. Update Categories with Images

Add `data-category` attribute to service cards:

```html
<!-- In category.html -->
<div class="cat glass" data-category="facebook">
  <div class="cat-ico"></div>
  <h3>متابعين فيسبوك</h3>
  <p>1000 متابع حقيقي</p>
</div>
```

## Image Categories

The store has 12 main categories:

1. **facebook** - Facebook services (followers, likes, views)
2. **instagram** - Instagram services
3. **tiktok** - TikTok services
4. **youtube** - YouTube services
5. **telegram** - Telegram services
6. **snapchat** - Snapchat services
7. **ai** - AI services (ChatGPT, Claude, etc.)
8. **subscriptions** - Digital subscriptions
9. **games** - Game recharges
10. **design** - Design services
11. **programming** - Programming services
12. **finance** - Financial services

## Image Organization

### Pool Images (Product Cards)
- Size: Typically 500x500px
- Use: Service cards, category tiles
- Distribution: Evenly across categories
- Quantity: ~40 per category (optimal)

### Big Images (Banners)
- Size: 800x600px or larger
- Use: Section banners, hero backgrounds
- Special: Can use trx-1.mp4 for animated banners

## Integration Points

### 1. **index.html** (Homepage Categories)
```html
<div class="cat glass" data-category="facebook">
  <div class="cat-ico"></div> <!-- Image loads here -->
</div>
```

### 2. **category.html** (Service Listings)
```html
<a class="cat glass" data-category="instagram">
  <div class="cat-ico"></div> <!-- Random category image -->
</a>
```

### 3. **service.html** (Product Gallery)
```html
<div class="svc-gallery">
  <div class="svc-main-img"></div> <!-- Main product image -->
  <div class="svc-thumbs"></div> <!-- Thumbnail gallery -->
</div>
```

## Animation Features (Already Enabled)

### ✅ Scroll Reveal
- Elements fade in as they come into view
- Configurable delay and timing
- Respects `prefers-reduced-motion`

### ✅ Parallax
- Images move at different speeds on scroll
- Applied via `data-parallax="0.5"` attribute

### ✅ Stagger Animation
- Grid items appear one after another
- Applied via `data-stagger` on containers

### ✅ Hover Effects
- Lift and scale on hover
- Smooth transitions
- No emojis or reactions (clean professional look)

## Video Banner Integration

The `video-banner.js` handles:
- Background video with fallback
- Auto-play/loop/muted (mobile-safe)
- Parallax effect on scroll
- Responsive sizing

### Usage

```html
<!-- Hero with video banner -->
<header class="hero" id="hero" data-banner-video="assets/trx-1.mp4">
  <!-- Content goes here -->
</header>
```

Or programmatically:
```javascript
VideoBanner.setup('.hero', 'assets/trx-1.mp4');
```

## Performance Tips

1. **Image Optimization:**
   - Keep pool images under 100KB
   - Use WEBP or modern formats when possible
   - Lazy load images below the fold

2. **Manifest Caching:**
   - Browser caches manifest.json
   - Clear with version bump in HTML

3. **Preloading:**
   - First 20 images are preloaded
   - Rest load on demand
   - Configurable in image-manager.js

## Troubleshooting

### Images Not Showing
1. Check manifest.json exists in assets/store/
2. Verify image filenames in manifest
3. Check browser console for errors
4. Reload page (Ctrl+Shift+R)

### Manifest Empty
```bash
# Re-scan images
python3 download-manager.py --scan
```

### Drive Download Failing
- Check internet connection
- Verify folder is publicly shared
- Try manual download (Option 3)
- Use gdrive CLI if API method fails

### Video Not Playing
- Ensure trx-1.mp4 exists in assets/
- Check file format (.mp4)
- Video falls back to static image
- Safari requires specific video codec

## File Structure

```
30lazma/
├── assets/
│   ├── store/
│   │   ├── manifest.json          (image catalog)
│   │   ├── s01.jpg - s40.jpg      (40 base images)
│   │   └── [1000+ more images]    (after bulk download)
│   ├── trx-1.mp4                  (animated banner)
│   ├── logo.png
│   └── favicon.png
├── animations.js                   (smooth effects)
├── image-manager.js                (distribution system)
├── video-banner.js                 (video backgrounds)
├── download-manager.py             (bulk downloader)
├── index.html                      (homepage)
├── category.html                   (category listing)
├── service.html                    (service details)
└── checkout.html                   (order form)
```

## Next Steps

1. **Get Drive Folder Link:** Share the Google Drive folder ID
2. **Download Images:** Use any of the 4 methods above
3. **Scan:** Run `python3 download-manager.py --scan`
4. **Deploy:** Commit and push to branch
5. **Test:** Visit newlynow.com and verify images load

## Scripts

### download-manager.py
- Batch download from Drive URLs
- Auto-scan existing images
- Generate manifest.json
- Categorize by size

### animations.js
- Scroll reveal effects
- Parallax scrolling
- Stagger animations
- Hover zoom
- Animated counters

### image-manager.js
- Load and distribute images
- Smart category assignment
- Preload optimization
- Apply to cards dynamically

### video-banner.js
- Video background setup
- Fallback to static images
- Parallax effect
- Responsive sizing

## Support

For issues or questions:
- Check the browser console (F12)
- Verify file paths and permissions
- Test with different browsers
- Review manifest.json for image list

---

**Last Updated:** 2026-08-15  
**Status:** Ready for bulk image integration  
**Test URL:** https://newlynow.com
