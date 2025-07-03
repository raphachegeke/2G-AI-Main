const axios = require('axios');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});
const sms = africastalking.SMS;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Content-Type', 'text/plain');
    return res.end('Only POST allowed');
  }

  if (!process.env.AFRICASTALKING_API_KEY || !process.env.AFRICASTALKING_USERNAME || !process.env.OPENAI_API_KEY) {
    res.status(500).setHeader('Content-Type', 'text/plain');
    return res.end('Server configuration error');
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('error', (err) => {
    console.error('Request error:', err);
    res.status(500).end('Request processing error');
  });

  req.on('end', async () => {
    try {
      const params = new URLSearchParams(body);
      const text = params.get('text') || '';
      const phone = params.get('phoneNumber');
      const inputs = text.split('*');
      let response = '';

      // Step 0: Welcome Menu
      if (text === '') {
        response = `CON Welcome to AfyaLink 🏥
1. Triage Me
2. Book Clinic Visit
3. My Appointments
99. Exit`;
      }

      // Step 1: Age Input
      else if (inputs.length === 1 && inputs[0] === '1') {
        response =" CON Please enter your age (e.g. 24):";
      }

      // Step 2: Gender Input
      else if (inputs.length === 2 && inputs[0] === '1') {
        const age = inputs[1];
        if (!age || isNaN(age) || age < 0 || age > 120) {
          response = 'END Please enter a valid age (0-120)';
        } else {
          response = `CON Select your gender:
1. Male
2. Female
3. Other/Prefer not to say`;
        }
      }

      // Step 3: Symptom Input
      else if (inputs.length === 3 && inputs[0] === '1') {
        const genderSelection = inputs[2];
        if (!['1', '2', '3'].includes(genderSelection)) {
          response = 'END Invalid gender selection';
        } else {
          response =" CON What symptom are you experiencing? (e.g. chest pain, fever)";
        }
      }

      // Step 4: Duration Input
      else if (inputs.length === 4 && inputs[0] === '1') {
        response =" CON How long have you had this symptom? (in days)";
      }

      // Step 5: AI Assessment + SMS
      else if (inputs.length === 5 && inputs[0] === '1') {
        const age = inputs[1];
        const genderSelection = inputs[2];
        const symptom = inputs[3].slice(0, 100); // Limit length
        const duration = inputs[4];

        if (!phone || !age || !genderSelection || !symptom || !duration || isNaN(duration)) {
          response = 'END Missing or invalid information. Please try again.';
        } else {
          const genderMap = {
            '1': 'Male',
            '2': 'Female',
            '3': 'Other'
          };
          const gender = genderMap[genderSelection] || 'Unknown';

          try {
            const prompt = `
You're a helpful medical AI assistant for low-resource clinics in Kenya.

A ${gender}, aged ${age}, is experiencing "${symptom}" for ${duration} days.

Respond with:
- A possible condition (keep it simple).
- Risk level (Low, Medium, High).
- What they should do next (e.g. self-care, visit clinic, emergency).
- Suggest the nearest clinic if known.

Keep it short and clear (within SMS limits).
            `.trim();

            const aiRes = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7
              },
              {
                headers: {
                  Authorization: "Bearer ${process.env.OPENAI_API_KEY}",
                  "Content-Type": 'application/json'
                },
                timeout: 10000 // 10 seconds timeout
              }
            );

            const aiReply = aiRes.data?.choices?.[0]?.message?.content?.trim();
            if (!aiReply) throw new Error('Empty AI reply');

            // Send full info via SMS
            try {
              await sms.send({
                to: [phone],
                message: "🩺 AfyaLink Triage Result:\n\n${aiReply.slice(0, 160)}", // Ensure SMS length limit
                from: 'AFYALINK'
              });

              const summary = aiReply.split('.').slice(0, 2).join('. ') + '.';
              response =" END ${summary}\n📩 Full triage result sent via SMS.";
            } catch (smsErr) {
              console.error('SMS error:', smsErr.message);
              response =" END ${aiReply.slice(0, 200)}...\n(SMS failed to send)";
            }

          } catch (aiErr) {
            console.error('AI error:', aiErr.message);
            response = 'END Sorry, we couldn\'t process your request. Please try again later.';
          }
        }
      }

      // Fallback
      else {
        response = 'END Thank you for using AfyaLink. Stay safe! 🙏🏽';
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(response);
    } catch (err) {
      console.error('Unexpected error:', err);
      res.status(500).setHeader('Content-Type', 'text/plain');
      res.end('An unexpected error occurred');
    }
  });
};