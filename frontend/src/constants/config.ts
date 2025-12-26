const isDev = import.meta.env.DEV;

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};

const getBaseURL = () => {
  // Production: Use environment variable (set during build)
  // Vite environment variables are replaced at build time, so they must be set in Vercel before building
  const viteApiUrl = import.meta.env.VITE_API_URL;
  
  // Debug logging to verify environment variable is set
  if (typeof window !== 'undefined') {
    console.log('[Config] Environment check:', {
      isDev: isDev,
      hasViteApiUrl: !!viteApiUrl,
      viteApiUrl: viteApiUrl ? `${viteApiUrl.substring(0, 30)}...` : 'NOT SET',
      hostname: window.location.hostname,
    });
  }
  
  if (viteApiUrl) {
    // Ensure production URLs use HTTPS (Railway redirects HTTP to HTTPS, causing 405 errors)
    let url = viteApiUrl.trim();
    
    // If URL doesn't have a protocol, add https:// in production or http:// in dev
    if (!url.match(/^https?:\/\//)) {
      if (isDev) {
        url = `http://${url}`;
        console.warn('[Config] ⚠️ VITE_API_URL missing protocol. Added http:// for development.');
      } else {
        url = `https://${url}`;
        console.warn('[Config] ⚠️ VITE_API_URL missing protocol. Added https:// for production.');
      }
    }
    
    // Ensure production URLs use HTTPS (convert HTTP to HTTPS)
    if (!isDev && url.startsWith('http://')) {
      console.warn('[Config] ⚠️ VITE_API_URL uses HTTP in production. Converting to HTTPS.');
      url = url.replace('http://', 'https://');
    }
    
    console.log('[Config] ✅ Using VITE_API_URL from environment:', url);
    return url;
  }
  
  // In development, use Vite proxy (same-origin) for cookies to work
  // Vite proxy rewrites /api/* to http://localhost:8000/*
  if (isDev && !isMobileDevice()) {
    return "/api"; // Use proxy - same origin as frontend
  }
  
  // For mobile development, detect the hostname and use port 8000 for backend
  if (isDev && isMobileDevice()) {
    const hostname = window.location.hostname;
    // If accessing from network IP, use that IP for backend
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const url = `http://${hostname}:8000`;
      console.log(`[Config] Mobile device detected. Using backend: ${url}`);
      return url;
    }
    // If on localhost but mobile device, try to use the computer's network IP
    // This happens when phone is on same WiFi but accessing via localhost
    // User should access via computer's IP address (e.g., http://192.168.1.11:8080)
    console.warn(`[Config] Mobile device on localhost. Access frontend via your computer's IP (e.g., http://192.168.1.11:8080)`);
    // Try common network IPs as fallback
    const fallbackUrl = `http://192.168.1.11:8000`;
    console.log(`[Config] Using fallback backend: ${fallbackUrl}`);
    return fallbackUrl;
  }
  
  // Production fallback: Use Railway backend URL
  // This should be set via VITE_API_URL environment variable in Vercel
  const railwayUrl = "https://lifeos-production-f5df.up.railway.app";
  console.warn(`[Config] ⚠️ No VITE_API_URL set in production. Using fallback: ${railwayUrl}`);
  console.warn(`[Config] 💡 Set VITE_API_URL in Vercel environment variables for production!`);
  return railwayUrl;
};

export const BASE_URL = getBaseURL();
