// API Configuration
// Supports both localhost (web dev) and network IP (mobile testing)

// Detect if we're in development
const isDev = import.meta.env.DEV;

// Detect if we're on mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || window.innerWidth < 768;
};

// Get API URL from environment or use defaults
// For web dev: use localhost
// For mobile/network: use your network IP (update this to your machine's IP)
const getBaseURL = () => {
  // Priority 1: Environment variable (set in .env)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Priority 2: Use network IP for mobile devices or production
  // Update this IP to match your machine's current IP address
  // You can find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
  const NETWORK_IP = "192.168.1.5"; // Your network IP
  
  // If on mobile device or in production, use network IP
  // Otherwise use localhost for web development
  if (isMobileDevice() || !isDev) {
    return `http://${NETWORK_IP}:8000`;
  }
  
  // Default to localhost for web development
  return `http://localhost:8000`;
};

export const BASE_URL = getBaseURL();

// Log the API URL being used (helpful for debugging)
if (typeof window !== 'undefined') {
  console.log("🔗 API Base URL:", BASE_URL);
  console.log("📱 Mobile device detected:", isMobileDevice());
  console.log("🌐 Current URL:", window.location.href);
  
  // Show connection status
  if (isMobileDevice()) {
    console.log("📱 Running on mobile device - using network IP");
  } else {
    console.log("💻 Running on desktop - using localhost");
  }
}
