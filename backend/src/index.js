require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use('/media', express.static(path.join(__dirname, '..', 'media')));

function safeMount(route, modulePath) {
  try {
    app.use(route, require(modulePath));
    console.log('[mount] ' + route + ' <- ' + modulePath);
  } catch (e) {
    console.warn('[skip] ' + modulePath + ': ' + e.message);
  }
}
safeMount('/api', './routes');
safeMount('/webhook', './engine/webhook');

try { require('./engine/workers'); console.log('[mount] engine/workers'); }
catch (e) { console.warn('[skip] engine/workers: ' + e.message); }

const http = require('http');
const { Server } = require('socket.io');
const PORT = process.env.PORT || 4300;
const server = http.createServer(app);
global._io = new Server(server, { cors: { origin: '*' } });
global._io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room));
});
app.use(express.static(path.join(__dirname, '../../frontend/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../../frontend/dist/index.html')));
server.listen(PORT, () => console.log('backend on :' + PORT));
