import axios from "axios";

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: "Missing phone or message parameter." });
    }

    console.log(`[Vercel Serverless] Sending SMS to: ${phone}`);

    // Normalize phone number for Israeli cellular providers
    let targetPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (targetPhone.startsWith('05')) {
      targetPhone = '+972' + targetPhone.substring(1);
    } else if (targetPhone.startsWith('5')) {
      targetPhone = '+972' + targetPhone;
    } else if (targetPhone.startsWith('972') && !targetPhone.startsWith('+')) {
      targetPhone = '+' + targetPhone;
    } else if (!targetPhone.startsWith('+')) {
      targetPhone = '+' + targetPhone;
    }

    const deviceId = process.env.TEXTBEE_DEVICE_ID || "6a4e3cf09317f40a16b64ea7";
    const apiKey = process.env.TEXTBEE_API_KEY || "f8d4b8e1-d961-4181-8860-525a0dfc203f";

    const url = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
    
    console.log(`[Vercel Serverless] Requesting TextBee URL: ${url} with phone: ${targetPhone}`);

    const response = await axios.post(
      url,
      {
        recipients: [targetPhone],
        message: message
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    console.log('[Vercel Serverless] SMS sent successfully:', response.data);
    return res.status(200).json({ success: true, data: response.data });
  } catch (error: any) {
    console.error("[Vercel Serverless] Failed to send SMS:", error.response?.data || error.message || error);
    return res.status(500).json({ 
      error: error.response?.data?.message || error.message || "Failed to send SMS via TextBee" 
    });
  }
}
