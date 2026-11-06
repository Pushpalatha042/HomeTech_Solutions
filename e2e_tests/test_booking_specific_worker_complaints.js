import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

export async function runBookingSpecificWorkerComplaintsTest() {
  console.log('======================================================================');
  console.log('HOMETECH: BOOKING-SPECIFIC WORKER COMPLAINTS AUDIT');
  console.log('======================================================================\n');

  const results = [];
  const recordResult = (step, passed, details = '') => {
    results.push({ step, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: Step ${step} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Complaint = mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }), 'complaints');
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const Service = mongoose.model('Service', new mongoose.Schema({}, { strict: false }), 'services');

  // Ensure worker account is ready
  await User.findOneAndUpdate(
    { email: 'worker@hometech.demo' },
    {
      roles: ['customer', 'worker'],
      activeRole: 'worker',
      approvedCategories: ['Plumbing', 'Electrical'],
      workerStatus: 'approved',
      isAvailable: true,
      isActive: true
    }
  );

  const workerDoc = await User.findOne({ email: 'worker@hometech.demo' });
  const otherWorkerDoc = await User.findOne({ email: 'workerc@hometech.demo' });
  const plumbingService = await Service.findOne({ category: 'Plumbing' });

  // Create two distinct mock customers
  let customerOne = await User.findOne({ email: 'customer.alpha@test.demo' });
  if (!customerOne) {
    customerOne = await User.create({
      name: 'Alpha Customer',
      email: 'customer.alpha@test.demo',
      phone: '9876543201',
      password: 'TestPassword@123',
      roles: ['customer'],
      activeRole: 'customer',
      isActive: true
    });
  }

  let customerTwo = await User.findOne({ email: 'customer.beta@test.demo' });
  if (!customerTwo) {
    customerTwo = await User.create({
      name: 'Beta Customer',
      email: 'customer.beta@test.demo',
      phone: '9876543202',
      password: 'TestPassword@123',
      roles: ['customer'],
      activeRole: 'customer',
      isActive: true
    });
  }

  // Create Booking A for workerDoc
  const bookingAId = `BK-WKR-A-${Date.now().toString().slice(-4)}`;
  const bookingA = await Booking.create({
    bookingId: bookingAId,
    customerId: customerOne._id,
    workerId: workerDoc._id,
    serviceId: plumbingService._id,
    category: 'Plumbing',
    serviceName: plumbingService.name,
    pricing: { totalAmount: 499 },
    serviceAddress: { fullAddress: '101 Alpha Tower, Sector 62', city: 'Noida', pincode: '201301' },
    scheduledDate: new Date(),
    status: 'Accepted'
  });

  // Create Booking B for workerDoc
  const bookingBId = `BK-WKR-B-${Date.now().toString().slice(-4)}`;
  const bookingB = await Booking.create({
    bookingId: bookingBId,
    customerId: customerTwo._id,
    workerId: workerDoc._id,
    serviceId: plumbingService._id,
    category: 'Plumbing',
    serviceName: plumbingService.name,
    pricing: { totalAmount: 799 },
    serviceAddress: { fullAddress: '202 Beta Residency, Sector 18', city: 'Noida', pincode: '201301' },
    scheduledDate: new Date(Date.now() + 86400000),
    status: 'Accepted'
  });

  // Create Booking C assigned to otherWorkerDoc (to test ownership validation)
  const bookingCId = `BK-WKR-C-OTHER-${Date.now().toString().slice(-4)}`;
  const bookingC = await Booking.create({
    bookingId: bookingCId,
    customerId: customerOne._id,
    workerId: otherWorkerDoc?._id || new mongoose.Types.ObjectId(),
    serviceId: plumbingService._id,
    category: 'Plumbing',
    serviceName: plumbingService.name,
    pricing: { totalAmount: 399 },
    serviceAddress: { fullAddress: '303 Other Street', city: 'Noida', pincode: '201301' },
    scheduledDate: new Date(),
    status: 'Accepted'
  });

  const browserWorker = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const browserAdmin = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const pageWorker = await browserWorker.newPage();
  await pageWorker.setViewport({ width: 1280, height: 900 });

  const pageAdmin = await browserAdmin.newPage();
  await pageAdmin.setViewport({ width: 1280, height: 900 });

  let complaintA_ID = null;
  let complaintB_ID = null;

  try {
    // ------------------------------------------------------------------
    // STEP 1: Log in as Worker
    // ------------------------------------------------------------------
    await pageWorker.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageWorker.waitForSelector('input[type="email"]');
    await pageWorker.type('input[type="email"]', 'worker@hometech.demo');
    await pageWorker.type('input[type="password"]', 'HomeTech@123');
    await pageWorker.click('button[type="submit"]');

    await pageWorker.waitForFunction(() => window.location.pathname.includes('/worker/dashboard'), { timeout: 8000 });
    recordResult('1. Worker Login', true, 'Navigated to Worker Dashboard');

    // ------------------------------------------------------------------
    // STEP 2: Verify Global Complaint Button is REMOVED from Header
    // ------------------------------------------------------------------
    const globalComplaintBtn = await pageWorker.$('[data-testid="worker-raise-complaint-btn"]');
    recordResult(
      '2. Global Complaint Button Removed',
      globalComplaintBtn === null,
      'Global header complaint button is completely absent from header card'
    );

    // Verify Update Availability Status button remains present & functional
    const availabilityBtn = await pageWorker.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent.includes('Status: Available') || b.textContent.includes('Status: Offline'));
    });
    recordResult('2b. Update Availability Unchanged', availabilityBtn, 'Availability toggle remains in header');

    // ------------------------------------------------------------------
    // STEP 3: Verify Each Booking Card Has Its Own Raise Complaint Button
    // ------------------------------------------------------------------
    await pageWorker.waitForSelector(`[data-testid="raise-complaint-btn-${bookingAId}"]`, { timeout: 6000 });
    await pageWorker.waitForSelector(`[data-testid="raise-complaint-btn-${bookingBId}"]`, { timeout: 6000 });

    const btnA = await pageWorker.$(`[data-testid="raise-complaint-btn-${bookingAId}"]`);
    const btnB = await pageWorker.$(`[data-testid="raise-complaint-btn-${bookingBId}"]`);

    recordResult(
      '3. Individual Booking Complaint Buttons',
      Boolean(btnA) && Boolean(btnB),
      `Found individual complaint buttons for ${bookingAId} and ${bookingBId}`
    );

    // ------------------------------------------------------------------
    // STEP 4: Click Raise Complaint on Booking A & Verify Pre-populated Details
    // ------------------------------------------------------------------
    await pageWorker.click(`[data-testid="raise-complaint-btn-${bookingAId}"]`);
    await pageWorker.waitForSelector('[data-testid="complaint-modal-booking-id"]', { timeout: 4000 });

    const modalBookingA = await pageWorker.$eval('[data-testid="complaint-modal-booking-id"]', el => el.textContent);
    const modalCustomerA = await pageWorker.$eval('[data-testid="complaint-modal-customer"]', el => el.textContent);
    const modalCategoryA = await pageWorker.$eval('[data-testid="complaint-modal-category"]', el => el.textContent);

    const matchesBookingA = modalBookingA.includes(bookingAId);
    const matchesCustomerA = modalCustomerA.includes('Alpha Customer');
    const matchesCategoryA = modalCategoryA.includes('Plumbing');

    recordResult(
      '4. Booking A Auto-Populated Details',
      matchesBookingA && matchesCustomerA && matchesCategoryA,
      `Populated: ${modalBookingA}, ${modalCustomerA}, ${modalCategoryA}`
    );

    // ------------------------------------------------------------------
    // STEP 5: Submit Complaint on Booking A
    // ------------------------------------------------------------------
    await pageWorker.select('[data-testid="complaint-category-select"]', 'Customer Misconduct');
    await pageWorker.type(
      '[data-testid="complaint-description-input"]',
      'Customer Alpha became verbally abusive when requested to sign completion notes and refused safety check.'
    );

    await pageWorker.click('[data-testid="submit-complaint-btn"]');
    await pageWorker.waitForFunction(() => !document.querySelector('[data-testid="complaint-modal-booking-id"]'), { timeout: 5000 });

    // Verify Booking A complaint in MongoDB
    const complaintADoc = await Complaint.findOne({
      bookingId: bookingA._id,
      category: 'Customer Misconduct'
    });

    const isComplaintASaved =
      complaintADoc &&
      complaintADoc.customerId?.toString() === customerOne._id.toString() &&
      complaintADoc.workerId?.toString() === workerDoc._id.toString() &&
      complaintADoc.complaintType === 'worker';

    if (complaintADoc) complaintA_ID = complaintADoc.complaintId;

    recordResult(
      '5. Booking A Complaint Persistence in MongoDB',
      Boolean(isComplaintASaved),
      `Saved: ${complaintA_ID}, linked to Booking A & Customer Alpha`
    );

    // ------------------------------------------------------------------
    // STEP 6: Verify Booking A Card Displays Complaint Status Badge
    // ------------------------------------------------------------------
    await pageWorker.waitForSelector(`[data-testid="booking-complaint-badge-${bookingAId}"]`, { timeout: 5000 });
    const badgeTextA = await pageWorker.$eval(`[data-testid="booking-complaint-badge-${bookingAId}"]`, el => el.textContent);
    recordResult(
      '6. Booking A Complaint Badge on Card',
      badgeTextA.includes('Submitted'),
      `Booking card shows live status: ${badgeTextA}`
    );

    // ------------------------------------------------------------------
    // STEP 7: Click Raise Complaint on Booking B & Verify Pre-populated Details
    // ------------------------------------------------------------------
    await pageWorker.click(`[data-testid="raise-complaint-btn-${bookingBId}"]`);
    await pageWorker.waitForSelector('[data-testid="complaint-modal-booking-id"]', { timeout: 4000 });

    const modalBookingB = await pageWorker.$eval('[data-testid="complaint-modal-booking-id"]', el => el.textContent);
    const modalCustomerB = await pageWorker.$eval('[data-testid="complaint-modal-customer"]', el => el.textContent);

    const matchesBookingB = modalBookingB.includes(bookingBId);
    const matchesCustomerB = modalCustomerB.includes('Beta Customer');
    const doesNotMatchA = !modalBookingB.includes(bookingAId) && !modalCustomerB.includes('Alpha Customer');

    recordResult(
      '7. Booking B Auto-Populated Details Distinct from A',
      matchesBookingB && matchesCustomerB && doesNotMatchA,
      `Populated: ${modalBookingB}, ${modalCustomerB} (Not Booking A)`
    );

    // ------------------------------------------------------------------
    // STEP 8: Submit Complaint on Booking B
    // ------------------------------------------------------------------
    await pageWorker.select('[data-testid="complaint-category-select"]', 'Customer Providing Incorrect Address');
    await pageWorker.type(
      '[data-testid="complaint-description-input"]',
      'The provided location in Sector 18 is an abandoned locked plot with no water inlet.'
    );

    await pageWorker.click('[data-testid="submit-complaint-btn"]');
    await pageWorker.waitForFunction(() => !document.querySelector('[data-testid="complaint-modal-booking-id"]'), { timeout: 5000 });

    // Verify Booking B complaint in MongoDB
    const complaintBDoc = await Complaint.findOne({
      bookingId: bookingB._id,
      category: 'Customer Providing Incorrect Address'
    });

    const isComplaintBSaved =
      complaintBDoc &&
      complaintBDoc.customerId?.toString() === customerTwo._id.toString() &&
      complaintBDoc.workerId?.toString() === workerDoc._id.toString() &&
      complaintBDoc.complaintType === 'worker';

    if (complaintBDoc) complaintB_ID = complaintBDoc.complaintId;

    recordResult(
      '8. Booking B Complaint Persistence in MongoDB',
      Boolean(isComplaintBSaved),
      `Saved: ${complaintB_ID}, linked to Booking B & Customer Beta`
    );

    // ------------------------------------------------------------------
    // STEP 9: Verify Both Complaints Strictly Linked to Their Respective Bookings
    // ------------------------------------------------------------------
    const strictSeparation =
      complaintADoc.bookingId.toString() !== complaintBDoc.bookingId.toString() &&
      complaintADoc.customerId.toString() !== complaintBDoc.customerId.toString() &&
      complaintADoc.bookingId.toString() === bookingA._id.toString() &&
      complaintBDoc.bookingId.toString() === bookingB._id.toString();

    recordResult(
      '9. Strict Booking-to-Complaint Mapping Integrity',
      strictSeparation,
      'Complaint A -> Booking A, Complaint B -> Booking B'
    );

    // ------------------------------------------------------------------
    // STEP 10: Verify Both Complaints in Admin Dashboard
    // ------------------------------------------------------------------
    await pageAdmin.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageAdmin.waitForSelector('input[type="email"]');
    await pageAdmin.type('input[type="email"]', 'admin@hometech.demo');
    await pageAdmin.type('input[type="password"]', 'HomeTech@123');
    await pageAdmin.click('button[type="submit"]');

    await pageAdmin.waitForFunction(() => window.location.pathname.includes('/admin/dashboard'), { timeout: 8000 });
    await pageAdmin.goto(`${BASE_URL}/admin/dashboard?tab=complaints`, { waitUntil: 'networkidle2' });

    await pageAdmin.waitForSelector('[data-testid="tab-worker-complaints"]', { timeout: 5000 });
    await pageAdmin.click('[data-testid="tab-worker-complaints"]');

    await pageAdmin.waitForSelector(`[data-testid="complaint-row-${complaintA_ID}"]`, { timeout: 6000 });
    await pageAdmin.waitForSelector(`[data-testid="complaint-row-${complaintB_ID}"]`, { timeout: 6000 });

    const rowAText = await pageAdmin.$eval(`[data-testid="complaint-row-${complaintA_ID}"]`, el => el.textContent);
    const rowBText = await pageAdmin.$eval(`[data-testid="complaint-row-${complaintB_ID}"]`, el => el.textContent);

    const rowAValid = rowAText.includes(bookingAId) && rowAText.includes('Customer Misconduct');
    const rowBValid = rowBText.includes(bookingBId) && rowBText.includes('Customer Providing Incorrect Address');

    recordResult(
      '10. Admin Dashboard Worker Complaints Verification',
      rowAValid && rowBValid,
      'Both booking-specific complaints appear in admin console with respective booking IDs'
    );

    // ------------------------------------------------------------------
    // STEP 11: Backend Security Check - Worker Cannot Submit for Unassigned Booking C
    // ------------------------------------------------------------------
    const workerToken = await pageWorker.evaluate(() => localStorage.getItem('hometech_token'));
    const unauthorizedResponse = await fetch(`http://localhost:5000/api/complaints/worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        bookingId: bookingC._id.toString(),
        category: 'Unsafe Workplace',
        description: 'Attempting unauthorized complaint for booking assigned to other worker'
      })
    });

    const unauthorizedData = await unauthorizedResponse.json();
    const isRejected403 = unauthorizedResponse.status === 403;
    recordResult(
      '11. Backend Ownership Enforcement (IDOR Protection)',
      isRejected403,
      `HTTP ${unauthorizedResponse.status}: "${unauthorizedData.message}"`
    );

    // Clean up test bookings and complaints
    await Booking.deleteMany({ bookingId: { $in: [bookingAId, bookingBId, bookingCId] } });
    await Complaint.deleteMany({ complaintId: { $in: [complaintA_ID, complaintB_ID] } });
    await User.deleteMany({ email: { $in: ['customer.alpha@test.demo', 'customer.beta@test.demo'] } });

  } catch (err) {
    console.error('Test execution error:', err);
    recordResult('Execution', false, err.message);
  } finally {
    await browserWorker.close();
    await browserAdmin.close();
    await mongoose.disconnect();
  }

  console.log('\n======================================================================');
  console.log('AUDIT SUMMARY: BOOKING-SPECIFIC WORKER COMPLAINTS');
  console.log('======================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL CHECKS: ${results.length}`);
  console.log(`PASSED: ${results.filter(r => r.passed).length}`);
  console.log(`FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);

  return allPassed;
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('test_booking_specific_worker_complaints.js')) {
  runBookingSpecificWorkerComplaintsTest()
    .then(passed => process.exit(passed ? 0 : 1))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
