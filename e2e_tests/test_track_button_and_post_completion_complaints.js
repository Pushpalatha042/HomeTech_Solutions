import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';
import path from 'path';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';
const ARTIFACT_DIR = 'C:\\Users\\DELL\\.gemini\\antigravity\\brain\\c0d200c3-07ce-4f75-9a56-1a559efca4b6';

export async function runTrackButtonAndPostCompletionComplaintsTest() {
  console.log('======================================================================');
  console.log('HOMETECH: REMOVE TRACK BUTTON & POST-COMPLETION WORKER COMPLAINTS AUDIT');
  console.log('======================================================================\n');

  const results = [];
  const recordResult = (step, passed, details = '') => {
    results.push({ step, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: Step ${step} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const Complaint = mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }), 'complaints');
  const Service = mongoose.model('Service', new mongoose.Schema({}, { strict: false }), 'services');
  const WorkRequest = mongoose.model('WorkRequest', new mongoose.Schema({}, { strict: false }), 'workrequests');

  // Ensure accounts are clean and have appropriate roles
  await User.findOneAndUpdate(
    { email: 'customer@hometech.demo' },
    {
      roles: ['customer'],
      activeRole: 'customer',
      workerStatus: 'not_applied',
      approvedCategories: []
    }
  );

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

  const customerDoc = await User.findOne({ email: 'customer@hometech.demo' });
  const workerDoc = await User.findOne({ email: 'worker@hometech.demo' });
  const otherWorkerDoc = await User.findOne({ email: 'workerc@hometech.demo' });
  const plumbingService = await Service.findOne({ category: 'Plumbing' });

  // Clean up previous active bookings for customerDoc to ensure fresh clean state
  await Booking.updateMany(
    {
      customerId: customerDoc._id,
      status: {
        $in: [
          'Pending', 'pending',
          'Assigned', 'assigned',
          'Accepted', 'accepted',
          'Awaiting Arrival Verification', 'awaiting arrival verification',
          'In Progress', 'in-progress', 'in_progress'
        ]
      }
    },
    { status: 'Completed', paymentStatus: 'Paid' }
  );

  await WorkRequest.updateMany(
    { workerId: workerDoc._id, status: { $in: ['Pending', 'pending', 'Accepted', 'accepted'] } },
    { status: 'Expired' }
  );

  // Launch browser sessions
  const browserCustomer = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
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

  const pageCust = await browserCustomer.newPage();
  await pageCust.setViewport({ width: 1280, height: 900 });

  const pageWork = await browserWorker.newPage();
  await pageWork.setViewport({ width: 1280, height: 900 });

  const pageAdmin = await browserAdmin.newPage();
  await pageAdmin.setViewport({ width: 1280, height: 900 });

  let testBooking = null;
  let postCompletionComplaintId = null;

  try {
    // ==================================================================
    // TEST A: CUSTOMER TRACK BUTTON VISIBILITY DURING ACTIVE WORK
    // ==================================================================
    console.log('\n--- EXECUTING TEST A: CUSTOMER TRACK BUTTON VISIBILITY ---');

    // 1. Create a fresh Pending booking and WorkRequest
    const bookingReadableId = `HT-BKG-TRK-${Date.now().toString().slice(-4)}`;
    const now = new Date();
    testBooking = await Booking.create({
      bookingId: bookingReadableId,
      customerId: customerDoc._id,
      workerId: null,
      serviceId: plumbingService._id,
      category: 'Plumbing',
      address: '404 Ocean View, Bandra West, Mumbai',
      contactNumber: '9876504444',
      bookingDate: new Date(Date.now() + 86400000),
      bookingTime: '10:00 AM',
      instructions: 'Pipe repair needed in kitchen.',
      status: 'Pending',
      totalAmount: plumbingService.price || 499,
      paymentStatus: 'Pending',
      arrivalOtp: { attemptsCount: 0 },
      createdAt: now,
      updatedAt: now
    });

    const wr = await WorkRequest.create({
      bookingId: testBooking._id,
      workerId: workerDoc._id,
      customerId: customerDoc._id,
      category: 'Plumbing',
      serviceId: plumbingService._id,
      status: 'Pending'
    });

    recordResult('A1. Fresh Booking and Work Request Created', Boolean(testBooking && wr), `Booking: ${testBooking.bookingId}`);

    // 2. Worker Logs In & Accepts Job Request
    await pageWork.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageWork.type('input[type="email"]', 'worker@hometech.demo');
    await pageWork.type('input[type="password"]', 'HomeTech@123');
    await pageWork.click('button[type="submit"]');
    await pageWork.waitForFunction(() => window.location.pathname.includes('/worker/dashboard'), { timeout: 8000 });

    await pageWork.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim().includes('Accept')),
      { timeout: 10000 }
    );

    const acceptBtn = await pageWork.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent.trim().includes('Accept'));
    });
    await acceptBtn.click();

    // Wait for the booking to move to Accepted / Assigned status
    await pageWork.waitForFunction(
      () => Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Start Job')),
      { timeout: 10000 }
    );

    const dbAcceptedBooking = await Booking.findById(testBooking._id);
    recordResult('A2. Worker Accepts Job Request', dbAcceptedBooking.status === 'Accepted', `Status in MongoDB: ${dbAcceptedBooking.status}`);

    // 3. Customer Logs In and verifies Track Worker IS available while booking is Accepted
    await pageCust.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageCust.type('input[type="email"]', 'customer@hometech.demo');
    await pageCust.type('input[type="password"]', 'HomeTech@123');
    await pageCust.click('button[type="submit"]');
    await pageCust.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 8000 });

    await pageCust.waitForSelector(`a[href="/tracking/${testBooking._id}"]`, { timeout: 6000 });
    const hasTrackBtnAccepted = await pageCust.$(`a[href="/tracking/${testBooking._id}"]`);
    recordResult('A3. Track Worker Button Available When Accepted', Boolean(hasTrackBtnAccepted), 'Track Worker button is visible');

    // 4. Worker clicks "Start Job" -> Triggers Arrival Verification
    await pageWork.bringToFront();
    await pageWork.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Start Job'));
      if (btn) btn.click();
    });

    await pageWork.waitForSelector('input[maxlength="6"]', { timeout: 8000 });
    const awaitingBooking = await Booking.findById(testBooking._id);
    recordResult('A4. Start Job Triggers Arrival Verification', awaitingBooking.status === 'Awaiting Arrival Verification', `Status: ${awaitingBooking.status}`);

    // 5. Customer Dashboard Displays Arrival OTP
    await pageCust.bringToFront();
    await pageCust.reload({ waitUntil: 'networkidle2' });
    await pageCust.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="arrival-otp-code"]');
        return el && /^\d{6}$/.test(el.textContent.trim());
      },
      { timeout: 10000 }
    );

    const customerOtp = await pageCust.$eval('[data-testid="arrival-otp-code"]', el => el.textContent.trim());
    recordResult('A5. Customer Dashboard Displays 6-Digit Arrival OTP', /^\d{6}$/.test(customerOtp), `Arrival OTP: ${customerOtp}`);

    // 6. Worker Enters OTP and verifies -> status becomes in-progress
    await pageWork.bringToFront();
    await pageWork.type('input[maxlength="6"]', customerOtp);
    const verifySubmitBtn = await pageWork.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button[type="submit"]'));
      return btns.find(b => b.textContent.includes('Verify') || b.textContent.includes('Submit'));
    });
    if (verifySubmitBtn && (await verifySubmitBtn.asElement())) {
      await verifySubmitBtn.click();
    }
    await new Promise(r => setTimeout(r, 1200));

    const inProgressBooking = await Booking.findById(testBooking._id);
    recordResult('A6. Worker Verifies OTP -> In-Progress', inProgressBooking.status === 'In Progress' || inProgressBooking.status === 'in-progress', `Status: ${inProgressBooking.status}`);

    // 7. Customer Dashboard in-progress checks:
    // - Track Worker disappears
    // - Complete Service appears
    // - Raise a Complaint appears
    await pageCust.bringToFront();
    await pageCust.reload({ waitUntil: 'networkidle2' });
    await pageCust.waitForSelector('[data-testid="complete-service-btn"]', { timeout: 8000 });

    const trackBtnInProgress = await pageCust.$(`a[href="/tracking/${testBooking._id}"]`);
    const trackBtnGone = (trackBtnInProgress === null);
    recordResult('A7. Track Worker Button Disappears During In-Progress', trackBtnGone, 'Track button absent from in-progress job');

    const completeBtn = await pageCust.$('[data-testid="complete-service-btn"]');
    recordResult('A8. Complete Service Action Appears', Boolean(completeBtn), 'Complete Service button visible');

    const custComplaintBtn = await pageCust.$('[data-testid="raise-complaint-btn"]');
    recordResult('A9. Customer Raise a Complaint Action Appears', Boolean(custComplaintBtn), 'Raise a Complaint button visible');

    // 8. Refresh Customer Dashboard & verify persistence
    await pageCust.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const trackBtnGoneAfterReload = (await pageCust.$(`a[href="/tracking/${testBooking._id}"]`)) === null;
    const completeBtnAfterReload = Boolean(await pageCust.$('[data-testid="complete-service-btn"]'));
    recordResult('A10. Correct Customer Actions Persist Across Reload', trackBtnGoneAfterReload && completeBtnAfterReload, 'Track button remains absent; Complete button remains present');

    // Screenshot customer in-progress dashboard
    await pageCust.screenshot({
      path: path.join(ARTIFACT_DIR, 'customer_in_progress_no_track_button.png'),
      fullPage: false
    });

    // ==================================================================
    // TEST B: WORKER COMPLAINT DURING ACTIVE WORK
    // ==================================================================
    console.log('\n--- EXECUTING TEST B: WORKER COMPLAINT DURING ACTIVE WORK ---');

    await pageWork.bringToFront();
    await pageWork.goto(`${BASE_URL}/worker/dashboard`, { waitUntil: 'networkidle2' });
    await pageWork.waitForSelector(`[data-testid="raise-complaint-btn-${testBooking.bookingId}"]`, { timeout: 6000 });

    // Open complaint modal on in-progress booking
    await pageWork.click(`[data-testid="raise-complaint-btn-${testBooking.bookingId}"]`);
    await pageWork.waitForSelector('[data-testid="complaint-category-select"]', { timeout: 4000 });

    // Select category 'Unsafe Workplace'
    await pageWork.select('[data-testid="complaint-category-select"]', 'Unsafe Workplace');
    await pageWork.type('[data-testid="complaint-description-input"]', 'Active plumbing leak with exposed 230V live socket near the flooded pipe.');

    // Submit complaint
    await pageWork.click('[data-testid="submit-complaint-btn"]');
    await pageWork.waitForFunction(() => !document.querySelector('[data-testid="complaint-category-select"]'), { timeout: 5000 });

    // Verify stored in MongoDB
    const activeComplaint = await Complaint.findOne({
      bookingId: testBooking._id,
      submittedBy: workerDoc._id,
      category: 'Unsafe Workplace'
    });

    recordResult(
      'B1. Worker Active Complaint Persisted in MongoDB',
      Boolean(activeComplaint && activeComplaint.complaintId.startsWith('CMP-WKR-')),
      `Complaint ID: ${activeComplaint?.complaintId}`
    );

    recordResult(
      'B2. Active Complaint Associated With In-Progress Booking',
      activeComplaint && activeComplaint.bookingId.toString() === testBooking._id.toString(),
      `Associated with ${testBooking.bookingId}`
    );

    // ==================================================================
    // TEST C: WORKER COMPLAINT AFTER COMPLETION (CRITICAL REQUIREMENT)
    // ==================================================================
    console.log('\n--- EXECUTING TEST C: WORKER COMPLAINT AFTER SERVICE COMPLETION ---');

    // 1. Customer confirms completion
    await pageCust.bringToFront();
    await pageCust.click('[data-testid="complete-service-btn"]');
    await pageCust.waitForSelector('[data-testid="confirm-completion-btn"]', { timeout: 5000 });
    await pageCust.click('[data-testid="confirm-completion-btn"]');
    await new Promise(r => setTimeout(r, 1500));

    // Verify in MongoDB: status is 'completed'
    const completedBookingDoc = await Booking.findById(testBooking._id);
    const isBookingCompleted = completedBookingDoc.status.toLowerCase() === 'completed';
    recordResult('C1. Booking Transitions to Completed', isBookingCompleted, `Status: ${completedBookingDoc.status}`);

    // 2. Worker navigates to Service History
    await pageWork.bringToFront();
    await pageWork.goto(`${BASE_URL}/worker/dashboard?tab=history`, { waitUntil: 'networkidle2' });
    await pageWork.waitForSelector('.service-history-section', { timeout: 6000 });

    // 3. Locate the completed booking and verify Raise a Complaint is available
    await pageWork.waitForSelector(`[data-testid="raise-complaint-btn-${testBooking.bookingId}"]`, { timeout: 6000 });
    const hasPostCompletionComplaintBtn = await pageWork.$(`[data-testid="raise-complaint-btn-${testBooking.bookingId}"]`);
    recordResult('C2. Raise Complaint Available on Completed Booking in History', Boolean(hasPostCompletionComplaintBtn), 'Button is present on completed booking');

    // 4. Click Raise a Complaint on that completed booking
    await pageWork.click(`[data-testid="raise-complaint-btn-${testBooking.bookingId}"]`);
    await pageWork.waitForSelector('[data-testid="complaint-category-select"]', { timeout: 4000 });

    // 5. Verify modal pre-populated details
    const modalBookingRef = await pageWork.$eval('[data-testid="complaint-modal-booking-id"]', el => el.textContent);
    const modalCustomer = await pageWork.$eval('[data-testid="complaint-modal-customer"]', el => el.textContent);
    const modalStatus = await pageWork.$eval('[data-testid="complaint-modal-status"]', el => el.textContent);

    const isPrepopulatedCorrect = modalBookingRef.includes(testBooking.bookingId) &&
      modalCustomer.includes(customerDoc.name) &&
      modalStatus.toLowerCase().includes('completed');

    recordResult(
      'C3. Completed Booking Complaint Modal Pre-Populated',
      isPrepopulatedCorrect,
      `Ref: ${modalBookingRef.trim()} | Cust: ${modalCustomer.trim()} | Status: ${modalStatus.trim()}`
    );

    // 6. Select category 'Payment Dispute' and submit
    await pageWork.select('[data-testid="complaint-category-select"]', 'Payment Dispute');
    await pageWork.type(
      '[data-testid="complaint-description-input"]',
      'Customer refused to acknowledge the additional fittings cost agreed upon prior to completion.'
    );

    await pageWork.click('[data-testid="submit-complaint-btn"]');
    await pageWork.waitForFunction(() => !document.querySelector('[data-testid="complaint-category-select"]'), { timeout: 5000 });

    // 7. Verify submission succeeds in MongoDB against the exact completed booking
    const postCompletionComplaint = await Complaint.findOne({
      bookingId: testBooking._id,
      submittedBy: workerDoc._id,
      category: 'Payment Dispute'
    }).sort({ createdAt: -1 });

    const complaintPersisted = Boolean(postCompletionComplaint && postCompletionComplaint.complaintId.startsWith('CMP-WKR-'));
    if (postCompletionComplaint) {
      postCompletionComplaintId = postCompletionComplaint.complaintId;
    }

    recordResult(
      'C4. Post-Completion Complaint Stored in MongoDB',
      complaintPersisted,
      `Saved with ID: ${postCompletionComplaintId} against completed booking ${testBooking.bookingId}`
    );

    // 8. Refresh worker Service History and verify complaint info & live status badge
    await pageWork.reload({ waitUntil: 'networkidle2' });
    await pageWork.waitForSelector(`[data-testid="complaint-info-${testBooking.bookingId}"]`, { timeout: 6000 });
    const complaintCardText = await pageWork.$eval(`[data-testid="complaint-info-${testBooking.bookingId}"]`, el => el.textContent);

    const showsComplaintId = complaintCardText.includes(postCompletionComplaintId);
    const showsCategory = complaintCardText.includes('Payment Dispute');
    const showsSubmittedStatus = complaintCardText.includes('Submitted');

    recordResult(
      'C5. Worker Service History Displays Complaint Status Information',
      showsComplaintId && showsCategory && showsSubmittedStatus,
      `Rendered ID: ${postCompletionComplaintId}, Category: Payment Dispute, Status: Submitted`
    );

    // Screenshot Worker Service History with post-completion complaint card
    await pageWork.screenshot({
      path: path.join(ARTIFACT_DIR, 'worker_history_post_completion_complaint.png'),
      fullPage: false
    });

    // 9. Admin Dashboard Integration: Admin reviews the post-completion complaint
    await pageAdmin.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageAdmin.type('input[type="email"]', 'admin@hometech.demo');
    await pageAdmin.type('input[type="password"]', 'HomeTech@123');
    await pageAdmin.click('button[type="submit"]');
    await pageAdmin.waitForFunction(() => window.location.pathname.includes('/admin/dashboard'), { timeout: 8000 });

    // Navigate to Admin Complaints Tab
    await pageAdmin.goto(`${BASE_URL}/admin/dashboard?tab=complaints`, { waitUntil: 'networkidle2' });
    await pageAdmin.waitForSelector('[data-testid="tab-worker-complaints"]', { timeout: 5000 });
    await pageAdmin.click('[data-testid="tab-worker-complaints"]');

    // Search by complaint ID
    await pageAdmin.type('[data-testid="admin-complaint-search-input"]', postCompletionComplaintId);
    await new Promise(r => setTimeout(r, 600));

    // Open review modal
    await pageAdmin.waitForSelector(`[data-testid="review-complaint-btn-${postCompletionComplaintId}"]`, { timeout: 5000 });
    await pageAdmin.click(`[data-testid="review-complaint-btn-${postCompletionComplaintId}"]`);

    await pageAdmin.waitForSelector('[data-testid="complaint-status-select"]', { timeout: 4000 });
    await pageAdmin.select('[data-testid="complaint-status-select"]', 'Resolved');
    await pageAdmin.type(
      '[data-testid="complaint-admin-notes-input"]',
      'Payment dispute resolved. Accounting dispatched supplemental reimbursement of ₹200 to worker.'
    );

    await pageAdmin.click('[data-testid="save-complaint-btn"]');
    await pageAdmin.waitForFunction(() => !document.querySelector('[data-testid="complaint-status-select"]'), { timeout: 5000 });

    // Verify in MongoDB: status is 'Resolved' with admin notes
    const resolvedInDb = await Complaint.findOne({ complaintId: postCompletionComplaintId });
    recordResult(
      'C6. Admin Resolves Post-Completion Worker Complaint',
      resolvedInDb && resolvedInDb.status === 'Resolved' && resolvedInDb.adminNotes.includes('reimbursement'),
      `Status: ${resolvedInDb?.status}, Admin Notes Saved`
    );

    // Screenshot Admin Complaint Review
    await pageAdmin.screenshot({
      path: path.join(ARTIFACT_DIR, 'admin_worker_complaint_management.png'),
      fullPage: false
    });

    // 10. Worker views Admin Resolution and Notes in Service History
    await pageWork.bringToFront();
    await pageWork.reload({ waitUntil: 'networkidle2' });
    await pageWork.waitForSelector(`[data-testid="complaint-info-${testBooking.bookingId}"]`, { timeout: 6000 });
    const refreshedWorkerCardText = await pageWork.$eval(`[data-testid="complaint-info-${testBooking.bookingId}"]`, el => el.textContent);

    const showsResolved = refreshedWorkerCardText.includes('Resolved');
    const showsAdminNotes = refreshedWorkerCardText.includes('reimbursement');

    recordResult(
      'C7. Worker Sees Admin Resolution & Notes in Service History',
      showsResolved && showsAdminNotes,
      'Admin response notes rendered directly in Service History complaint card'
    );

    // ==================================================================
    // TEST D: AUTHORIZATION & IDOR RESTRICTIONS
    // ==================================================================
    console.log('\n--- EXECUTING TEST D: AUTHORIZATION & IDOR RESTRICTIONS ---');

    const workerToken = await pageWork.evaluate(() => localStorage.getItem('hometech_token'));

    // 1. Worker tries to submit a complaint for another worker's booking
    const otherWorkerBooking = await Booking.create({
      bookingId: `HT-BKG-OTHER-${Date.now().toString().slice(-4)}`,
      customerId: customerDoc._id,
      workerId: otherWorkerDoc._id, // BELONGS TO WORKER C, NOT WORKER A
      serviceId: plumbingService._id,
      category: 'Plumbing',
      address: '78 Gandhinagar, Vijayawada',
      contactNumber: '9876503333',
      bookingDate: new Date(),
      bookingTime: '11:00 AM',
      instructions: 'Inspection',
      totalAmount: 499,
      paymentStatus: 'Paid',
      status: 'Completed'
    });

    const unauthResponse = await fetch('http://localhost:5000/api/complaints/worker', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${workerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookingId: otherWorkerBooking._id,
        category: 'Unreasonable Additional Work',
        description: 'Attempting to file against another technician booking.'
      })
    });

    recordResult(
      'D1. Cross-Worker Booking Complaint Rejected (IDOR Defense)',
      unauthResponse.status === 403,
      `HTTP Status: ${unauthResponse.status} Forbidden`
    );

    // 2. Worker tries to submit complaint with an invalid booking ID
    const invalidIdResponse = await fetch('http://localhost:5000/api/complaints/worker', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${workerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bookingId: '64f000000000000000000099',
        category: 'Customer Misconduct',
        description: 'Filing against nonexistent booking.'
      })
    });

    recordResult(
      'D2. Invalid Booking ID Rejected',
      invalidIdResponse.status === 404,
      `HTTP Status: ${invalidIdResponse.status} Not Found`
    );

    // 3. Customer Dashboard never exposes private worker complaints
    const customerToken = await pageCust.evaluate(() => localStorage.getItem('hometech_token'));
    const customerComplaintsCheck = await fetch(`http://localhost:5000/api/complaints/booking/${testBooking._id}`, {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    const customerComplaintsData = await customerComplaintsCheck.json();
    const hasWorkerComplaintLeaked = Array.isArray(customerComplaintsData) &&
      customerComplaintsData.some(c => c.complaintType === 'worker');

    recordResult(
      'D3. Privacy Isolation: Worker Complaints Never Leaked to Customer',
      !hasWorkerComplaintLeaked,
      'Customer endpoint returns zero worker complaints for this booking'
    );

    // Cleanup test bookings
    await Booking.deleteMany({ bookingId: { $in: [testBooking.bookingId, otherWorkerBooking.bookingId] } });
    await Complaint.deleteMany({ bookingId: { $in: [testBooking._id, otherWorkerBooking._id] } });

  } catch (err) {
    console.error('Test execution error:', err);
    recordResult('Execution', false, err.message);
  } finally {
    await browserCustomer.close();
    await browserWorker.close();
    await browserAdmin.close();
    await mongoose.disconnect();
  }

  console.log('\n======================================================================');
  console.log('AUDIT SUMMARY: TRACK BUTTON & POST-COMPLETION COMPLAINTS');
  console.log('======================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL CHECKS: ${results.length}`);
  console.log(`PASSED: ${results.filter(r => r.passed).length}`);
  console.log(`FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);

  return allPassed;
}

if (process.argv[1]?.endsWith('test_track_button_and_post_completion_complaints.js')) {
  runTrackButtonAndPostCompletionComplaintsTest()
    .then((passed) => process.exit(passed ? 0 : 1))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
