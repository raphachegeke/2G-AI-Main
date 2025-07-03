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

  // Validate environment variables
  if (!process.env.AFRICASTALKING_API_KEY || 
      !process.env.AFRICASTALKING_USERNAME || 
      !process.env.OPENAI_API_KEY) {
    console.error('Missing required environment variables');
    res.status(500).setHeader('Content-Type', 'text/plain');
    return res.end('Service configuration error. Please try again later.');
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

      // Helper function to sanitize input
      const sanitizeInput = (input) => {
        return input.toString().replace(/[^\w\s.,-]/g, '').slice(0, 100);
      };

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
        response =" CON Please enter your age (1-120):";
      }

      // Step 2: Gender Input
      else if (inputs.length === 2 && inputs[0] === '1') {
        const age = parseInt(inputs[1]);
        if (isNaN(age) || age < 1 || age > 120) {
          response = 'END Please enter a valid age between 1 and 120';
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
          response = 'END Invalid gender selection. Please start again.';
        } else {
          response =" CON Describe your main symptom (e.g. chest pain, fever):";
        }
      }

      // Step 4: Duration Input
      else if (inputs.length === 4 && inputs[0] === '1') {
        const symptom = sanitizeInput(inputs[3]);
        if (!symptom || symptom.length < 3) {
          response = 'END Please enter a valid symptom (at least 3 characters)';
        } else {
          response = "CON How many days have you had this symptom? (1-365)";
        }
      }

      // Step 5: Confirmation and AI Assessment
      else if (inputs.length === 5 && inputs[0] === '1') {
        const age = parseInt(inputs[1]);
        const genderSelection = inputs[2];
        const symptom = sanitizeInput(inputs[3]);
        const duration = parseInt(inputs[4]);

        // Validate all inputs
        if (!phone || phone.length < 10 ||
            isNaN(age) || age < 1 || age > 120 ||
            !['1', '2', '3'].includes(genderSelection) ||
            !symptom || symptom.length < 3 ||
            isNaN(duration) || duration < 1 || duration > 365) {
          response = 'END Invalid input. Please start again.';
        } else {
          // Map gender selection to text
          const genderMap = {
            '1': 'Male',
            '2': 'Female',
            '3': 'Other'
          };
          const gender = genderMap[genderSelection] || 'Unknown';

          // Confirmation step
          response = `CON Confirm your details:
Age: ${age}
Gender: ${gender}
Symptom: ${symptom}
Duration: ${duration} days

1. Confirm and proceed
2. Cancel and start over`;
        }
      }

      // Step 6: Process AI Assessment
      else if (inputs.length === 6 && inputs[0] === '1' && inputs[5] === '1') {
        const age = parseInt(inputs[1]);
        const genderSelection = inputs[2];
        const symptom = sanitizeInput(inputs[3]);
        const duration = parseInt(inputs[4]);

        try {
          const genderMap = {
            '1': 'Male',
            '2': 'Female',
            '3': 'Other'
          };
          const gender = genderMap[genderSelection] || 'Unknown';

          // Create AI prompt
          const prompt = `
You are a helpful medical assistant for clinics in Kenya.
Patient: ${gender}, ${age} years
Symptom: ${symptom} for ${duration} days

Provide:
1. Possible condition (simple terms)
2. Risk level (Low/Medium/High)
3. Recommended action (self-care/clinic/emergency)
4. Nearest clinic suggestion if relevant

Keep response under 160 characters for SMS.
          `.trim();

          // Call OpenAI API
          const aiRes = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model: 'gpt-4',
              messages: [{ role: 'user', content: prompt }],
              temperature: 0.7,
              max_tokens: 150
            },
            {
              headers: {
                Authorization: "Bearer ${process.env.OPENAI_API_KEY}",
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );

          const aiReply = aiRes.data?.choices?.[0]?.message?.content?.trim();
          if (!aiReply) throw new Error('Empty AI response');

          // Send SMS with results
          try {
            await sms.send({
              to: [phone],
              message:" 🩺 AfyaLink Triage:\n${aiReply.slice(0, 160)}",
              from: 'AFYALINK'
            });
            response =" END Triage complete. Check your SMS for results.\nStay healthy!";
          } catch (smsErr) {
            console.error('SMS failed:', smsErr);
            response = "END ${aiReply.slice(0, 200)}...\n(Couldn't send SMS)";
          }

        } catch (aiErr) {
          console.error('AI error:', aiErr);
          response = 'END Service temporarily unavailable. Please try later.';
        }
      }

      // Handle cancellation or invalid options
      else if (inputs.length === 6 && inputs[0] === '1' && inputs[5] === '2') {
        response = 'END Session cancelled. Dial again to restart.';
      }

      // Fallback for invalid navigation
      else {
        response = 'END Invalid option selected. Please dial again.';
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(response);

    } catch (err) {
      console.error('System error:', err);
      res.status(500).setHeader('Content-Type', 'text/plain');
      res.end('System error. Please try again later.');
    }
  });
};