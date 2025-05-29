const axios = require('axios');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});
const sms = africastalking.SMS;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });

  req.on('end', async () => {
    const params = new URLSearchParams(body);
    const text = params.get('text') || '';
    const phone = params.get('phoneNumber');
    const inputs = text.split('*');
    let response = '';

    const interestMap = {
      '1': 'Maths',
      '2': 'Science',
      '3': 'Languages',
      '4': 'Technical work',
      '5': 'Helping people'
    };

    const subjectMap = {
      '1': 'Maths',
      '2': 'Science',
      '3': 'English',
      '4': 'Kiswahili',
      '5': 'Computer Studies'
    };

    // Step 0 - Welcome
    if (text === '') {
      response = `CON Welcome to Career Buddy AI 📱
Find your career path + nearby training.
1. Start\n99. Exit`;
    }

    // Step 1 - Interest
    else if (inputs.length === 1) {
      response = `CON What do you enjoy most?
1. Maths
2. Science
3. Languages
4. Technical work
5. Helping people\n0. Back\n99. Exit`;
    }

    // Step 2 - Subject
    else if (inputs.length === 2) {
      response = `CON What subject are you best at?
1. Maths
2. Science
3. English
4. Kiswahili
5. Computer\n0. Back\n99. Exit`;
    }

    // Step 3 - Location input
    else if (inputs.length === 3) {
      response = `CON What's your current location? (e.g. Kibera, Rongai, Thika)`;
    }

    // Step 4 - AI + SMS
    else if (inputs.length === 4) {
      const interest = interestMap[inputs[1]] || 'general interests';
      const subject = subjectMap[inputs[2]] || 'general subjects';
      const location = inputs[3]?.trim();

      if (!phone || !location) {
        response = 'END Missing location or phone number.';
      } else {
        try {
          const aiPrompt = `
You're an AI career assistant for Kenyan students.
A student from ${location} enjoys ${interest} and is good at ${subject}.
Suggest 2 different, nearby, affordable institutions they can join (TVETs, digital hubs, or community training).
Then recommend 2 career paths that match the subject + interest.
Avoid repeating the same institution in future responses.
Format it clearly:
1. Institution: Name - what it teaches. Located in/near ${location}.
2. Career: Name - short reason why it's a good fit.
Keep it short, real, and inspiring.
          `.trim();

          const aiRes = await axios.post(
            'https://api.cohere.ai/v1/chat',
            {
              model: 'command-r-plus',
              message: aiPrompt,
              temperature: 0.7
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );

          const aiReply = aiRes.data?.text?.trim() || aiRes.data?.generations?.[0]?.text?.trim();
          if (!aiReply) throw new Error('Empty AI response');

          const shortReply = aiReply.split('. ').slice(0, 2).join('. ') + '.';

          await sms.send({
            to: [phone],
            message: `📍 Career Buddy AI (${location}):\n\n${aiReply}\n\n🚀 Keep pushing forward.`,
            from: '5679'
          });

          response = `END ${shortReply}\n📩 Full info sent via SMS.`;
        } catch (err) {
          console.error('AI/SMS error:', err.message);
          response = 'END Sorry, something went wrong. Try again later.';
        }
      }
    }

    // End fallback
    else {
      response = 'END Thank you for using Career Buddy. 🚀';
    }

    res.setHeader('Content-Type', 'text/plain');
    res.end(response);
  });
};
