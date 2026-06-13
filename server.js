require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const chatRoute = require('./routes/chat');
const translateRoute = require('./routes/translate');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '128kb' }));

// Static assets with sane Cache-Control:
//   - audio, fonts, icons → 1 year immutable (filenames are stable today; revisit if we add hashing)
//   - CSS/JS → 1 day (changes occasionally, but not per-request)
//   - HTML → 60s (pages can change anytime; SW handles offline)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (/\.(wav|mp3|opus|ogg|svg|woff2?|png|jpg|jpeg|webp)$/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (/\.(css|js)$/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=86400');
    } else if (/\.html?$/i.test(filePath)) {
      res.set('Cache-Control', 'public, max-age=60');
    }
  }
}));

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
