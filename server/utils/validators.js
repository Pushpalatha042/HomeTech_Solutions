export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, message: 'Phone number is required.' };
  }
  const cleanPhone = phone.trim();
  // Must be numeric digits only and exactly 10 digits
  if (!/^\d{10}$/.test(cleanPhone)) {
    return {
      valid: false,
      message: 'Mobile number must contain exactly 10 numeric digits (0-9).'
    };
  }
  // Standard Indian mobile number starts with 6, 7, 8, or 9
  if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
    return {
      valid: false,
      message: 'Please enter a valid 10-digit Indian mobile number starting with 6-9.'
    };
  }
  return { valid: true, cleanPhone };
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required.' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one numeric digit (0-9).' };
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (@, #, $, %, &, !, etc.).' };
  }
  return { valid: true };
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim().toLowerCase())) {
    return { valid: false, message: 'Please provide a valid email address.' };
  }
  return { valid: true, cleanEmail: email.trim().toLowerCase() };
}
