const isDev = import.meta.env.DEV;

const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development, use Vite proxy (same-origin) for cookies to work
  // Vite proxy rewrites /api/* to http://localhost:8000/*
  if (isDev && !isMobileDevice()) {
    return "/api"; // Use proxy - same origin as frontend
  }
  
  // For mobile, detect the hostname and use port 8000 for backend
  if (isMobileDevice() || !isDev) {
    const hostname = window.location.hostname;
    // If accessing from network IP, use that IP for backend
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      const url = `http://${hostname}:8000`;
      console.log(`[Config] Mobile device detected. Using backend: ${url}`);
      return url;
    }
    // Fallback to common network IPs
    const fallbackUrl = `http://192.168.1.11:8000`;
    console.log(`[Config] Using fallback backend: ${fallbackUrl}`);
    return fallbackUrl;
  }
  
  return `http://localhost:8000`;
};

export const BASE_URL = getBaseURL();
