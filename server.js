const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));  
app.use(bodyParser.json()); 


const wss = new WebSocket.Server({ noServer: true });

let lastDistance = 2;

wss.on('connection', (ws) => {
  if (lastDistance > 0) {
    ws.send(JSON.stringify({ distance: lastDistance }));
  }
  ws.on('message', (message) => {
    console.log('received: %s', message);
  });
});

app.post('/distance', (req, res) => {
  console.log('Request Body:', req.body);  
  const distance = req.body.distance;
  console.log(`Received distance: ${distance} cm`);

  lastDistance = distance;

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ distance }));
    }
  });

  res.status(200).send({ message: 'Data received', distance });
});



const webRouter = express.Router();

webRouter.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

webRouter.use(express.static(path.join(__dirname, 'public')));

app.use('/web', webRouter);

const server = app.listen(8000, () => {
  console.log('Server is running at http://localhost:8000');
});

// Xử lý WebSocket nâng cấp
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
