const axios = require('axios');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});
const sms = africastalking.SMS;

// Mock database for appointments
const appointmentsDB = new Map();

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

      // Helper functions
      const sanitizeInput = (input) => {
        return input.toString().replace(/[^\w\s.,-]/g, '').slice(0, 100);
      };

      const validatePhone = (phone) => {
        return phone && phone.length >= 10 && /^\+?\d+$/.test(phone);
      };

      // Step 0: Main Menu
      if (text === '') {
        response = `CON Welcome to AfyaLink 🏥
1. Triage Assessment
2. Book Clinic Visit
3. My Appointments
99. Exit`;
      }

      // ========== TRIAGE FLOW ========== //
      else if (inputs[0] === '1') {
        // Step 1: Age Input
        if (inputs.length === 1) {
          response = "CON Please enter your age (1-120):";
        }
        // Step 2: Gender Input
        else if (inputs.length === 2) {
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
        else if (inputs.length === 3) {
          if (!['1', '2', '3'].includes(inputs[2])) {
            response = 'END Invalid gender selection. Please start again.';
          } else {
            response = "CON Describe your main symptom (e.g. chest pain, fever):";
          }
        }
        // Step 4: Duration Input
        else if (inputs.length === 4) {
          const symptom = sanitizeInput(inputs[3]);
          if (!symptom || symptom.length < 3) {
            response = 'END Please enter a valid symptom (at least 3 characters)';
          } else {
            response = "CON How many days have you had this symptom? (1-365)";
          }
        }
        // Step 5: Confirmation
        else if (inputs.length === 5) {
          const duration = parseInt(inputs[4]);
          if (isNaN(duration) || duration < 1 || duration > 365) {
            response = 'END Please enter a valid duration (1-365 days)';
          } else {
            const genderMap = { '1': 'Male', '2': 'Female', '3': 'Other' };
            const gender = genderMap[inputs[2]] || 'Unknown';
            
            response = `CON Confirm your details:
Age: ${inputs[1]}
Gender: ${gender}
Symptom: ${inputs[3]}
Duration: ${inputs[4]} days

1. Confirm and proceed
2. Cancel and start over`;
          }
        }
        // Step 6: AI Assessment
        else if (inputs.length === 6 && inputs[5] === '1') {
          try {
            const age = inputs[1];
            const genderSelection = inputs[2];
            const symptom = sanitizeInput(inputs[3]);
            const duration = inputs[4];

            const genderMap = { '1': 'Male', '2': 'Female', '3': 'Other' };
            const gender = genderMap[genderSelection] || 'Unknown';

            // Enhanced AI prompt with clinical guidelines
            const prompt = `
As a medical AI assistant in Kenya, analyze this case:

Patient: ${gender}, ${age} years
Symptom: ${symptom} for ${duration} days

Provide structured assessment:
1. Likely Condition (most probable 1-2)
2. Red Flags (if any)
3. Risk Level (Low/Medium/High)
4. Immediate Action (Self-care/Clinic within 24h/Emergency)
5. Recommended Clinic Type (GP/Specialist/Hospital)

Consider common Kenyan conditions like malaria, typhoid, etc.
Keep response under 160 characters for SMS.
            `.trim();

            const aiRes = await axios.post(
              'https://api.openai.com/v1/chat/completions',
              {
                model: 'gpt-4',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.5,  // More deterministic for medical advice
                max_tokens: 200
              },
              {
                headers: {
                  Authorization: "Bearer ${process.env.OPENAI_API_KEY}",
                  'Content-Type': 'application/json'
                },
                timeout: 15000
              }
            );

            const aiReply = aiRes.data?.choices?.[0]?.message?.content?.trim();
            if (!aiReply) throw new Error('Empty AI response');

            // Enhanced SMS formatting
            const smsMessage = `🩺 AfyaLink Assessment:
${aiReply}

For emergencies, call 911 or go to nearest hospital.`;

            await sms.send({
              to: [phone],
              message: smsMessage.slice(0, 160),
              from: 'AFYALINK'
            });

            response = `END Assessment complete. Check SMS for details.
For emergencies, call 911.`;

          } catch (err) {
            console.error('Triage error:', err);
            response = 'END Service unavailable. Please try again later.';
          }
        }
        else if (inputs.length === 6 && inputs[5] === '2') {
          response = 'END Session cancelled. Dial *384*57054# to restart.';
        }
        else {
          response = 'END Invalid option. Please start again.';
        }
      }

      // ========== BOOK CLINIC VISIT FLOW ========== //
      else if (inputs[0] === '2') {
        // Step 1: Select facility type
        if (inputs.length === 1) {
          response = `CON Select facility type:
1. Public Hospital
2. Private Clinic
3. Specialized Center
4. Pharmacy`;
        }
        // Step 2: Select location
        else if (inputs.length === 2) {
          if (!['1', '2', '3', '4'].includes(inputs[1])) {
            response = 'END Invalid facility type. Please start again.';
          } else {
            response = `CON Select your county:
1. Nairobi
2. Mombasa
3. Kisumu
4. Nakuru
5. Other`;
          }
        }
        // Step 3: Select date
        else if (inputs.length === 3) {
          response = `CON Enter preferred date (DD-MM-YYYY):
Example: 15-08-2023`;
        }
        // Step 4: Select time
        else if (inputs.length === 4) {
          // Basic date validation
          const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-(20\d\d)$/;
          if (!dateRegex.test(inputs[3])) {
            response = 'END Invalid date format. Use DD-MM-YYYY';
          } else {
            response = `CON Select preferred time:
1. Morning (8AM-12PM)
2. Afternoon (12PM-4PM)
3. Evening (4PM-8PM)`;
          }
        }
        // Step 5: Confirmation
        else if (inputs.length === 5) {
          if (!['1', '2', '3'].includes(inputs[4])) {
            response = 'END Invalid time selection';
          } else {
            const facilityTypes = { '1': 'Public Hospital', '2': 'Private Clinic', '3': 'Specialized Center', '4': 'Pharmacy' };
            const counties = { '1': 'Nairobi', '2': 'Mombasa', '3': 'Kisumu', '4': 'Nakuru', '5': 'Other' };
            const times = { '1': 'Morning', '2': 'Afternoon', '3': 'Evening' };

            response = `CON Confirm appointment:
Facility: ${facilityTypes[inputs[1]]}
County: ${counties[inputs[2]]}
Date: ${inputs[3]}
Time: ${times[inputs[4]]}

1. Confirm booking
2. Cancel`;
          }
        }
        // Step 6: Process booking
        else if (inputs.length === 6 && inputs[5] === '1') {
          try {
            // Generate appointment ID
            const appointmentId = 'APPT-' + Math.random().toString(36).substr(2, 8).toUpperCase();
            const appointmentDetails = {
              phone: phone,
              facilityType: inputs[1],
              county: inputs[2],
              date: inputs[3],
              time: inputs[4],
              status: 'booked',
              createdAt: new Date().toISOString()
            };

            // Store in mock DB
            appointmentsDB.set(appointmentId, appointmentDetails);

            // Send confirmation SMS
            await sms.send({
              to: [phone],
              message: `📅 AfyaLink Appointment Confirmed:
ID: ${appointmentId}
Date: ${appointmentDetails.date}
Time: ${appointmentDetails.time}
Facility: ${appointmentDetails.county} ${appointmentDetails.facilityType}

Bring your ID and insurance card.`,
              from: 'AFYALINK'
            });

            response = `END Appointment booked! Check SMS for details.
Your ID: ${appointmentId}`;
          } catch (err) {
            console.error('Booking error:', err);
            response = 'END Failed to book appointment. Please try again.';
          }
        }
        else {
          response = 'END Booking cancelled. Dial *384*57054# to restart.';
        }
      }

      // ========== MY APPOINTMENTS FLOW ========== //
      else if (inputs[0] === '3') {
        // Get all appointments for this phone number
        const userAppointments = Array.from(appointmentsDB.entries())
          .filter(([id, details]) => details.phone === phone);

        if (userAppointments.length === 0) {
          response = 'END You have no upcoming appointments.';
        } else {
          // Step 1: List appointments
          if (inputs.length === 1) {
            response = 'CON Your Appointments (${userAppointments.length}):\n' +
              userAppointments.slice(0, 3).map(([id, details], index) => 
                "${index + 1}. ${details.date} ${details.time}\n   ${id}).join('\n')" +
              '\n99. Back to menu');
          }
          // Step 2: Appointment details
          else if (inputs.length === 2) {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];
              response = `CON Appointment Details:
ID: ${id}
Date: ${details.date}
Time: ${details.time}
Facility: ${details.county} ${details.facilityType}

1. Reschedule
2. Cancel
99. Back`;
            } else if (inputs[1] === '99') {
              response = 'END Returning to main menu.';
            } else {
              response = 'END Invalid selection.';
            }
          }
          // Step 3: Handle reschedule/cancel
          else if (inputs.length === 3) {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];
              
              if (inputs[2] === '1') { // Reschedule
                response = "CON Enter new date (DD-MM-YYYY):";
              } 
              else if (inputs[2] === '2') { // Cancel
                appointmentsDB.delete(id);
                response = 'END Appointment cancelled successfully.';
              }
              else {
                response = 'END Invalid option.';
              }
            }
          }
          // Step 4: Process rescheduling
          else if (inputs.length === 4) {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];
              const dateRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[012])-(20\d\d)$/;
              
              if (!dateRegex.test(inputs[3])) {
                response = 'END Invalid date format. Use DD-MM-YYYY';
              } else {
                details.date = inputs[3];
                response = `CON Select new time:
1. Morning (8AM-12PM)
2. Afternoon (12PM-4PM)
3. Evening (4PM-8PM)`;
              }
            }
          }
          // Step 5: Confirm rescheduling
          else if (inputs.length === 5) {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];
              
              if (!['1', '2', '3'].includes(inputs[4])) {
                response = 'END Invalid time selection';
              } else {
                const times = { '1': 'Morning', '2': 'Afternoon', '3': 'Evening' };
                details.time = times[inputs[4]];
                
                await sms.send({
                  to: [phone],
                  message: `🔄 AfyaLink Appointment Updated:
ID: ${id}
New Date: ${details.date}
New Time: ${details.time}`,
                  from: 'AFYALINK'
                });
                
                response = 'END Appointment rescheduled successfully. Check SMS.';
              }
            }
          }
        }
      }

      // Exit option
      else if (inputs[0] === '99') {
        response = 'END Thank you for using AfyaLink. Stay healthy!';
      }

      // Invalid main menu option
      else {
        response = 'END Invalid option. Please dial *384*57054# to start again.';
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