require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const chatRoute = require('./routes/chat');
const translateRoute = require('./routes/translate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/chat', chatRoute);
app.use('/api/translate', translateRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Sukoon', version: '1.0.0' });
});

// 404 for unknown API routes (don't return HTML to API callers)
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 404 for unknown HTML routes (prevents SEO duplicate-content penalty)
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'), (err) => {
    if (err) res.status(404).send('Not Found');
  });
});

app.listen(PORT, () => {
  console.log(`\n  Sukoon is running on http://localhost:${PORT}`);
  console.log(`  Peace for every soul on Earth.\n`);
});
