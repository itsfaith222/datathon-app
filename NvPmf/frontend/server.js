const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API proxy endpoint (optional - for proxying requests to backend)
app.get('/api/proxy/*', (req, res) => {
  // This can be used to proxy requests to the Flask backend
  res.json({ message: 'Proxy endpoint - configure as needed' });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
  console.log(`Backend API should be running on http://localhost:5000`);
});

