const axios = require('axios');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});

const sms = africastalking.SMS;

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

      const aiResponse = await axios.post(
        'https://api.cohere.ai/v1/chat',
        {
          model: 'command-r-plus',
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

      await sms.send({
        to: [senderNumber],
        message: aiReply,
	from: Rapha
      });

      return res.status(200).send('Response sent successfully.');
    } catch (error) {
      console.error('Error processing SMS request:', error);
      return res.status(500).send('Internal Server Error');
    }
  });
};
