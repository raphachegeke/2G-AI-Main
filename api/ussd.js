// const axios = require('axios');
// const africastalking = require('africastalking')({
//   apiKey: process.env.AFRICASTALKING_API_KEY,
//   username: process.env.AFRICASTALKING_USERNAME
// });
// const sms = africastalking.SMS;

// module.exports = async (req, res) => {
//   if (req.method !== 'POST') return res.status(405).send('Only POST allowed');

//   let body = '';
//   req.on('data', chunk => { body += chunk.toString(); });

//   req.on('end', async () => {
//     const params = new URLSearchParams(body);
//     const text = params.get('text') || '';
//     const phone = params.get('phoneNumber');
//     const inputs = text.split('*');
//     let response = '';

//     const interestMap = {
//       '1': 'Maths',
//       '2': 'Science',
//       '3': 'Languages',
//       '4': 'Technical work',
//       '5': 'Helping people'
//     };

//     const subjectMap = {
//       '1': 'Maths',
//       '2': 'Science',
//       '3': 'English',
//       '4': 'Kiswahili',
//       '5': 'Computer Studies'
//     };

//     // Step 0 - Welcome
//     if (text === '') {
//       response = `CON Welcome to Career Buddy AI 📱
// Find the best career and nearby training.
// 1. Start\n99. Exit`;
//     }

//     // Step 1 - Interest
//     else if (inputs.length === 1) {
//       response = `CON What do you enjoy most?
// 1. Maths
// 2. Science
// 3. Languages
// 4. Technical work
// 5. Helping people\n0. Back\n99. Exit`;
//     }

//     // Step 2 - Subject
//     else if (inputs.length === 2) {
//       response = `CON What subject are you best at?
// 1. Maths
// 2. Science
// 3. English
// 4. Kiswahili
// 5. Computer\n0. Back\n99. Exit`;
//     }

//     // Step 3 - Location input
//     else if (inputs.length === 3) {
//       response = `CON What is your current location? (e.g. Kibera, Rongai, Thika)`;
//     }

//     // Step 4 - AI + SMS
//     else if (inputs.length === 4) {
//       const interest = interestMap[inputs[1]] || 'various topics';
//       const subject = subjectMap[inputs[2]] || 'several subjects';
//       const location = inputs[3]?.trim();

//       if (!phone || !location) {
//         response = 'END Missing location or phone number.';
//       } else {
//         try {
//           const aiPrompt = `
// You're an expert AI helping Kenyan students. A student from ${location} enjoys ${interest} and is best at ${subject}. 
// Suggest 2 affordable and nearby institutions they can join (e.g. NairoBits, TVETs, community colleges). 
// Also mention 2 ideal careers and a short reason why. 
// Format like:
// Career: Web Developer - fits students strong in ${subject}.
// Keep it short, local, and motivating.
//           `.trim();

//           const aiRes = await axios.post(
//             'https://api.cohere.ai/v1/chat',
//             {
//               model: 'command-a-03-2025',
//               message: aiPrompt,
//               temperature: 0.7
//             },
//             {
//               headers: {
//                 Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
//                 'Content-Type': 'application/json'
//               }
//             }
//           );

//           const aiReply = aiRes.data?.text?.trim() || aiRes.data?.generations?.[0]?.text?.trim();
//           if (!aiReply) throw new Error('Empty AI response');

//           const shortReply = aiReply.split('. ').slice(0, 2).join('. ') + '.';

//           await sms.send({
//             to: [phone],
//             message: `🎓 Career Buddy AI for ${location}:\n\n${aiReply}\n\n🚀 Keep learning, you're on the right path!`,
// 	    from: 'Career Buddy'
//           });

//           response = `END ${shortReply}\n📩 Full info sent via SMS.`;
//         } catch (err) {
//           console.error('AI/SMS error:', err.message);
//           response = 'END Sorry, something went wrong. Try again later.';
//         }
//       }
//     }

//     // End fallback
//     else {
//       response = 'END Thank you for using Career Buddy.';
//     }

//     res.setHeader('Content-Type', 'text/plain');
//     res.end(response);
//   });
// };


const axios = require('axios');
const nodemailer = require('nodemailer');
const africastalking = require('africastalking')({
  apiKey: process.env.AFRICASTALKING_API_KEY,
  username: process.env.AFRICASTALKING_USERNAME
});
const sms = africastalking.SMS;

// Fake DB for reports and sponsorships
const fakeDB = {
  reports: [
    { student: "John Doe", report: "Progressing well, needs more books." },
    { student: "Jane Doe", report: "Excellent in maths, struggling with English." }
  ],
  sponsors: {
    "254700111222": "Yes, sponsored by Equity Foundation",
    "254700333444": "No sponsor found"
  }
};

// Email setup (using Gmail as example)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

    // Step 0 - Welcome
    if (text === '') {
      response = `CON Welcome to Pathways Aid 📚
1. Find a Tutor
2. Chatbot Info
3. Reports
4. Sponsorship
99. Exit`;
    }

    // Step 1 - Tutor
    else if (inputs[0] === '1') {
      if (inputs.length === 1) {
        response = `CON Do you want to request a tutor now?
1. Yes
2. No
0. Back
99. Exit`;
      } else if (inputs.length === 2 && inputs[1] === '1') {
        // Send tutor info via SMS
        await sms.send({
          to: [phone],
          message: "📩 Pathways Aid: A tutor has been assigned to you. Expect a call within 24 hours.",
          from: "Pathways Aid"
        });
        response = "END Tutor request received! 📩 Details sent via SMS.";
      } else {
        response = "END Thank you for checking Tutor services.";
      }
    }

    // Step 2 - Chatbot Info
    else if (inputs[0] === '2') {
      if (inputs.length === 1) {
        // Send chatbot SMS
        await sms.send({
          to: [phone],
          message: "🤖 Chatbot Info: Use our SMS chatbot via 5679 to get instant learning help, tips, and answers 24/7!",
          from: "5679"
        });
        response = "END Info about our SMS chatbot has been sent! 📩";
      }
    }

    // Step 3 - Reports
    else if (inputs[0] === '3') {
      if (inputs.length === 1) {
        response = `CON Do you want student reports via email?
1. Yes
2. No
0. Back
99. Exit`;
      } else if (inputs.length === 2 && inputs[1] === '1') {
        // Send fake DB reports via email
        const reportText = fakeDB.reports.map(r => `${r.student}: ${r.report}`).join("\n\n");
        try {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.REPORTS_RECEIVER, // your email
            subject: "Student Reports - Pathways Aid",
            text: reportText
          });
          response = "END Reports have been emailed 📧";
        } catch (err) {
          console.error("Email error:", err.message);
          response = "END Failed to send reports. Try later.";
        }
      } else {
        response = "END Report request cancelled.";
      }
    }

    // Step 4 - Sponsorship Check
    else if (inputs[0] === '4') {
      if (inputs.length === 1) {
        response = `CON Do you want to check sponsorship?
1. Yes
2. No
0. Back
99. Exit`;
      } else if (inputs.length === 2 && inputs[1] === '1') {
        const sponsorInfo = fakeDB.sponsors[phone] || "No sponsor record found";
        await sms.send({
          to: [phone],
          message: `📢 Sponsorship Status: ${sponsorInfo}`,
          from: "Pathways Aid"
        });
        response = "END Sponsorship info sent via SMS.";
      } else {
        response = "END Sponsorship check cancelled.";
      }
    }

    // Exit
    else if (inputs[0] === '99') {
      response = "END Thank you for using Pathways Aid 🙏";
    }

    // Default
    else {
      response = "END Invalid choice. Please try again.";
    }

    res.setHeader('Content-Type', 'text/plain');
    res.end(response);
  });
};
