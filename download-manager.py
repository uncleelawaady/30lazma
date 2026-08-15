#!/usr/bin/env python3
"""
Bulk Image Downloader for NewlyNow Store
Downloads images from Google Drive folder and distributes them across categories
Usage: python3 download-manager.py <drive_folder_id> <output_dir>
"""

import os
import json
import sys
import requests
from urllib.parse import urljoin
from pathlib import Path

class ImageDownloadManager:
    def __init__(self, output_dir='assets/store'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.manifest = {'pool': [], 'big': []}
        self.downloaded = 0
        self.failed = 0

    def download_from_drive(self, folder_id, max_files=None):
        """
        Download images from Google Drive folder using public API
        Requires folder to be shared publicly or to have proper API credentials
        """
        # Google Drive API URL for listing files
        url = f'https://www.googleapis.com/drive/v3/files'
        params = {
            'q': f"'{folder_id}' in parents and trashed=false",
            'pageSize': 1000,
            'fields': 'files(id,name,mimeType,size)',
            'supportsAllDrives': True
        }

        print(f"[INFO] Downloading from Drive folder: {folder_id}")
        print(f"[INFO] Output directory: {self.output_dir}")

        # Note: This requires API key. For unauthenticated access, use direct download URLs
        # For now, provide instructions for manual download or OAuth
        self._print_manual_download_instructions(folder_id)

    def download_from_direct_urls(self, urls_file):
        """
        Download images from a list of direct Drive export URLs
        Format: one URL per line in urls.txt
        """
        urls_path = Path(urls_file)
        if not urls_path.exists():
            print(f"[ERROR] URLs file not found: {urls_file}")
            return

        with open(urls_path) as f:
            urls = [line.strip() for line in f if line.strip()]

        print(f"[INFO] Loading {len(urls)} URLs from {urls_file}")

        for i, url in enumerate(urls, 1):
            self._download_file(url, i, len(urls))

        self._save_manifest()

    def _download_file(self, url, index, total):
        """Download a single file from URL"""
        try:
            # Extract filename or use index
            if '&' in url:
                filename = f"image_{index:04d}.jpg"
            else:
                filename = os.path.basename(url).split('?')[0]

            filepath = self.output_dir / filename

            print(f"[{index}/{total}] Downloading: {filename}...", end=' ', flush=True)

            response = requests.get(url, timeout=30, stream=True)
            response.raise_for_status()

            # Check if response is an image
            content_type = response.headers.get('content-type', '')
            if 'image' not in content_type:
                print("SKIP (not an image)")
                return

            # Write file
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            size = filepath.stat().st_size
            if size < 10000:
                filepath.unlink()
                print("SKIP (too small)")
                return

            # Categorize by size
            if size > 100000:
                self.manifest['big'].append(filename)
            else:
                self.manifest['pool'].append(filename)

            print(f"OK ({size:,} bytes)")
            self.downloaded += 1

        except Exception as e:
            print(f"FAILED: {e}")
            self.failed += 1

    def _print_manual_download_instructions(self, folder_id):
        """Print instructions for manually downloading from Drive"""
        print(f"""
[MANUAL DOWNLOAD REQUIRED]

To download images, use one of these methods:

1. **Using Google Drive API (Authenticated)**:
   - Set up OAuth 2.0 credentials in Google Cloud Console
   - Run: python3 download-manager.py --oauth <folder_id>

2. **Using Direct Drive URLs**:
   - Generate a file with direct download URLs (one per line)
   - URLs should use format: https://drive.google.com/uc?export=download&id=FILE_ID
   - Save to: urls.txt
   - Run: python3 download-manager.py --urls urls.txt

3. **Manual Download**:
   - Visit: https://drive.google.com/drive/folders/{folder_id}
   - Select all images (Ctrl/Cmd+A)
   - Download as ZIP
   - Extract to: {self.output_dir}

4. **Using gdrive CLI**:
   - Install: go install github.com/prasmussen/gdrive@latest
   - Run: gdrive download --recursive {folder_id} --path {self.output_dir}

After downloading, the manifest will be automatically generated.
        """)

    def _save_manifest(self):
        """Save image manifest as JSON"""
        manifest_path = self.output_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(self.manifest, f, indent=2)

        print(f"\n[✓] Manifest saved to {manifest_path}")
        print(f"    Pool images: {len(self.manifest['pool'])}")
        print(f"    Big images: {len(self.manifest['big'])}")
        print(f"    Downloaded: {self.downloaded}")
        print(f"    Failed: {self.failed}")

    def scan_existing_images(self):
        """Scan and catalog existing images in output directory"""
        images = list(self.output_dir.glob('*.jpg')) + \
                 list(self.output_dir.glob('*.jpeg')) + \
                 list(self.output_dir.glob('*.png')) + \
                 list(self.output_dir.glob('*.webp'))

        for img in images:
            if img.name == 'manifest.json':
                continue

            size = img.stat().st_size
            if size > 100000:
                self.manifest['big'].append(img.name)
            else:
                self.manifest['pool'].append(img.name)

        self._save_manifest()
        print(f"[✓] Scanned {len(images)} existing images")

def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  Scan existing images:    python3 download-manager.py --scan")
        print("  Download from URLs file: python3 download-manager.py --urls urls.txt")
        print("  Download from Drive:     python3 download-manager.py <drive_folder_id>")
        return

    manager = ImageDownloadManager()

    if sys.argv[1] == '--scan':
        manager.scan_existing_images()
    elif sys.argv[1] == '--urls':
        urls_file = sys.argv[2] if len(sys.argv) > 2 else 'urls.txt'
        manager.download_from_direct_urls(urls_file)
    else:
        folder_id = sys.argv[1]
        manager.download_from_drive(folder_id)

if __name__ == '__main__':
    main()
