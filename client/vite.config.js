import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';

// @mediapipe/tasks-vision ships a //# sourceMappingURL pointer to a map file
// it doesn't actually include in the tarball, so Vite logs a loud ENOENT on
// every dev boot. Harmless, but drowns other logs — filter that single line.
const logger = createLogger();
const origWarn = logger.warn;
const origError = logger.error;
const isMediapipeMapNoise = (msg) =>
  typeof msg === 'string' &&
  msg.includes('@mediapipe/tasks-vision') &&
  msg.includes('source map');
logger.warn = (msg, opts) => { if (!isMediapipeMapNoise(msg)) origWarn(msg, opts); };
logger.error = (msg, opts) => { if (!isMediapipeMapNoise(msg)) origError(msg, opts); };

export default defineConfig({
  customLogger: logger,
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
