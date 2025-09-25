const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    // Handle CORS preflight
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).send('Method Not Allowed');
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
  }

  const params = new URLSearchParams(body);
  const userMessage = params.get('message') || '';

  try {
    const aiRes = await axios.post(
      'https://api.cohere.ai/v1/chat',
      {
        model: 'command-a-03-2025',
        message: `Reply helpfully to: "${userMessage}"`,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiReply = aiRes.data.text?.trim() || 'No response from AI.';

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for frontend fetch
    res.status(200).json({ reply: aiReply });
  } catch (err) {
    console.error('AI Error:', err.message);
    res.status(500).json({ error: 'Something went wrong.' });
  }
};
