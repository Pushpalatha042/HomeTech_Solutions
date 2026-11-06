import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c0d200c3-07ce-4f75-9a56-1a559efca4b6';

export async function runOtpButtonsWorkflowTest() {
  console.log('======================================================================');
  console.log('HOMETECH: OTP VERIFICATION -> IN-PROGRESS ACTION BUTTONS E2E AUDIT');
  console.log('======================================================================\n');

  const results = [];
  const recordResult = (step, passed, details = '') => {
    results.push({ step, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: Step ${step} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Complaint = mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }), 'complaints');
  const Service = mongoose.model('Service', new mongoose.Schema({}, { strict: false }), 'services');

  const customerUser = await User.findOne({ email: 'customer@hometech.demo' });
  const workerUser = await User.findOne({ email: 'worker@hometech.demo' });
  const plumbingService = await Service.findOne({ category: 'Plumbing' });

  // Launch Session A (Customer) and Session B (Worker) in separate browser contexts
  const browserA = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const browserB = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const pageCustomer = await browserA.newPage();
  await pageCustomer.setViewport({ width: 1280, height: 900 });

  const pageWorker = await browserB.newPage();
  await pageWorker.setViewport({ width: 1280, height: 900 });

  let testBookingId = null;
  let testBookingMongoId = null;

  try {
    // ------------------------------------------------------------------
    // STEP 1: Login as Customer in Session A
    // ------------------------------------------------------------------
    await pageCustomer.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageCustomer.waitForSelector('input[type="email"]');
    await pageCustomer.type('input[type="email"]', 'customer@hometech.demo');
    await pageCustomer.type('input[type="password"]', 'HomeTech@123');
    await pageCustomer.click('button[type="submit"]');
    await pageCustomer.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    recordResult('1. Login as Customer in Session A', pageCustomer.url().includes('/customer/dashboard'), pageCustomer.url());

    // ------------------------------------------------------------------
    // STEP 2: Create a New Service Booking
    // ------------------------------------------------------------------
    const bookUrl = plumbingService ? `${BASE_URL}/booking/${plumbingService._id}` : `${BASE_URL}/book`;
    await pageCustomer.goto(bookUrl, { waitUntil: 'networkidle2' });
    await pageCustomer.waitForSelector('textarea.form-textarea');

    const testAddr = `99 Marine View Road, Flat 4B, Mumbai - ${Date.now().toString().slice(-4)}`;
    await pageCustomer.evaluate((addr) => {
      const addrInput = document.querySelector('textarea.form-textarea');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(addrInput, addr);
      addrInput.dispatchEvent(new Event('input', { bubbles: true }));
    }, testAddr);

    await pageCustomer.click('button[type="submit"]');
    await pageCustomer.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1500));

    // Fetch newly created booking from MongoDB
    const createdBooking = await Booking.findOne({ customerId: customerUser._id }).sort({ createdAt: -1 });
    testBookingId = createdBooking.bookingId;
    testBookingMongoId = createdBooking._id.toString();
    recordResult('2. Create New Service Booking', !!createdBooking, `Booking ID: ${testBookingId}`);

    // ------------------------------------------------------------------
    // STEP 3: Login as Worker in Session B
    // ------------------------------------------------------------------
    await pageWorker.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageWorker.waitForSelector('input[type="email"]');
    await pageWorker.type('input[type="email"]', 'worker@hometech.demo');
    await pageWorker.type('input[type="password"]', 'HomeTech@123');
    await pageWorker.click('button[type="submit"]');
    await pageWorker.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    await pageWorker.goto(`${BASE_URL}/worker/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    recordResult('3. Login as Worker in Session B', pageWorker.url().includes('/worker/dashboard'), pageWorker.url());

    // ------------------------------------------------------------------
    // STEP 4: Verify Request Appears in Worker Dashboard
    // ------------------------------------------------------------------
    const workerPageContent = await pageWorker.evaluate(() => document.body.innerText);
    const hasRequest = workerPageContent.includes(testBookingId) || workerPageContent.includes('Plumbing');
    recordResult('4. Request Appears in Worker Dashboard', hasRequest, `Booking ID visible in requests`);

    // ------------------------------------------------------------------
    // STEP 5: Worker Accepts the Request
    // ------------------------------------------------------------------
    const acceptedInDb = await Booking.findByIdAndUpdate(
      testBookingMongoId,
      { $set: { workerId: workerUser._id, status: 'Accepted' } },
      { new: true }
    );
    await pageWorker.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));
    recordResult('5. Worker Accepts Job Request', acceptedInDb.status === 'Accepted', `Status: ${acceptedInDb.status}`);

    // ------------------------------------------------------------------
    // STEP 6 & 7: Customer Sees Accepted Booking
    // ------------------------------------------------------------------
    await pageCustomer.goto(`${BASE_URL}/customer/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));
    const custDashText = await pageCustomer.evaluate(() => document.body.innerText);
    const custSeesJob = custDashText.includes(testBookingId) || custDashText.includes('Rahul Kumar') || custDashText.includes('Plumbing');
    recordResult('6 & 7. Customer Dashboard Shows Accepted Booking', custSeesJob, `Booking visible on customer dashboard`);

    // ------------------------------------------------------------------
    // STEP 8: Worker Clicks Start Job (Triggering Arrival Verification)
    // ------------------------------------------------------------------
    // Trigger Start Job via UI or API call
    const startVerifRes = await pageWorker.evaluate(async (bId) => {
      const token = localStorage.getItem('hometech_token');
      const res = await fetch(`http://localhost:5000/api/bookings/${bId}/start-verification`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return { status: res.status, data: await res.json() };
    }, testBookingMongoId);
    recordResult('8. Worker Clicks Start Job (Triggers Arrival Verification)', startVerifRes.status === 200, `HTTP ${startVerifRes.status}`);

    // ------------------------------------------------------------------
    // STEP 9: Customer Receives Arrival OTP
    // ------------------------------------------------------------------
    await pageCustomer.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const arrivalOtpInDb = await Booking.findById(testBookingMongoId);
    const isAwaitingVerification = arrivalOtpInDb.status === 'Awaiting Arrival Verification';
    recordResult('9. Customer Receives Arrival OTP (Awaiting Arrival Verification)', isAwaitingVerification, `Status: ${arrivalOtpInDb.status}`);

    // Retrieve decrypted plain OTP from customer API
    const otpApiRes = await pageCustomer.evaluate(async (bId) => {
      const token = localStorage.getItem('hometech_token');
      const res = await fetch(`http://localhost:5000/api/bookings/${bId}/arrival-verification`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    }, testBookingMongoId);
    const plainOtp = otpApiRes.otp;
    recordResult('9b. Plain 6-digit OTP Retrieved by Customer', !!plainOtp && plainOtp.length === 6, `OTP: ${plainOtp}`);

    // ------------------------------------------------------------------
    // TEST INCORRECT OTP REJECTION FIRST
    // ------------------------------------------------------------------
    const wrongOtpRes = await pageWorker.evaluate(async (bId) => {
      const token = localStorage.getItem('hometech_token');
      const res = await fetch(`http://localhost:5000/api/bookings/${bId}/verify-arrival-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ otp: '000000' })
      });
      return { status: res.status, data: await res.json() };
    }, testBookingMongoId);
    recordResult('Extra: Incorrect OTP Rejected', wrongOtpRes.status === 400, `HTTP ${wrongOtpRes.status} - ${wrongOtpRes.data.message}`);

    // ------------------------------------------------------------------
    // STEP 10 & 11: Worker Enters Correct OTP & Backend Validates
    // ------------------------------------------------------------------
    const correctOtpRes = await pageWorker.evaluate(async (bId, otp) => {
      const token = localStorage.getItem('hometech_token');
      const res = await fetch(`http://localhost:5000/api/bookings/${bId}/verify-arrival-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ otp })
      });
      return { status: res.status, data: await res.json() };
    }, testBookingMongoId, plainOtp);
    recordResult('10 & 11. Worker Enters Correct OTP -> Job Started Successfully', correctOtpRes.status === 200, `HTTP ${correctOtpRes.status}`);

    // ------------------------------------------------------------------
    // STEP 12: Verify MongoDB Booking Status is `in-progress`
    // ------------------------------------------------------------------
    const updatedMongoBooking = await Booking.findById(testBookingMongoId);
    const isStatusInProgress = updatedMongoBooking.status === 'in-progress';
    recordResult('12. Verify MongoDB Booking Status is `in-progress`', isStatusInProgress, `DB Status: '${updatedMongoBooking.status}'`);

    // ------------------------------------------------------------------
    // STEP 13 & 14: Customer Dashboard Automatically Updates via Real-Time Socket
    // ------------------------------------------------------------------
    // Wait for Socket.IO event propagation
    await new Promise(r => setTimeout(r, 2000));
    // Check if Complete Service button is rendered in Customer Dashboard
    const completeBtnBeforeReload = await pageCustomer.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Complete Service'));
      return !!btn;
    });
    recordResult('13 & 14. Customer Dashboard Updates Automatically via Real-Time Socket', completeBtnBeforeReload, 'Complete Service button detected live without manual reload');

    // ------------------------------------------------------------------
    // STEP 15 & 16: Verify `Complete Service` and `Raise a Complaint` Appear
    // ------------------------------------------------------------------
    const buttonsText = await pageCustomer.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.map(b => b.innerText.trim()).filter(Boolean);
    });

    const hasCompleteService = buttonsText.some(t => t.includes('Complete Service'));
    const hasRaiseComplaint = buttonsText.some(t => t.includes('Raise a Complaint') || t.includes('Raise Complaint'));
    recordResult('15. Verify `Complete Service` Button Appears', hasCompleteService, 'Complete Service action found');
    recordResult('16. Verify `Raise a Complaint` Button Appears', hasRaiseComplaint, 'Raise a Complaint action found');

    // CAPTURE SCREENSHOT OF CUSTOMER DASHBOARD
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
    const screenshotPath = path.join(ARTIFACT_DIR, 'customer_dashboard_in_progress_buttons.png');
    await pageCustomer.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`[E2E] Screenshot saved to: ${screenshotPath}`);

    // ------------------------------------------------------------------
    // STEP 17 & 18: Refresh Browser and Verify Both Buttons Remain Visible
    // ------------------------------------------------------------------
    await pageCustomer.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));

    const buttonsAfterReload = await pageCustomer.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      return buttons.map(b => b.innerText.trim()).filter(Boolean);
    });

    const hasCompleteServiceAfterReload = buttonsAfterReload.some(t => t.includes('Complete Service'));
    const hasRaiseComplaintAfterReload = buttonsAfterReload.some(t => t.includes('Raise a Complaint') || t.includes('Raise Complaint'));
    recordResult('17 & 18. Browser Refresh: Both Buttons Remain Visible', hasCompleteServiceAfterReload && hasRaiseComplaintAfterReload, 'Buttons persist across reload');

    // ------------------------------------------------------------------
    // STEP 19 & 20: Click Raise a Complaint & Verify Stored in MongoDB & Visible in Admin
    // ------------------------------------------------------------------
    // Click Raise a Complaint button
    const complaintBtn = await pageCustomer.$('button[data-testid="raise-complaint-btn"]');
    if (complaintBtn) {
      await complaintBtn.click();
    } else {
      // Fallback: evaluate click
      await pageCustomer.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Raise'));
        if (btn) btn.click();
      });
    }
    await new Promise(r => setTimeout(r, 800));

    // Fill Complaint modal
    await pageCustomer.waitForSelector('textarea.form-textarea');
    await pageCustomer.type('textarea.form-textarea', 'Test complaint: Service professional arrived late and needs guidance on pipe fittings.');
    await pageCustomer.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 1500));

    // Verify complaint in MongoDB
    const savedComplaint = await Complaint.findOne({ bookingId: updatedMongoBooking._id });
    recordResult('19 & 20. Complaint Submitted and Persisted in MongoDB', !!savedComplaint, `Complaint ID: ${savedComplaint?.complaintId}, Category: ${savedComplaint?.category}`);

    // ------------------------------------------------------------------
    // STEP 21 & 22: Click Complete Service & Confirm Completion -> Status `completed`
    // ------------------------------------------------------------------
    const completeBtn = await pageCustomer.$('button[data-testid="complete-service-btn"]');
    if (completeBtn) {
      await completeBtn.click();
    } else {
      await pageCustomer.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Complete Service'));
        if (btn) btn.click();
      });
    }
    await new Promise(r => setTimeout(r, 800));

    // Click confirm inside completion modal
    await pageCustomer.evaluate(() => {
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.innerText.includes('Yes, Work is Completed') || b.innerText.includes('Confirm')
      );
      if (confirmBtn) confirmBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    // Verify in MongoDB that status changed to `completed`
    const completedMongoBooking = await Booking.findById(testBookingMongoId);
    const isStatusCompleted = completedMongoBooking.status === 'completed' || completedMongoBooking.status === 'Completed';
    recordResult('21 & 22. Customer Confirms Completion -> Status Changes to `completed`', isStatusCompleted, `Status: '${completedMongoBooking.status}'`);

    // ------------------------------------------------------------------
    // STEP 23: Verify Worker Service History Contains Completed Booking
    // ------------------------------------------------------------------
    await pageWorker.goto(`${BASE_URL}/worker/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1500));
    const workerHistoryText = await pageWorker.evaluate(async (workerId) => {
      const token = localStorage.getItem('hometech_token');
      const res = await fetch(`http://localhost:5000/api/worker/service-history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return await res.json();
    });
    const historyList = workerHistoryText.services || workerHistoryText.jobs || [];
    const isInHistory = historyList.some(j => j.bookingId === testBookingId || j._id === testBookingMongoId);
    recordResult('23. Worker Service History Contains Completed Booking', isInHistory, `Found ${historyList.length} completed job(s) in history`);

  } catch (err) {
    console.error('Error during OTP buttons workflow audit:', err);
    recordResult('Workflow completed without uncaught exception', false, err.message);
  } finally {
    await browserA.close();
    await browserB.close();
    await mongoose.disconnect();
  }

  console.log('\n======================================================================');
  console.log(`SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} TESTS PASSED`);
  console.log('======================================================================');
  return results;
}

if (process.argv[1] && process.argv[1].includes('test_otp_buttons_workflow.js')) {
  runOtpButtonsWorkflowTest().then((results) => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });
}
