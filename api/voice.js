const axios = require('axios');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});

const voice = africastalking.VOICE;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const params = new URLSearchParams(body);
      const userMessage = params.get('text') || '';
      const senderNumber = params.get('from');

      if (!senderNumber || !userMessage) {
        return res.status(400).send('Bad Request: Missing required fields.');
      }

      // Get AI response
      const aiResponse = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          model: 'command-a-03-2025',
          message: `Respond to the following SMS message in a respectful, clear, and helpful tone: "${userMessage}"`,
          temperature: 0.7
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const aiReply = aiResponse.data.text?.trim();

      if (!aiReply) {
        throw new Error('AI response is empty.');
      }

      // Initiate a voice call with text-to-speech
      const callResponse = await voice.call({
        from: 'YOUR_VOICE_CALLER_ID', // e.g., '5679' if it's approved for voice, or a full number like '+254712345678'
        to: senderNumber,
        // Africa's Talking will convert this text to speech during the call
        voiceOptions: {
          text: aiReply,
          // Optional: specify language or voice (check Africa's Talking docs for supported options)
          // e.g., language: 'en-KE'
        }
      });

      console.log('Voice call initiated:', callResponse);
      return res.status(200).send('Voice response initiated successfully.');
    } catch (error) {
      console.error('Error processing voice request:', error);
      return res.status(500).send('Internal Server Error');
    }
  });
};