#!/usr/bin/env python3
"""
Generate PWA icons from favicon.ico
Requires: pip install Pillow
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("❌ Pillow not installed. Install it with: pip install Pillow")
    sys.exit(1)

def generate_icons():
    """Generate 192x192 and 512x512 PNG icons from favicon.ico"""
    
    # Paths
    public_dir = Path(__file__).parent.parent / "public"
    favicon_path = public_dir / "favicon.ico"
    
    if not favicon_path.exists():
        print(f"❌ favicon.ico not found at {favicon_path}")
        sys.exit(1)
    
    print(f"📄 Reading favicon from: {favicon_path}")
    
    try:
        # Open ICO file
        ico = Image.open(favicon_path)
        
        # Generate 192x192
        icon_192 = ico.resize((192, 192), Image.Resampling.LANCZOS)
        icon_192_path = public_dir / "icon-192.png"
        icon_192.save(icon_192_path, 'PNG')
        print(f"✅ Generated: {icon_192_path}")
        
        # Generate 512x512
        icon_512 = ico.resize((512, 512), Image.Resampling.LANCZOS)
        icon_512_path = public_dir / "icon-512.png"
        icon_512.save(icon_512_path, 'PNG')
        print(f"✅ Generated: {icon_512_path}")
        
        print("\n✅ Icons generated successfully!")
        print("   The manifest.json is already configured to use these icons.")
        
    except Exception as e:
        print(f"❌ Error generating icons: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generate_icons()

