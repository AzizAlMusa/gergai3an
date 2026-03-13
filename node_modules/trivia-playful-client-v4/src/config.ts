const explicit = import.meta.env.VITE_SERVER_URL;
const protocol = window.location.protocol;
const hostname = window.location.hostname || "localhost";
const port = window.location.port;
// In production (no port or port 80/443), server is same origin. In dev, use :3002.
const isDev = port && port !== "80" && port !== "443";
export const SERVER_URL = explicit || (isDev ? `${protocol}//${hostname}:3002` : `${protocol}//${hostname}`);
