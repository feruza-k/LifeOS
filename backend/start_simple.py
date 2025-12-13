#!/usr/bin/env python3
"""Simple startup script to avoid segmentation fault"""

import uvicorn

if __name__ == "__main__":
    print("🚀 Starting LifeOS Backend...")
    print("📍 Server will be available at:")
    print("   - Local: http://localhost:8000")
    print("   - Network: http://0.0.0.0:8000")
    print("\nPress Ctrl+C to stop\n")
    
    try:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
