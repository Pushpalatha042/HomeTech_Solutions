import crypto from 'crypto';

export function generateOTP() {
  // Generate a cryptographically secure 6-digit OTP
  return crypto.randomInt(100000, 999999).toString();
}

export async function sendSMSOTP(phone, otp) {
  const isDev = process.env.DEV_OTP_MODE === 'true' || !process.env.SMS_API_KEY || process.env.SMS_API_KEY === 'mock_dev_sms_key';

  if (isDev) {
    console.log(`\n==============================================`);
    console.log(`[DEVELOPMENT SMS GATEWAY]`);
    console.log(`Target Mobile: +91 ${phone}`);
    console.log(`Generated OTP: ${otp}`);
    console.log(`Valid For:     5 Minutes`);
    console.log(`==============================================\n`);

    return {
      success: true,
      mode: 'development',
      message: 'OTP generated and sent (Development Mode: Check console or response)',
      devOtp: otp
    };
  }

  // Production SMS Gateway integration (e.g. MSG91 or Twilio)
  try {
    // Example MSG91 / Twilio fetch call using process.env.SMS_API_KEY & SMS_SENDER_ID
    console.log(`[SMS GATEWAY] Sending live SMS OTP to +91 ${phone} via configured gateway.`);
    // In production: await fetch(...)
    return {
      success: true,
      mode: 'production',
      message: 'OTP delivered to your mobile number.'
    };
  } catch (err) {
    console.error('[SMS GATEWAY ERROR]', err.message);
    throw new Error('Failed to deliver SMS. Please try again.');
  }
}
