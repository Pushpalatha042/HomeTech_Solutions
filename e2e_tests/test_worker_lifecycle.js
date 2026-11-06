import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

let browser;
let customerContext;
let workerContext;
let customerPage;
let workerPage;

const results = [];
function report(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
}

async function runWorkerLifecycleTests() {
  console.log('--------------------------------------------------');
  console.log('SUITE 5: CUSTOMER & WORKER INTERACTION LIFECYCLE');
  console.log('--------------------------------------------------');

  await mongoose.connect(MONGO_URI);
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const Review = mongoose.model('Review', new mongoose.Schema({}, { strict: false }), 'reviews');
  const Complaint = mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }), 'complaints');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const WorkRequest = mongoose.model('WorkRequest', new mongoose.Schema({}, { strict: false }), 'workrequests');
  const Service = mongoose.model('Service', new mongoose.Schema({}, { strict: false }), 'services');

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  customerContext = await browser.createBrowserContext();
  customerPage = await customerContext.newPage();
  await customerPage.setViewport({ width: 1280, height: 800 });

  workerContext = await browser.createBrowserContext();
  workerPage = await workerContext.newPage();
  await workerPage.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Create a fresh Pending booking and matching WorkRequest for worker@hometech.demo
    const worker = await User.findOne({ email: 'worker@hometech.demo' });
    const cust = await User.findOne({ email: 'customer@hometech.demo' });
    const service = await Service.findOne({ category: 'Plumbing' });

    // Clean up any stale active bookings for pristine test state
    await Booking.updateMany(
      { customerId: cust._id, status: { $in: ['Pending', 'pending', 'Assigned', 'assigned', 'Accepted', 'accepted', 'Awaiting Arrival Verification', 'awaiting arrival verification', 'In Progress', 'in-progress', 'in_progress'] } },
      { status: 'Completed', paymentStatus: 'Paid' }
    );
    await WorkRequest.updateMany(
      { workerId: worker._id, status: { $in: ['Pending', 'pending', 'Accepted', 'accepted'] } },
      { status: 'Expired' }
    );

    const bookingReadableId = `HT-BKG-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();
    const activeBooking = await Booking.create({
      bookingId: bookingReadableId,
      customerId: cust._id,
      workerId: null,
      serviceId: service._id,
      category: 'Plumbing',
      address: '101 Green Avenue, Apt 4C, Vijayawada',
      contactNumber: '9876543210',
      bookingDate: new Date(Date.now() + 86400000),
      bookingTime: '10:00 AM',
      instructions: 'Ring doorbell twice. Water tap is leaking in kitchen.',
      status: 'Pending',
      totalAmount: service.price || 499,
      paymentStatus: 'Pending',
      arrivalOtp: { attemptsCount: 0 },
      createdAt: now,
      updatedAt: now
    });

    const wr = await WorkRequest.create({
      bookingId: activeBooking._id,
      workerId: worker._id,
      customerId: cust._id,
      category: 'Plumbing',
      serviceId: service._id,
      status: 'Pending'
    });

    report('Active Pending Booking & Work Request Created', !!activeBooking && !!wr, `Booking: ${activeBooking.bookingId}, WR: ${wr._id}`);

    // 2. Worker Logs In
    await workerPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await workerPage.type('input[type="email"]', 'worker@hometech.demo');
    await workerPage.type('input[type="password"]', 'HomeTech@123');
    await workerPage.click('button[type="submit"]');
    await workerPage.waitForFunction(() => window.location.pathname.includes('/worker/dashboard'));
    report('Worker Login & Navigation to Worker Dashboard', workerPage.url().includes('/worker/dashboard'), `URL: ${workerPage.url()}`);

    // 3. Worker Accepts Job Request
    await workerPage.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim().includes('Accept')),
      { timeout: 12000 }
    );

    const acceptBtn = await workerPage.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim().includes('Accept'));
    });
    await acceptBtn.click();

    // Wait for active booking status to update to Accepted in MongoDB
    let dbAcceptedBooking;
    for (let i = 0; i < 25; i++) {
      dbAcceptedBooking = await Booking.findById(activeBooking._id);
      if (dbAcceptedBooking && dbAcceptedBooking.status === 'Accepted') break;
      await new Promise(r => setTimeout(r, 200));
    }

    await workerPage.waitForFunction(
      (bId) => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Start Job') && b.closest('.card')?.textContent.includes(bId)),
      { timeout: 10000 },
      activeBooking.bookingId
    ).catch(() => {});

    report('Worker Accepts Job Request', dbAcceptedBooking?.status === 'Accepted', `Status in MongoDB: ${dbAcceptedBooking?.status}`);

    // 4. Worker Clicks "Start Job" -> Triggers Arrival Verification
    await new Promise(r => setTimeout(r, 600));
    await workerPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Start Job'));
      if (btn) btn.click();
    });

    // Worker OTP modal opens
    await workerPage.waitForSelector('input[maxlength="6"]', { timeout: 8000 });
    const awaitingBooking = await Booking.findById(activeBooking._id);
    report('Start Job Triggers Arrival Verification', awaitingBooking.status === 'Awaiting Arrival Verification', `Status: ${awaitingBooking.status}`);

    // 5. Customer Logs In and Views 6-Digit Arrival OTP
    await customerPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await customerPage.type('input[type="email"]', 'customer@hometech.demo');
    await customerPage.type('input[type="password"]', 'HomeTech@123');
    await customerPage.click('button[type="submit"]');
    await customerPage.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'));

    // Wait for the Arrival OTP card to render with the 6-digit code
    await customerPage.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="arrival-otp-code"]');
        return el && /^\d{6}$/.test(el.textContent.trim());
      },
      { timeout: 10000 }
    );

    const customerOtp = await customerPage.$eval('[data-testid="arrival-otp-code"]', el => el.textContent.trim());
    report('Customer Dashboard Displays 6-Digit Arrival OTP', /^\d{6}$/.test(customerOtp), `Arrival OTP on Customer Screen: ${customerOtp}`);

    // 6. Worker Enters Invalid OTP -> Rejected with Remaining Attempts
    await workerPage.type('input[maxlength="6"]', '999999');
    
    const verifyBtn = await workerPage.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      return btns.find(b => b.textContent.includes('Verify Code'));
    });
    await verifyBtn.click();

    // Wait for error message in modal
    await workerPage.waitForFunction(
      () => document.body.innerText.includes('Incorrect OTP') || document.body.innerText.includes('remaining'),
      { timeout: 6000 }
    );
    const rejectionMsg = await workerPage.evaluate(() => {
      const el = document.querySelector('div[style*="fef2f2"]');
      return el ? el.textContent.trim() : 'Incorrect OTP';
    });
    report('Worker Invalid OTP Rejected With Remaining Attempts', true, `Message: "${rejectionMsg}"`);

    // 7. Worker Enters Correct Arrival OTP -> Status In Progress
    await workerPage.evaluate(() => {
      const inp = document.querySelector('input[maxlength="6"]');
      if (inp) {
        inp.value = '';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await workerPage.type('input[maxlength="6"]', customerOtp);
    await verifyBtn.click();

    // Wait for modal to close
    await workerPage.waitForFunction(() => !document.querySelector('input[maxlength="6"]'), { timeout: 8000 });

    const inProgressBooking = await Booking.findById(activeBooking._id);
    const isInProgress = (inProgressBooking.status === 'in-progress' || inProgressBooking.status === 'In Progress') && inProgressBooking.startedAt !== null;
    report('Worker Verifies Correct OTP -> In Progress', isInProgress, `DB Status: ${inProgressBooking.status}, StartedAt: ${inProgressBooking.startedAt}`);

    // 8. Worker Dashboard Shows "Job In Progress" and NO Complete Job Button
    const workerInProgBadge = await workerPage.evaluate(() => {
      const text = document.body.innerText;
      const hasInProg = text.includes('Job In Progress') || text.includes('In Progress');
      const hasCompleteBtn = Array.from(document.querySelectorAll('button')).some(b => b.textContent.toLowerCase().includes('complete job'));
      return hasInProg && !hasCompleteBtn;
    });
    report('Worker Dashboard Shows Job In Progress (No Complete Button)', workerInProgBadge, 'Worker cannot complete job; role isolation preserved');

    // 9. Customer Dashboard Displays Confirm Completion / Complete Service Button
    await customerPage.reload({ waitUntil: 'networkidle2' });
    await customerPage.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Complete Service') || b.textContent.includes('Confirm Completion')),
      { timeout: 10000 }
    );
    report('Customer Dashboard Displays Confirm Completion Button', true, 'Complete Service action visible to customer');

    // 10. Customer Confirms Completion -> Status Completed & Paid
    await customerPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Complete Service') || b.textContent.includes('Confirm Completion'));
      if (btn) btn.click();
    });

    // In the confirmation modal, click "Yes, Work is Completed"
    await customerPage.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Yes, Work is Completed')), { timeout: 6000 });
    await customerPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Yes, Work is Completed'));
      if (btn) btn.click();
    });

    let completedBooking = null;
    for (let i = 0; i < 20; i++) {
      completedBooking = await Booking.findById(activeBooking._id);
      if (completedBooking && (completedBooking.status === 'completed' || completedBooking.status === 'Completed') && completedBooking.paymentStatus === 'Paid') {
        break;
      }
      await new Promise(r => setTimeout(r, 400));
    }
    const isCompletedPaid = completedBooking && (completedBooking.status === 'completed' || completedBooking.status === 'Completed') && completedBooking.paymentStatus === 'Paid';
    report('Customer Confirms Completion -> Completed & Paid in MongoDB', isCompletedPaid, `Status: ${completedBooking?.status}, Payment: ${completedBooking?.paymentStatus}`);

    // 11. Customer Submits Rating and Review
    const reviewComment = 'Outstanding plumbing repair, arrived promptly and resolved the leak completely.';
    await customerPage.waitForFunction(
      () => document.body.innerText.includes('Rate Your Service Experience') || Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Submit Rating')),
      { timeout: 8000 }
    );
    await customerPage.waitForSelector('textarea.form-textarea', { timeout: 5000 });
    await customerPage.type('textarea.form-textarea', reviewComment);

    await customerPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const submitBtn = btns.find(b => b.textContent.includes('Submit Rating'));
      if (submitBtn) submitBtn.click();
    });

    let dbReview = null;
    for (let i = 0; i < 20; i++) {
      dbReview = await Review.findOne({ bookingId: activeBooking._id });
      if (dbReview) break;
      await new Promise(r => setTimeout(r, 400));
    }
    report('Customer Rating & Review Saved in MongoDB', !!dbReview && dbReview.rating === 5, `Rating: ${dbReview?.rating} Stars, Review: "${dbReview?.comment}"`);

    // 12. Customer Raises Complaint
    await customerPage.goto(`${BASE_URL}/customer/bookings`, { waitUntil: 'networkidle2' });
    await customerPage.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Raise a Complaint') || b.textContent.includes('Raise Complaint')),
      { timeout: 10000 }
    );
    const complaintBtn = await customerPage.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.includes('Raise a Complaint') || b.textContent.includes('Raise Complaint'));
    });
    await complaintBtn.click();

    await customerPage.waitForSelector('.modal textarea, textarea.form-textarea', { timeout: 5000 });
    const complaintText = 'The technician forgot to test the cold water supply before departure.';
    await customerPage.evaluate((text) => {
      const areas = Array.from(document.querySelectorAll('textarea'));
      const activeArea = areas[areas.length - 1]; // Modal textarea is the last one in DOM
      if (activeArea) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(activeArea, text);
        activeArea.dispatchEvent(new Event('input', { bubbles: true }));
        activeArea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, complaintText);
    
    const sendComplaintBtn = await customerPage.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      return btns.find(b => b.textContent.includes('Submit Complaint'));
    });
    await sendComplaintBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    const dbComplaint = await Complaint.findOne({ customerId: cust._id }).sort({ createdAt: -1 });
    report('Customer Complaint Stored in MongoDB', !!dbComplaint && dbComplaint.description === complaintText, `Category: ${dbComplaint?.category}, Status: ${dbComplaint?.status}`);

  } catch (err) {
    console.error('Test suite execution error:', err);
    report('Lifecycle Suite Execution Error', false, err.message);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }

  const passedCount = results.filter(r => r.passed).length;
  console.log(`\nLifecycle Suite Complete: ${passedCount}/${results.length} Passed\n`);
}

runWorkerLifecycleTests();
