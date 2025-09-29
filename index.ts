import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8080;

// Add error handling
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Add a route for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Add health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Add basic request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

const server = app.listen(PORT, () => {
    console.log(`Static site served at http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log('Server is running...');
});

server.on('error', (error: any) => {
    console.error('Server error:', error);
});

// Keep the process alive
process.stdin.resume();