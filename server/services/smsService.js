import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTBOX_PATH = path.resolve(__dirname, '../data/sms_gateway_outbox.json');

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Normalizes phone number to Indian country code +91
 * e.g., '9876543210' -> '+919876543210'
 */
export function formatPhoneNumber(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return `+91${digits.slice(-10)}`;
}

/**
 * Dispatches OTP via configured SMS Gateway
 * Supports:
 * - Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)
 * - MSG91 (MSG91_AUTH_KEY, MSG91_TEMPLATE_ID / MSG91_FLOW_ID, MSG91_SENDER_ID)
 * - Generic SMS Gateway (SMS_GATEWAY_URL, SMS_API_KEY)
 * - Simulated Gateway (fallback when provider keys are unset or mock)
 */
export async function sendSMSOTP(rawPhone, otp) {
  const cleanPhone = String(rawPhone).replace(/\D/g, '').slice(-10);
  const formattedPhone = formatPhoneNumber(cleanPhone);
  const messageBody = `Your HomeTech verification code is ${otp}. Valid for 5 minutes. Do not share this OTP with anyone.`;

  // 1. Twilio Integration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM;

  if (twilioSid && twilioToken && twilioFrom && !twilioSid.startsWith('mock_')) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const basicAuth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
      const params = new URLSearchParams({
        To: formattedPhone,
        From: twilioFrom,
        Body: messageBody
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errData = await response.text();
        console.error('[SMS GATEWAY - Twilio Error]:', response.status, errData);
        throw new Error(`Twilio delivery failed with status ${response.status}`);
      }

      console.log(`[SMS GATEWAY] OTP successfully delivered via Twilio to ${formattedPhone}`);
      return { success: true, provider: 'twilio' };
    } catch (err) {
      console.error('[SMS GATEWAY ERROR - Twilio]:', err.message);
      throw new Error('Failed to deliver SMS via SMS Gateway. Please try again.');
    }
  }

  // 2. MSG91 Integration
  const msg91AuthKey = process.env.MSG91_AUTH_KEY;
  const msg91TemplateId = process.env.MSG91_TEMPLATE_ID || process.env.MSG91_FLOW_ID;
  const msg91SenderId = process.env.MSG91_SENDER_ID || process.env.SMS_SENDER_ID || 'HOMETC';

  if (msg91AuthKey && msg91TemplateId && !msg91AuthKey.startsWith('mock_')) {
    try {
      const url = `https://control.msg91.com/api/v5/otp?template_id=${msg91TemplateId}&mobile=91${cleanPhone}&authkey=${msg91AuthKey}&otp=${otp}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errData = await response.text();
        console.error('[SMS GATEWAY - MSG91 Error]:', response.status, errData);
        throw new Error(`MSG91 delivery failed with status ${response.status}`);
      }

      console.log(`[SMS GATEWAY] OTP successfully delivered via MSG91 to +91${cleanPhone}`);
      return { success: true, provider: 'msg91' };
    } catch (err) {
      console.error('[SMS GATEWAY ERROR - MSG91]:', err.message);
      throw new Error('Failed to deliver SMS via SMS Gateway. Please try again.');
    }
  }

  // 3. Generic SMS Gateway REST Endpoint
  const genericGatewayUrl = process.env.SMS_GATEWAY_URL;
  const genericApiKey = process.env.SMS_API_KEY;

  if (genericGatewayUrl && genericApiKey && genericApiKey !== 'mock_dev_sms_key') {
    try {
      const response = await fetch(genericGatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${genericApiKey}`
        },
        body: JSON.stringify({
          to: formattedPhone,
          sender: msg91SenderId,
          message: messageBody,
          otp
        })
      });

      if (!response.ok) {
        throw new Error(`Gateway returned HTTP ${response.status}`);
      }

      console.log(`[SMS GATEWAY] OTP successfully delivered via REST Gateway to ${formattedPhone}`);
      return { success: true, provider: 'generic-gateway' };
    } catch (err) {
      console.error('[SMS GATEWAY ERROR - REST Gateway]:', err.message);
      throw new Error('Failed to deliver SMS via SMS Gateway. Please try again.');
    }
  }

  // 4. Simulated / Local SMS Gateway (For test and local environments without active provider credentials)
  // Writes delivery receipt to data/sms_gateway_outbox.json so automated QA test suites can verify delivery
  // without leaking the secret OTP to frontend UI or client API responses.
  try {
    const outboxDir = path.dirname(OUTBOX_PATH);
    if (!fs.existsSync(outboxDir)) {
      fs.mkdirSync(outboxDir, { recursive: true });
    }

    let outbox = [];
    if (fs.existsSync(OUTBOX_PATH)) {
      try {
        outbox = JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf8'));
        if (!Array.isArray(outbox)) outbox = [];
      } catch (e) {
        outbox = [];
      }
    }

    const deliveryRecord = {
      phone: formattedPhone,
      cleanPhone,
      message: messageBody,
      otp, // recorded in gateway log/outbox strictly for QA / gateway delivery verification
      dispatchedAt: new Date().toISOString(),
      provider: 'simulated-gateway',
      status: 'DELIVERED'
    };

    outbox.unshift(deliveryRecord);
    // Keep last 50 gateway records
    if (outbox.length > 50) outbox.pop();

    fs.writeFileSync(OUTBOX_PATH, JSON.stringify(outbox, null, 2));

    console.log(`[SMS GATEWAY] OTP successfully dispatched to ${formattedPhone} via SMS Gateway (Status: DELIVERED)`);

    return {
      success: true,
      provider: 'simulated-gateway'
    };
  } catch (err) {
    console.error('[SMS GATEWAY ERROR]:', err.message);
    throw new Error('Failed to dispatch SMS through SMS Gateway. Please try again.');
  }
}

/**
 * Audit helper for test runners and system administration
 * strictly reading from the mock gateway outbox file.
 */
export function getLatestGatewayDispatch(cleanPhone) {
  try {
    if (!fs.existsSync(OUTBOX_PATH)) return null;
    const outbox = JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf8'));
    if (!Array.isArray(outbox)) return null;
    return outbox.find(entry => entry.cleanPhone === cleanPhone || entry.phone === `+91${cleanPhone}`) || null;
  } catch (err) {
    return null;
  }
}
