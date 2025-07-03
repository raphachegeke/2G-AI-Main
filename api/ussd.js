const axios = require('axios');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});
const sms = africastalking.SMS;

// Mock database for appointments and payments
const appointmentsDB = new Map();
const paymentsDB = new Map();

// Payment configuration
const PAYMENT_OPTIONS = {
  '1': { name: 'M-Pesa', fee: 50, description: 'M-Pesa (KSh 50 convenience fee)' },
  '2': { name: 'Insurance', fee: 0, description: 'Insurance Billing (No fee)' },
  '3': { name: 'Cash', fee: 0, description: 'Pay at Facility (No fee)' }
};

// Facility pricing
const FACILITY_PRICES = {
  '1': 200,  // Public Hospital
  '2': 500,  // Private Clinic
  '3': 800,  // Specialized Center
  '4': 100   // Pharmacy
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).setHeader('Content-Type', 'text/plain');
    return res.end('Only POST allowed');
  }

  // Validate environment variables
  if (!process.env.AFRICASTALKING_API_KEY || 
      !process.env.AFRICASTALKING_USERNAME || 
      !process.env.COHERE_API_KEY) {
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

      // Simulate M-Pesa payment (in a real app, you'd use Safaricom API)
      const processMpesaPayment = async (phone, amount, reference) => {
        console.log(`Simulating M-Pesa payment of KSh ${amount} to ${phone} for ${reference}`);
        const paymentCode = MP`${Math.random().toString().substr(2, 6)}`;
        return {
          success: true,
          code: paymentCode,
          message:`Payment of KSh ${amount} initiated. Enter M-Pesa PIN to complete.`
        };
      };

      // Cohere AI medical assessment
      const getMedicalAssessment = async (age, gender, symptom, duration) => {
        try {
          const prompt = `As a medical AI assistant in Kenya, analyze this case:
Patient: ${gender}, ${age} years
Symptom: ${symptom} for ${duration} days

Provide structured assessment:
1. Likely Condition (most probable 1-2)
2. Red Flags (if any)
3. Risk Level (Low/Medium/High)
4. Immediate Action (Self-care/Clinic within 24h/Emergency)
5. Recommended Clinic Type (GP/Specialist/Hospital)

Consider common Kenyan conditions like malaria, typhoid, etc.
Keep response concise and under 160 characters for SMS.`;

          const aiRes = await axios.post(
            'https://api.cohere.ai/v1/chat',
            {
              model: 'command-r-plus',
              message: prompt,
              temperature: 0.5,
              max_tokens: 200
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            }
          );

          return aiRes.data.text?.trim() || "Unable to generate assessment. Please consult a doctor.";
        } catch (err) {
          console.error('Cohere API error:', err);
          return "Medical assessment service is currently unavailable. Please visit a healthcare provider.";
        }
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

            const aiReply = await getMedicalAssessment(age, gender, symptom, duration);

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
1. Public Hospital (KSh 200)
2. Private Clinic (KSh 500)
3. Specialized Center (KSh 800)
4. Pharmacy (KSh 100)`;
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
        // Step 5: Payment method selection
        else if (inputs.length === 5) {
          if (!['1', '2', '3'].includes(inputs[4])) {
            response = 'END Invalid time selection';
          } else {
            const facilityType = inputs[1];
            const basePrice = FACILITY_PRICES[facilityType] || 0;
            
            response = `CON Select payment method (Base Fee: KSh ${basePrice}):
1. ${PAYMENT_OPTIONS['1'].description}
2. ${PAYMENT_OPTIONS['2'].description}
3. ${PAYMENT_OPTIONS['3'].description}`;
          }
        }
        // Step 6: Payment processing
        else if (inputs.length === 6) {
          const paymentMethod = inputs[5];
          if (!['1', '2', '3'].includes(paymentMethod)) {
            response = 'END Invalid payment method';
          } else {
            const selectedOption = PAYMENT_OPTIONS[paymentMethod];
            const facilityType = inputs[1];
            const basePrice = FACILITY_PRICES[facilityType] || 0;
            const totalAmount = basePrice + selectedOption.fee;

            if (paymentMethod === '1') {
              try {
                const paymentRef =` APPT-${Math.random().toString(36).substr(2, 6)}`;
                const paymentResult = await processMpesaPayment(phone, totalAmount, paymentRef);

                if (paymentResult.success) {
                  paymentsDB.set(paymentRef, {
                    phone,
                    amount: totalAmount,
                    method: 'M-Pesa',
                    status: 'pending',
                    facilityType,
                    appointmentDetails: {
                      county: inputs[2],
                      date: inputs[3],
                      time: inputs[4]
                    }
                  });

                  response = `CON ${paymentResult.message}
1. I've completed payment
2. Cancel booking`;
                } else {
                  response = 'END Payment initiation failed. Please try again.';
                }
              } catch (err) {
                console.error('Payment error:', err);
                response = 'END Payment service unavailable. Please try cash option.';
              }
            } 
            else {
              response = `CON Confirm booking:
Facility: ${FACILITY_PRICES[inputs[1]]}
Payment: ${selectedOption.name}
Total: KSh ${totalAmount}

1. Confirm booking
2. Cancel`;
            }
          }
        }
        // Step 7: Payment verification or final confirmation
        else if (inputs.length === 7) {
          const paymentMethod = inputs[5];
          
          if (paymentMethod === '1') {
            if (inputs[6] === '1') {
              const paymentEntries = Array.from(paymentsDB.entries())
                .filter(([_, p]) => p.phone === phone && p.status === 'pending');
              
              if (paymentEntries.length > 0) {
                const [paymentRef, payment] = paymentEntries[0];
                
                payment.status = 'completed';
                paymentsDB.set(paymentRef, payment);
                
                const appointmentId = 'APPT-' + Math.random().toString(36).substr(2, 8).toUpperCase();
                const appointmentDetails = {
                  phone,
                  facilityType: payment.facilityType,
                  county: payment.appointmentDetails.county,
                  date: payment.appointmentDetails.date,
                  time: payment.appointmentDetails.time,
                  payment: {
                    method: payment.method,
                    amount: payment.amount,
                    reference: paymentRef
                  },
                  status: 'booked',
                  createdAt: new Date().toISOString()
                };

                appointmentsDB.set(appointmentId, appointmentDetails);

                await sms.send({
                  to: [phone],
                  message: `📅 AfyaLink Appointment Confirmed:
ID: ${appointmentId}
Date: ${appointmentDetails.date}
Time: ${appointmentDetails.time}
Facility: ${appointmentDetails.county} ${appointmentDetails.facilityType}
Paid: KSh ${payment.amount} via ${payment.method}

Bring your ID and payment receipt.`,
                  from: 'AFYALINK'
                });

                response = `END Appointment booked! Check SMS for details.
Your ID: ${appointmentId}`;
              } else {
                response = 'END Payment verification failed. Please start over.';
              }
            } else {
              response = 'END Booking cancelled. Dial *384*57054# to restart.';
            }
          }
          else {
            if (inputs[6] === '1') {
              const selectedOption = PAYMENT_OPTIONS[paymentMethod];
              const facilityType = inputs[1];
              const basePrice = FACILITY_PRICES[facilityType] || 0;
              const totalAmount = basePrice + selectedOption.fee;

              const appointmentId = 'APPT-' + Math.random().toString(36).substr(2, 8).toUpperCase();
              const appointmentDetails = {
                phone,
                facilityType: inputs[1],
                county: inputs[2],
                date: inputs[3],
                time: inputs[4],
                payment: {
                  method: selectedOption.name,
                  amount: totalAmount,
                  reference: paymentMethod === '2' ? 'INSURANCE' : 'CASH'
                },
                status: 'booked',
                createdAt: new Date().toISOString()
              };

              appointmentsDB.set(appointmentId, appointmentDetails);

              let smsMessage = `📅 AfyaLink Appointment Confirmed:
ID: ${appointmentId}
Date: ${appointmentDetails.date}
Time: ${appointmentDetails.time}
Facility: ${appointmentDetails.county} ${appointmentDetails.facilityType}`;

              if (paymentMethod === '2') {
                smsMessage += '\nPayment: Insurance billing (bring card)';
              } else {
                `smsMessage += \nPayment: Pay KSh ${totalAmount} at facility`;
              }

              await sms.send({
                to: [phone],
                message: smsMessage + '\n\nBring your ID and insurance card.',
                from: 'AFYALINK'
              });

              response = `END Appointment booked! Check SMS for details.
Your ID: ${appointmentId}`;
            } else {
              response = 'END Booking cancelled. Dial *384*57054# to restart.';
            }
          }
        }
      }

      // ========== MY APPOINTMENTS FLOW ========== //
      else if (inputs[0] === '3') {
        const userAppointments = Array.from(appointmentsDB.entries())
          .filter(([id, details]) => details.phone === phone);

        if (userAppointments.length === 0) {
          response = 'END You have no upcoming appointments.';
        } else {
          if (inputs.length === 1) {
            response = 'CON Your Appointments:\n' +
              userAppointments.slice(0, 3).map(([id, details], index) => 
                `${index + 1}. ${details.date} ${details.time}\n `  `${id} (${details.payment.method})`).join('\n') +
             ` \n99. Back to menu`;
          }
          else if (inputs.length === 2) {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];
              response = `CON Appointment Details:
ID: ${id}
Date: ${details.date}
Time: ${details.time}
Facility: ${details.county} ${details.facilityType}
Payment: ${details.payment.method} (KSh ${details.payment.amount})

1. Reschedule
2. Cancel
3. Payment Receipt
99. Back`;
            } else if (inputs[1] === '99') {
              response = 'END Returning to main menu.';
            } else {
              response = 'END Invalid selection.';
            }
          }
          else if (inputs.length === 3) {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];

              if (inputs[2] === '1') {
                response = "CON Enter new date (DD-MM-YYYY):";
              } 
              else if (inputs[2] === '2') {
                if (details.payment.method === 'M-Pesa' && details.payment.amount > 0) {
                  response =` CON Refund of KSh ${details.payment.amount} will be processed. Confirm cancellation:
1. Yes, cancel appointment
2. No, keep appointment`;
                } else {
                  appointmentsDB.delete(id);
                  response = 'END Appointment cancelled successfully.';
                }
              }
              else if (inputs[2] === '3') {
                await sms.send({
                  to: [phone],
                  message: `🧾 AfyaLink Receipt:
Appointment: ${id}
Date: ${details.date}
Amount: KSh ${details.payment.amount}
Method: ${details.payment.method}
Ref: ${details.payment.reference}`,
                  from: 'AFYALINK'
                });
                response = 'END Payment receipt sent to your phone.';
              }
              else {
                response = 'END Invalid option.';
              }
            }
          }
          else if (inputs.length === 4 && inputs[2] === '2') {
            const selected = parseInt(inputs[1]) - 1;
            if (selected >= 0 && selected < userAppointments.length) {
              const [id, details] = userAppointments[selected];

              if (inputs[3] === '1') {
                console.log(`Processing refund of KSh ${details.payment.amount} for ${id}`);
                appointmentsDB.delete(id);
                
                await sms.send({
                  to: [phone],
                  message: `🔄 Appointment ${id} cancelled. Refund of KSh ${details.payment.amount} will be processed within 3 days.`,
                  from: 'AFYALINK'
                });
                
                response = 'END Appointment cancelled. Refund initiated.';
              } else {
                response = 'END Cancellation aborted. Appointment remains booked.';
              }
            }
          }
        }
      }

      // Exit option
      else if (inputs[0] === '99') {
        response = 'END Thank you for using AfyaLink. Stay healthy!';
      }
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