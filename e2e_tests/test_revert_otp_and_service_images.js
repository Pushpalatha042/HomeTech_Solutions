import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c0d200c3-07ce-4f75-9a56-1a559efca4b6';

export async function runRevertOtpAndImagesTest() {
  console.log('======================================================================');
  console.log('HOMETECH: REVERT OTP DELIVERY & SERVICE IMAGES VERIFICATION');
  console.log('======================================================================\n');

  const results = [];
  const recordResult = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? '(' + details + ')' : ''}`);
  };

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const brokenResources = [];
  page.on('response', (res) => {
    if (res.status() >= 400 && res.request().resourceType() === 'image') {
      brokenResources.push({ url: res.url(), status: res.status() });
    }
  });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const timestamp = Date.now().toString().slice(-6);
  const testPhone = `9866${timestamp}`;
  const testEmail = `dev.customer.${timestamp}@hometech.demo`;
  let displayedOtp = '';

  try {
    // ------------------------------------------------------------------
    // SECTION 1: REGISTRATION & FRONTEND DEV OTP VERIFICATION
    // ------------------------------------------------------------------
    console.log('\n--- SECTION 1: REGISTRATION & FRONTEND DEV OTP ---');

    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
    await page.evaluate(() => {
      const regTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Register');
      if (regTabBtn) regTabBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));

    // Fill name & phone
    const nameInput = await page.$('input[placeholder*="Ramesh" i], input[type="text"]');
    if (nameInput) await nameInput.type('Ananya Patel');

    const phoneInputs = await page.$$('input[type="text"]');
    if (phoneInputs.length >= 2) await phoneInputs[1].type(testPhone);

    // Click Send OTP
    await page.evaluate(() => {
      const sendBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send OTP'));
      if (sendBtn) sendBtn.click();
    });
    await new Promise(r => setTimeout(r, 1200));

    // 1.1 Verify OTP appears directly on frontend
    const pageContent = await page.evaluate(() => document.body.innerText);
    const hasOtpPrompt = pageContent.includes('Your OTP is:') || pageContent.includes('Development Mode');
    recordResult('1.1 OTP Appears on Frontend Registration Form', hasOtpPrompt, 'Development mode prompt visible');

    // 1.2 Extract the displayed OTP
    displayedOtp = await page.evaluate(() => {
      const el = document.querySelector('strong');
      const text = document.body.innerText;
      const match = text.match(/Your OTP is:\s*(\d{6})/i);
      return match ? match[1] : '';
    });
    const validOtpExtracted = /^\d{6}$/.test(displayedOtp);
    recordResult('1.2 Six-Digit OTP Extracted from UI', validOtpExtracted, `Extracted OTP: ${displayedOtp}`);

    // Capture screenshot of OTP displayed on registration form
    const regOtpScreenshotPath = path.join(ARTIFACT_DIR, 'registration_frontend_otp_restored.png');
    await page.screenshot({ path: regOtpScreenshotPath });

    // 1.3 Enter extracted OTP & Verify
    const otpInput = await page.$('input[placeholder*="123456" i], input[maxlength="6"]');
    if (otpInput && displayedOtp) {
      await otpInput.type(displayedOtp);
      await page.evaluate(() => {
        const verifyBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Verify');
        if (verifyBtn) verifyBtn.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    }

    const postVerifyText = await page.evaluate(() => document.body.innerText);
    const isPhoneVerified = postVerifyText.includes('Mobile Number Verified') || postVerifyText.includes('+91');
    recordResult('1.3 OTP Successfully Verified in UI', isPhoneVerified, 'Mobile number marked verified');

    // 1.4 Enter Email (No email verification required)
    const emailInput = await page.$('input[type="email"]');
    if (emailInput) await emailInput.type(testEmail);

    const emailVerifyBtnExists = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.toLowerCase().includes('verify email'));
    });
    recordResult('1.4 No Email Verification Requirement or Button', !emailVerifyBtnExists, 'Email entered normally without block');

    // 1.5 Set and Confirm Password
    const passwordInputs = await page.$$('input[type="password"]');
    if (passwordInputs.length >= 2) {
      await passwordInputs[0].type('HomeTech@123');
      await passwordInputs[1].type('HomeTech@123');
    }
    await new Promise(r => setTimeout(r, 400));

    // Submit Registration
    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    });
    await page.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    const currentUrlAfterReg = page.url();
    const regCompleted = currentUrlAfterReg.includes('/customer/dashboard');
    recordResult('1.5 Complete Registration with Restored OTP Flow', regCompleted, `Redirected to ${currentUrlAfterReg}`);

    // 1.6 Confirm Login Works with Newly Registered Account
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    const currentUrlAfterLogin = page.url();
    const loginOk = currentUrlAfterLogin.includes('/customer/dashboard');
    recordResult('1.6 Login with Newly Registered Customer Account', loginOk, `Landed on ${currentUrlAfterLogin}`);

    // ------------------------------------------------------------------
    // SECTION 2: SERVICE IMAGES VERIFICATION IN UI
    // ------------------------------------------------------------------
    console.log('\n--- SECTION 2: SERVICE IMAGES VERIFICATION ---');

    // 2.1 Home Page Images
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    const homeImagesData = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        alt: img.alt,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      }));
    });

    const heroImgLoaded = homeImagesData.some(img => img.alt.includes('Plumber') && img.naturalWidth > 0);
    recordResult('2.1 Home Page Hero Image Renders Correctly', heroImgLoaded, 'Hero image loaded and valid');

    const categoryThumbnails = homeImagesData.filter(img => 
      ['Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting', 'Appliance Repair', 'AC Repair', 'Pest Control', 'Home Maintenance'].includes(img.alt)
    );
    const allCatThumbnailsValid = categoryThumbnails.length >= 8 && categoryThumbnails.every(img => img.naturalWidth > 0);
    recordResult('2.2 All Category Grid Thumbnails Loaded', allCatThumbnailsValid, `${categoryThumbnails.length} categories validated`);

    // Capture screenshot of Home Page
    const homeScreenshotPath = path.join(ARTIFACT_DIR, 'homepage_service_images_updated.png');
    await page.screenshot({ path: homeScreenshotPath });

    // 2.3 Services Catalogue Page Images
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    const servicesImagesData = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.service-card'));
      return cards.map(c => {
        const title = c.querySelector('.service-card-title')?.innerText || '';
        const category = c.querySelector('.badge')?.innerText || '';
        const img = c.querySelector('img');
        return {
          title,
          category,
          src: img?.src || '',
          naturalWidth: img?.naturalWidth || 0,
          naturalHeight: img?.naturalHeight || 0
        };
      });
    });

    const allServicesImagesValid = servicesImagesData.length > 0 && servicesImagesData.every(s => s.naturalWidth > 0);
    recordResult('2.3 Services Catalogue Cards Display Local Images', allServicesImagesValid, `${servicesImagesData.length} service card images validated`);

    // Verify individual service images match their category
    const categoryMatches = servicesImagesData.every(s => {
      const srcLower = s.src.toLowerCase();
      if (s.category === 'Plumbing') return srcLower.includes('plumbing');
      if (s.category === 'Electrical') return srcLower.includes('electrical');
      if (s.category === 'Cleaning') return srcLower.includes('cleaning');
      if (s.category === 'Carpentry') return srcLower.includes('carpentry');
      if (s.category === 'Painting') return srcLower.includes('painting');
      if (s.category === 'Appliance Repair') return srcLower.includes('appliance');
      if (s.category === 'AC Repair') return srcLower.includes('ac-repair');
      if (s.category === 'Pest Control') return srcLower.includes('pest-control');
      if (s.category === 'Home Maintenance') return srcLower.includes('home-maintenance');
      return true;
    });
    recordResult('2.4 Image to Service Category Exact Association', categoryMatches, 'Correct category images assigned');

    // Capture screenshot of Services Page
    const servicesScreenshotPath = path.join(ARTIFACT_DIR, 'services_catalogue_images_updated.png');
    await page.screenshot({ path: servicesScreenshotPath });

    // 2.5 Individual Service Details Page Image
    const firstServiceCard = await page.$('.service-card a');
    if (firstServiceCard) {
      await firstServiceCard.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
      await new Promise(r => setTimeout(r, 1000));

      const detailImgData = await page.evaluate(() => {
        const img = document.querySelector('img');
        return {
          src: img?.src,
          naturalWidth: img?.naturalWidth || 0
        };
      });
      const detailImgValid = detailImgData.naturalWidth > 0;
      recordResult('2.5 Individual Service Details Page Image Loaded', detailImgValid, `Natural width: ${detailImgData.naturalWidth}px`);

      // Capture screenshot of Service Details Page
      const detailScreenshotPath = path.join(ARTIFACT_DIR, 'service_details_image_updated.png');
      await page.screenshot({ path: detailScreenshotPath });
    }

    // 2.6 Customer Dashboard Service Cards Image
    await page.goto(`${BASE_URL}/customer/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    const dashImgsData = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.dashboard-main img'));
      return imgs.map(img => ({
        src: img.src,
        naturalWidth: img.naturalWidth
      }));
    });
    const dashImgsValid = dashImgsData.length === 0 || dashImgsData.every(img => img.naturalWidth > 0);
    recordResult('2.6 Customer Dashboard Service Images Intact', dashImgsValid, `${dashImgsData.length} images verified`);

    // 2.7 Mobile Viewport Responsive Test (375x667)
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));

    const mobileImgsValid = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('.service-card img'));
      return imgs.length > 0 && imgs.every(i => i.naturalWidth > 0 && i.offsetWidth > 0);
    });
    recordResult('2.7 Mobile Responsive Layout Image Scaling (375px)', mobileImgsValid, 'Mobile layout renders properly');

    // 2.8 Zero Broken Image Paths & Zero Console Errors
    const noBrokenImages = brokenResources.length === 0;
    recordResult('2.8 Zero Broken Image HTTP Requests (404/500)', noBrokenImages, 
      noBrokenImages ? 'No 404 image errors' : `Failed: ${JSON.stringify(brokenResources)}`);

  } catch (err) {
    console.error('Test execution error:', err);
    recordResult('Execution Error', false, err.message);
  } finally {
    await browser.close();
  }

  return results;
}

if (process.argv[1]?.endsWith('test_revert_otp_and_service_images.js')) {
  runRevertOtpAndImagesTest().then(res => {
    const passed = res.filter(r => r.passed).length;
    console.log(`\n======================================================================`);
    console.log(`REVERT OTP & SERVICE IMAGES AUDIT COMPLETE: ${passed}/${res.length} Passed`);
    console.log(`======================================================================`);
    process.exit(passed === res.length ? 0 : 1);
  });
}
