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

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'AI Friend is not configured yet. Please set ANTHROPIC_API_KEY.'
      });
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const langInstruction = language && language !== 'en'
      ? `\n\nIMPORTANT: The user prefers ${language}. Respond primarily in that language, with warmth and cultural sensitivity.`
      : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + langInstruction,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    res.json({
      message: response.content[0].text
    });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({
      error: 'I had trouble responding. Please try again in a moment.'
    });
  }
});

module.exports = router;
