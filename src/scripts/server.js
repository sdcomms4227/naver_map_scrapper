require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const port = process.env.PORT || 3000;
let server = null;

// Store active scripts and current script
const activeScripts = new Map();
let currentScript = null;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve static files from the root directory
app.use(express.static('./'));

// Routes
app.get('/api/search', async (req, res) => {
  try {
    const { keyword, filters } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: '검색어는 필수입니다.' });
    }

    // Convert filters from string to array if it's a string
    const filterArray = typeof filters === 'string' ? filters.split(',') : [];

    // Run the search script
    const searchProcess = spawn('node', [
      path.join(__dirname, 'search.js'),
      `keyword=${encodeURIComponent(keyword)}`,
      `filters=${encodeURIComponent(filterArray.join(','))}`
    ]);

    let output = '';
    let error = '';

    searchProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    searchProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    searchProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Search process exited with code:', code);
        console.error('Error:', error);
        return res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
      }

      // Find the most recent results file
      const resultsDir = path.join(__dirname, '..', 'results');
      fs.readdir(resultsDir)
        .then(files => {
          const resultFiles = files.filter(file => file.endsWith('.json'));
          if (resultFiles.length === 0) {
            return res.status(404).json({ error: '검색 결과가 없습니다.' });
          }

          const latestFile = resultFiles.sort().pop();
          return fs.readFile(path.join(resultsDir, latestFile), 'utf8');
        })
        .then(data => {
          res.json(JSON.parse(data));
        })
        .catch(err => {
          console.error('Error reading results:', err);
          res.status(500).json({ error: '결과를 읽는 중 오류가 발생했습니다.' });
        });
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// Endpoint to run scripts
app.get('/run/:scriptName/:mode', async (req, res) => {
    const { scriptName, mode } = req.params;
    const { keyword, filters } = req.query;

    // 이미 실행 중인 스크립트가 있는지 확인
    if (activeScripts.has(scriptName)) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: '이미 실행 중인 스크립트입니다.' })}\n\n`);
        res.end();
        return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Determine the correct script path
    let scriptPath;
    switch (scriptName) {
      case 'search':
        scriptPath = path.join(__dirname, 'search.js');
        break;
      default:
        throw new Error('Unknown script name');
    }

    // Check if script exists
    try {
      await fs.access(scriptPath);
    } catch (err) {
      throw new Error(`Script not found: ${scriptPath}`);
    }

    // Set environment variable for mode
    process.env.CHROME_MODE = mode;

    // Run the script
    const scriptProcess = spawn('node', [
        scriptPath,
        `keyword=${encodeURIComponent(keyword || '')}`,
        `filters=${encodeURIComponent(filters || '')}`
    ], {
      env: { ...process.env, CHROME_MODE: mode }
    });
    activeScripts.set(scriptName, scriptProcess);
    currentScript = scriptName;

    scriptProcess.stdout.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ type: 'log', message: data.toString() })}\n\n`);
    });

    scriptProcess.stderr.on('data', (data) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: data.toString() })}\n\n`);
    });

    scriptProcess.on('close', (code) => {
        res.write(`data: ${JSON.stringify({ type: 'complete', code: code })}\n\n`);
        activeScripts.delete(scriptName);
        if (currentScript === scriptName) {
            currentScript = null;
        }
        res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
        if (activeScripts.has(scriptName)) {
            const script = activeScripts.get(scriptName);
            script.kill();
            activeScripts.delete(scriptName);
            if (currentScript === scriptName) {
                currentScript = null;
            }
        }
    });
});

// Endpoint to stop specific script
app.get('/stop/:scriptName', (req, res) => {
    const { scriptName } = req.params;
    
    if (activeScripts.has(scriptName)) {
        const script = activeScripts.get(scriptName);
        script.kill();
        activeScripts.delete(scriptName);
        if (currentScript === scriptName) {
            currentScript = null;
        }
        res.json({ success: true, message: `${scriptName} 스크립트가 중지되었습니다.` });
    } else {
        res.json({ success: false, error: '실행 중인 스크립트가 없습니다.' });
    }
});

// Endpoint to check script status
app.get('/status/:scriptName', (req, res) => {
    const { scriptName } = req.params;
    res.json({ 
        status: activeScripts.has(scriptName) ? 'running' : 'stopped',
        script: scriptName
    });
});

// 상태 확인 엔드포인트
app.get('/status', (req, res) => {
    res.json({
        isRunning: currentScript !== null,
        currentScript: currentScript
    });
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, '..')));

// 404 처리
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Start server
function startServer() {
    if (server) {
        console.log('Server is already running');
        return;
    }

    server = app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

// Start the server
startServer(); 