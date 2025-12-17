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
  
  const NETWORK_IP = "192.168.1.5";
  
  if (isMobileDevice() || !isDev) {
    return `http://${NETWORK_IP}:8000`;
  }
  
  return `http://localhost:8000`;
};

export const BASE_URL = getBaseURL();
