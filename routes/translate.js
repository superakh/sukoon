const express = require('express');
const router = express.Router();

/**
 * POST /api/translate
 * Body: { text: "Hello", from: "en", to: "hi" }
 * Returns: { translated: "नमस्ते" }
 *
 * Uses MyMemory API (free, no auth needed) for dynamic translation.
 * This is for future dynamic content; the static UI uses client-side i18n.
 */
router.post('/', async (req, res) => {
  try {
    const { text, from, to } = req.body;

    if (!text || !from || !to) {
      return res.status(400).json({
        error: 'Missing required fields: text, from, to'
      });
    }

    const encoded = encodeURIComponent(text);
    const langpair = `${from}|${to}`;
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langpair}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error('MyMemory API error:', response.status);
      return res.status(502).json({
        error: 'Translation service temporarily unavailable.'
      });
    }

    const data = await response.json();
    const translated = data?.responseData?.translatedText || '';

    if (!translated) {
      return res.status(500).json({
        error: 'No translation returned.'
      });
    }

    res.json({ translated });
  } catch (error) {
    console.error('Translate error:', error.message);
    res.status(500).json({
      error: 'Translation failed. Please try again.'
    });
  }
});

module.exports = router;
