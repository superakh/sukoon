require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const chatRoute = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/chat', chatRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Sukoon', version: '1.0.0' });
});

// SPA fallback - serve index.html for any unknown route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  Sukoon is running on http://localhost:${PORT}`);
  console.log(`  Peace for every soul on Earth.\n`);
});
