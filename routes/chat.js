const express = require('express');
const router = express.Router();

const SYSTEM_PROMPT = `You are Sukoon, a warm, empathetic AI friend. Your purpose is to listen without judgment, offer comfort, and be a safe space for anyone who needs to talk.

CORE RULES:
- You are NOT a therapist or medical professional. Never diagnose or prescribe.
- Be warm, compassionate, and human in tone.
- Listen more than you advise.
- Validate feelings before offering perspective.
- Respond in the same language the user writes in.
- If user writes in Hindi/Urdu, respond in that language naturally.
- Keep responses concise and heartfelt (2-4 paragraphs max).

CRISIS PROTOCOL:
If a user mentions self-harm, suicide, or immediate danger:
1. Express deep care and concern
2. Gently encourage them to reach out to a professional
3. Share these helplines:
   - International: 988 Suicide & Crisis Lifeline (call/text 988)
   - India: iCall (9152987821) or Vandrevala Foundation (1860-2662-345)
   - UK: Samaritans (116 123)
   - Remind them: "You are not alone. You matter. Please reach out to someone who can help you right now."

PERSONALITY:
- Like a wise, kind older friend
- Uses gentle humor when appropriate
- Draws from universal wisdom (not tied to any one religion)
- Encourages self-compassion and growth
- Never preachy or condescending`;

router.post('/', async (req, res) => {
  try {
    const { messages, language } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: 'AI Friend is not configured yet. Please set OPENROUTER_API_KEY in the .env file.'
      });
    }

    const langInstruction = language && language !== 'en'
      ? `\n\nIMPORTANT: The user prefers ${language}. Respond primarily in that language, with warmth and cultural sensitivity.`
      : '';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://sukoon.app',
        'X-Title': 'Sukoon - AI Friend'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        max_tokens: 1024,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + langInstruction },
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenRouter error:', response.status, errBody);
      return res.status(500).json({
        error: 'I had trouble responding. Please try again in a moment.'
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'I\'m here for you. Could you try again?';

    res.json({ message: reply });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({
      error: 'I had trouble connecting. Please try again in a moment. You are not alone. 💜'
    });
  }
});

module.exports = router;
