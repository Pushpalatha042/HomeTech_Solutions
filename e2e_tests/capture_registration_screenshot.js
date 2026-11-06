import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c0d200c3-07ce-4f75-9a56-1a559efca4b6';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const testPhone = `9844${Date.now().toString().slice(-6)}`;

  await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    const regTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Register');
    if (regTabBtn) regTabBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // Fill name & phone
  const nameInput = await page.$('input[placeholder*="Ramesh" i], input[type="text"]');
  if (nameInput) await nameInput.type('Priya Sharma');

  const phoneInputs = await page.$$('input[type="text"]');
  if (phoneInputs.length >= 2) await phoneInputs[1].type(testPhone);

  // Click Send OTP
  await page.evaluate(() => {
    const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send OTP'));
    if (sendBtn) sendBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Capture screenshot showing confirmation toast, resend timer, OTP input, and ZERO OTP leakage
  const screenshotPath = path.join(ARTIFACT_DIR, 'registration_secure_otp_delivery.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Saved screenshot to ${screenshotPath}`);

  await browser.close();
}

capture().catch(console.error);
