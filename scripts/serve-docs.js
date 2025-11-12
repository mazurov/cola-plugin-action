#!/usr/bin/env node

/**
 * Simple HTTP server for viewing generated documentation
 * Usage: node scripts/serve-docs.js [directory] [port]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const args = process.argv.slice(2);
const rootDir = path.resolve(args[0] || 'build/docs-local-test/docs');
const port = parseInt(args[1] || '3000', 10);

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
};

const server = http.createServer((req, res) => {
  let url = req.url;
  
  // Parse URL to handle query strings
  const parsedUrl = new URL(req.url, `http://localhost:${port}`);
  let filePath = parsedUrl.pathname;
  
  // Remove leading slash
  filePath = filePath.substring(1);
  
  // Default to index.html
  if (!filePath || filePath.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }
  
  // Build full path
  const fullPath = path.join(rootDir, filePath);
  
  // Security: prevent directory traversal
  if (!fullPath.startsWith(rootDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }
  
  // Check if file exists
  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Try appending .html
      const htmlPath = fullPath + '.html';
      fs.stat(htmlPath, (htmlErr, htmlStats) => {
        if (htmlErr || !htmlStats.isFile()) {
          // 404 Not Found
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('<h1>404 Not Found</h1><p>The requested file does not exist.</p>');
          console.log('404:', filePath);
          return;
        }
        serveFile(htmlPath, res);
      });
      return;
    }
    
    serveFile(fullPath, res);
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      console.error('Error reading file:', err);
      return;
    }
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
    
    console.log('200:', filePath);
  });
}

server.listen(port, () => {
  console.log('');
  console.log('========================================');
  console.log('Documentation Server Started');
  console.log('========================================');
  console.log('');
  console.log('  Local:    http://localhost:' + port);
  console.log('  Network:  http://' + getLocalIp() + ':' + port);
  console.log('');
  console.log('  Serving:  ' + rootDir);
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
  
  // Auto-open browser
  if (process.env.OPEN_BROWSER !== 'false') {
    const url = 'http://localhost:' + port;
    setTimeout(() => {
      const { exec } = require('child_process');
      const command = process.platform === 'darwin' ? 'open' : 
                      process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${command} ${url}`, (error) => {
        if (error) {
          console.log('Could not auto-open browser. Please open manually:');
          console.log('  ' + url);
        }
      });
    }, 500);
  }
});

function getLocalIp() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  
  return '0.0.0.0';
}

// Handle errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error('Error: Port ' + port + ' is already in use.');
    console.error('Try a different port: node scripts/serve-docs.js [dir] [port]');
    console.error('');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
