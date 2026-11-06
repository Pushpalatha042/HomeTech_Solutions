import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import OTPVerification from '../models/OTPVerification.js';
import { validatePhone, validatePassword, validateEmail } from '../utils/validators.js';
import { generateOTP, sendSMSOTP } from '../services/smsService.js';

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
}

function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'hometech_super_secure_jwt_secret_key_2026_987654321';
  return jwt.sign(
    { id: user._id, roles: user.roles, activeRole: user.activeRole },
    secret,
    { expiresIn: '7d' }
  );
}

// 1. Send OTP for Mobile Verification
export async function sendOTP(req, res) {
  try {
    const { phone, purpose = 'registration' } = req.body;
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }
    const cleanPhone = phoneCheck.cleanPhone;

    // If purpose is registration, prevent duplicate mobile registration
    if (purpose === 'registration') {
      const existingUser = await User.findOne({ phone: cleanPhone });
      if (existingUser) {
        return res.status(409).json({ message: 'An account with this mobile number already exists. Please login.' });
      }
    }

    // Rate-limit check: cooldown of 60 seconds
    const existingOTP = await OTPVerification.findOne({ phone: cleanPhone });
    if (existingOTP && existingOTP.lastSentAt) {
      const secondsSince = (Date.now() - new Date(existingOTP.lastSentAt).getTime()) / 1000;
      if (secondsSince < 60) {
        const remaining = Math.ceil(60 - secondsSince);
        return res.status(429).json({
          message: `Please wait ${remaining} seconds before requesting a new OTP.`
        });
      }
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await OTPVerification.findOneAndUpdate(
      { phone: cleanPhone },
      {
        $set: {
          otpHash,
          expiresAt,
          attempts: 0,
          lastSentAt: new Date(),
          verifiedAt: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Development mode: Return OTP directly without external SMS gateway dependencies
    res.json({
      success: true,
      message: 'Development Mode: OTP generated successfully.',
      devOtp: otp,
      expiresInSeconds: 300
    });
  } catch (err) {
    console.error('sendOTP error:', err);
    res.status(500).json({ message: 'Failed to send OTP. Please try again.' });
  }
}

// 2. Verify OTP
export async function verifyOTP(req, res) {
  try {
    const { phone, otp } = req.body;
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }
    if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
      return res.status(400).json({ message: 'Please enter a valid 6-digit OTP.' });
    }

    const cleanPhone = phoneCheck.cleanPhone;
    const record = await OTPVerification.findOne({ phone: cleanPhone });
    if (!record) {
      return res.status(400).json({ message: 'No OTP requested for this mobile number. Please request an OTP.' });
    }

    // Check expiration (5 minutes validity)
    if (new Date() > new Date(record.expiresAt)) {
      await OTPVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    // Prevent replay attacks using already verified OTP
    if (record.verifiedAt) {
      return res.status(400).json({ message: 'This OTP has already been verified and cannot be reused.' });
    }

    // Check attempt limit (max 5 failed attempts)
    if (record.attempts >= 5) {
      await OTPVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'Too many incorrect attempts (maximum 5). Please request a new OTP.' });
    }

    // Check match
    const isMatch = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!isMatch) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        await OTPVerification.deleteOne({ _id: record._id });
        return res.status(400).json({
          message: 'Too many incorrect attempts (maximum 5). Please request a new OTP.'
        });
      }
      await record.save();
      const remaining = 5 - record.attempts;
      return res.status(400).json({
        message: `Incorrect OTP. You have ${remaining} attempt(s) remaining.`
      });
    }

    // Mark verified
    record.verifiedAt = new Date();
    await record.save();

    res.json({
      success: true,
      message: 'Mobile number successfully verified.'
    });
  } catch (err) {
    console.error('verifyOTP error:', err);
    res.status(500).json({ message: 'OTP verification failed.' });
  }
}

// 3. User Registration (Public - strictly creates customer)
export async function register(req, res) {
  try {
    const { name, phone, email, password, confirmPassword, otp } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ message: 'Full name is required (minimum 2 characters).' });
    }

    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }
    const cleanPhone = phoneCheck.cleanPhone;

    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ message: emailCheck.message });
    }
    const cleanEmail = emailCheck.cleanEmail;

    const passCheck = validatePassword(password);
    if (!passCheck.valid) {
      return res.status(400).json({ message: passCheck.message });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Confirm password does not match password.' });
    }

    // Check duplicates before OTP verification
    const emailExists = await User.findOne({ email: cleanEmail });
    if (emailExists) {
      return res.status(409).json({ message: 'An account with this email address already exists.' });
    }
    const phoneExists = await User.findOne({ phone: cleanPhone });
    if (phoneExists) {
      return res.status(409).json({ message: 'An account with this mobile number already exists.' });
    }

    // Check if phone was verified via OTP
    const otpRecord = await OTPVerification.findOne({ phone: cleanPhone });
    let isVerified = false;
    if (otpRecord && otpRecord.verifiedAt) {
      const minutesAgo = (Date.now() - new Date(otpRecord.verifiedAt).getTime()) / 60000;
      if (minutesAgo < 15) {
        isVerified = true;
      }
    }

    // If OTP was passed directly in the registration payload, verify it inline
    if (!isVerified && otp) {
      if (otpRecord && (await bcrypt.compare(otp.trim(), otpRecord.otpHash))) {
        isVerified = true;
      }
    }

    if (!isVerified) {
      return res.status(400).json({
        message: 'Mobile number verification is mandatory. Please verify your OTP before registering.'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user strictly with customer role
    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      password: hashedPassword,
      roles: ['customer'],
      activeRole: 'customer',
      workerStatus: 'not_applied',
      isPhoneVerified: true,
      isActive: true
    });

    // Clean up OTP record
    await OTPVerification.deleteOne({ phone: cleanPhone });

    const token = generateToken(newUser);
    res.status(201).json({
      success: true,
      message: 'Account created successfully. Welcome to HomeTech!',
      token,
      user: sanitizeUser(newUser)
    });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ message: 'Registration failed. Please check the fields and try again.' });
  }
}

// 4. User Login
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Valid email and password strings are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const token = generateToken(user);
    res.json({
      success: true,
      message: 'Welcome back!',
      token,
      user: sanitizeUser(user)
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
}

// 5. Get Current User Profile
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(sanitizeUser(user));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
}

// 6. Switch Dashboard Active Role (Single Account, Dual Dashboard)
export async function switchRole(req, res) {
  try {
    const { role } = req.body;
    if (!['customer', 'worker', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role selection.' });
    }

    // Role check
    if (!req.user.roles.includes(role)) {
      return res.status(403).json({
        message: `You do not have permission to switch to the ${role} dashboard.`
      });
    }

    // If switching to worker, must be approved
    if (role === 'worker' && req.user.workerStatus !== 'approved') {
      return res.status(403).json({
        message: 'Worker dashboard is accessible only after administrative application approval.'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { activeRole: role } },
      { new: true }
    ).select('-password');

    const token = generateToken(updatedUser);
    res.json({
      success: true,
      message: `Switched to ${role.toUpperCase()} dashboard.`,
      token,
      user: sanitizeUser(updatedUser)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to switch dashboard view.' });
  }
}

// 7. Update User Profile
export async function updateProfile(req, res) {
  try {
    const { name, address, profileImage } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (address !== undefined) updates.address = address.trim();
    if (profileImage !== undefined) updates.profileImage = profileImage;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: sanitizeUser(user)
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile.' });
  }
}

// 8. Forgot Password
export async function forgotPassword(req, res) {
  try {
    const { phone } = req.body;
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }
    const cleanPhone = phoneCheck.cleanPhone;

    const user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      return res.status(404).json({ message: 'No registered account found with this mobile number.' });
    }

    // Rate-limit check: cooldown of 60 seconds
    const existingOTP = await OTPVerification.findOne({ phone: cleanPhone });
    if (existingOTP && existingOTP.lastSentAt) {
      const secondsSince = (Date.now() - new Date(existingOTP.lastSentAt).getTime()) / 1000;
      if (secondsSince < 60) {
        const remaining = Math.ceil(60 - secondsSince);
        return res.status(429).json({
          message: `Please wait ${remaining} seconds before requesting a new OTP.`
        });
      }
    }

    const otp = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await OTPVerification.findOneAndUpdate(
      { phone: cleanPhone },
      { $set: { otpHash, expiresAt, attempts: 0, lastSentAt: new Date(), verifiedAt: null } },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Development Mode: Password reset OTP generated successfully.',
      devOtp: otp,
      expiresInSeconds: 300
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to process forgot password request.' });
  }
}

// 9. Reset Password
export async function resetPassword(req, res) {
  try {
    const { phone, otp, newPassword, confirmPassword } = req.body;
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ message: phoneCheck.message });
    }
    const cleanPhone = phoneCheck.cleanPhone;

    const passCheck = validatePassword(newPassword);
    if (!passCheck.valid) {
      return res.status(400).json({ message: passCheck.message });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    const record = await OTPVerification.findOne({ phone: cleanPhone });
    if (!record || new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ message: 'OTP is expired or invalid. Please request a new OTP.' });
    }

    const isMatch = await bcrypt.compare(otp.trim(), record.otpHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect OTP.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.findOneAndUpdate({ phone: cleanPhone }, { $set: { password: hashedPassword } });
    await OTPVerification.deleteOne({ phone: cleanPhone });

    res.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.'
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reset password.' });
  }
}
