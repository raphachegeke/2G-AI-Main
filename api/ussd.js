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
Find the best career and nearby training.
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
      response = `CON What is your current location? (e.g. Kibera, Rongai, Thika)`;
    }

    // Step 4 - AI + SMS
    else if (inputs.length === 4) {
      const interest = interestMap[inputs[1]] || 'various topics';
      const subject = subjectMap[inputs[2]] || 'several subjects';
      const location = inputs[3]?.trim();

      if (!phone || !location) {
        response = 'END Missing location or phone number.';
      } else {
        try {
          const aiPrompt = `
You're an expert AI helping Kenyan students. A student from ${location} enjoys ${interest} and is best at ${subject}. 
Suggest 2 affordable and nearby institutions they can join (e.g. NairoBits, TVETs, community colleges). 
Also mention 2 ideal careers and a short reason why. 
Format like:
Career: Web Developer - fits students strong in ${subject}.
Keep it short, local, and motivating.
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
            message: `🎓 Career Buddy AI for ${location}:\n\n${aiReply}\n\n🚀 Keep learning, you're on the right path!`,
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
      response = 'END Thank you for using Career Buddy.';
    }

    res.setHeader('Content-Type', 'text/plain');
    res.end(response);
  });
};
