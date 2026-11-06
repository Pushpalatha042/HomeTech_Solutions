import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

export async function runWorkerComplaintsAndServicesTest() {
  console.log('======================================================================');
  console.log('HOMETECH: WORKER COMPLAINTS & ADDITIONAL CATEGORIES AUDIT');
  console.log('======================================================================\n');

  const results = [];
  const recordResult = (step, passed, details = '') => {
    results.push({ step, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: Step ${step} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Complaint = mongoose.model('Complaint', new mongoose.Schema({}, { strict: false }), 'complaints');
  const WorkerApplication = mongoose.model('WorkerApplication', new mongoose.Schema({}, { strict: false }), 'workerapplications');
  const Service = mongoose.model('Service', new mongoose.Schema({}, { strict: false }), 'services');
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const WorkRequest = mongoose.model('WorkRequest', new mongoose.Schema({}, { strict: false }), 'workrequests');

  // Reset worker to initial clean state for test reproducibility
  await User.findOneAndUpdate(
    { email: 'worker@hometech.demo' },
    {
      roles: ['customer', 'worker'],
      activeRole: 'worker',
      approvedCategories: ['Plumbing'],
      workerStatus: 'approved',
      isAvailable: true,
      isActive: true
    }
  );

  await User.findOneAndUpdate(
    { email: 'admin@hometech.demo' },
    {
      roles: ['admin'],
      activeRole: 'admin',
      isActive: true
    }
  );

  // Clean up any previous test additional applications and worker complaints
  const workerDoc = await User.findOne({ email: 'worker@hometech.demo' });
  const adminDoc = await User.findOne({ email: 'admin@hometech.demo' });
  const customerDoc = await User.findOne({ email: 'customer@hometech.demo' });

  await WorkerApplication.deleteMany({
    userId: workerDoc._id,
    applicationType: 'additional_category'
  });

  // Ensure worker has at least one assigned booking for booking-specific complaint testing
  const plumbingService = await Service.findOne({ category: 'Plumbing' });
  let assignedJobBooking = await Booking.findOne({
    workerId: workerDoc._id,
    status: { $in: ['Accepted', 'accepted', 'In-Progress', 'in-progress'] }
  });
  if (!assignedJobBooking) {
    assignedJobBooking = await Booking.create({
      bookingId: `BK-WKR-INIT-${Date.now().toString().slice(-4)}`,
      customerId: customerDoc._id,
      workerId: workerDoc._id,
      serviceId: plumbingService._id,
      category: 'Plumbing',
      serviceName: plumbingService.name,
      pricing: { totalAmount: 499 },
      serviceAddress: { fullAddress: '101 Initial St, Noida', city: 'Noida', pincode: '201301' },
      scheduledDate: new Date(),
      status: 'Accepted'
    });
  }

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

  let filedComplaintId = null;
  let testAppId = null;

  try {
    // ------------------------------------------------------------------
    // STEP 1: Log in as Worker in Session 1
    // ------------------------------------------------------------------
    await pageWorker.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageWorker.waitForSelector('input[type="email"]');
    await pageWorker.type('input[type="email"]', 'worker@hometech.demo');
    await pageWorker.type('input[type="password"]', 'HomeTech@123');
    await pageWorker.click('button[type="submit"]');

    await pageWorker.waitForFunction(() => window.location.pathname.includes('/worker/dashboard'), { timeout: 8000 });
    recordResult('1. Worker Login', true, 'Navigated to Worker Dashboard');

    // ------------------------------------------------------------------
    // STEP 2: Verify Worker Dashboard Action Buttons (Global Complaint Removed, Booking Complaint Present)
    // ------------------------------------------------------------------
    const globalComplaintBtn = await pageWorker.$('[data-testid="worker-raise-complaint-btn"]');
    await pageWorker.waitForSelector('[data-testid="apply-more-services-btn"]', { timeout: 5000 });
    await pageWorker.waitForSelector(`[data-testid="raise-complaint-btn-${assignedJobBooking.bookingId}"]`, { timeout: 5000 });

    const globalBtnRemoved = (globalComplaintBtn === null);
    recordResult(
      '2. Header Action Buttons & Booking Complaint Button',
      globalBtnRemoved,
      'Global complaint button removed from header; individual booking complaint & apply services present'
    );

    // ------------------------------------------------------------------
    // STEP 3: Test Booking-Specific Worker Complaint Submission
    // ------------------------------------------------------------------
    await pageWorker.click(`[data-testid="raise-complaint-btn-${assignedJobBooking.bookingId}"]`);
    await pageWorker.waitForSelector('[data-testid="complaint-category-select"]', { timeout: 4000 });

    // Select category 'Unsafe Workplace'
    await pageWorker.select('[data-testid="complaint-category-select"]', 'Unsafe Workplace');

    // Enter description
    const complaintText = 'Exposed high-voltage electrical cable in wet ground at customer site without safety breaker.';
    await pageWorker.type('[data-testid="complaint-description-input"]', complaintText);

    // Submit complaint
    await pageWorker.click('[data-testid="submit-complaint-btn"]');

    // Wait for modal to close and state to update
    await pageWorker.waitForFunction(() => !document.querySelector('[data-testid="complaint-category-select"]'), { timeout: 5000 });

    // Verify complaint in MongoDB
    const savedComplaint = await Complaint.findOne({
      submittedBy: workerDoc._id,
      category: 'Unsafe Workplace'
    }).sort({ createdAt: -1 });

    if (savedComplaint && savedComplaint.complaintId && savedComplaint.complaintId.startsWith('CMP-WKR-')) {
      filedComplaintId = savedComplaint.complaintId;
      recordResult('3. Worker Complaint Submission', true, `Complaint saved with ID: ${filedComplaintId}`);
    } else {
      recordResult('3. Worker Complaint Submission', false, 'Complaint not found in MongoDB');
    }

    // ------------------------------------------------------------------
    // STEP 4: Verify Worker "My Complaints" Tab
    // ------------------------------------------------------------------
    // Click sidebar My Complaints tab
    const complaintsMenuItem = await pageWorker.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item, button'));
      return items.find(el => el.textContent.includes('My Complaints'));
    });
    if (complaintsMenuItem) {
      await complaintsMenuItem.click();
    } else {
      await pageWorker.goto(`${BASE_URL}/worker/dashboard?tab=complaints`, { waitUntil: 'networkidle2' });
    }

    await pageWorker.waitForSelector(`[data-testid="complaint-card-${filedComplaintId}"]`, { timeout: 5000 });
    const complaintCardText = await pageWorker.$eval(`[data-testid="complaint-card-${filedComplaintId}"]`, el => el.textContent);
    const hasCategory = complaintCardText.includes('Unsafe Workplace');
    const hasStatus = complaintCardText.includes('Submitted');

    recordResult('4. Worker My Complaints View', hasCategory && hasStatus, `Complaint displayed with status Submitted`);

    // ------------------------------------------------------------------
    // STEP 5: Log in as Admin in Session 2
    // ------------------------------------------------------------------
    await pageAdmin.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await pageAdmin.waitForSelector('input[type="email"]');
    await pageAdmin.type('input[type="email"]', 'admin@hometech.demo');
    await pageAdmin.type('input[type="password"]', 'HomeTech@123');
    await pageAdmin.click('button[type="submit"]');

    await pageAdmin.waitForFunction(() => window.location.pathname.includes('/admin/dashboard'), { timeout: 8000 });
    recordResult('5. Admin Login', true, 'Navigated to Admin Dashboard');

    // ------------------------------------------------------------------
    // STEP 6: Admin Reviews Worker Complaint
    // ------------------------------------------------------------------
    // Navigate to Complaints tab
    const adminComplaintsTab = await pageAdmin.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item, button'));
      return items.find(el => el.textContent.includes('Complaints'));
    });
    if (adminComplaintsTab) {
      await adminComplaintsTab.click();
    } else {
      await pageAdmin.goto(`${BASE_URL}/admin/dashboard?tab=complaints`, { waitUntil: 'networkidle2' });
    }

    await pageAdmin.waitForSelector('[data-testid="tab-worker-complaints"]', { timeout: 5000 });
    await pageAdmin.click('[data-testid="tab-worker-complaints"]');

    // Search by complaint ID
    await pageAdmin.type('[data-testid="admin-complaint-search-input"]', filedComplaintId);
    await new Promise(r => setTimeout(r, 600));

    // Open review modal
    await pageAdmin.waitForSelector(`[data-testid="review-complaint-btn-${filedComplaintId}"]`, { timeout: 5000 });
    await pageAdmin.click(`[data-testid="review-complaint-btn-${filedComplaintId}"]`);

    await pageAdmin.waitForSelector('[data-testid="complaint-status-select"]', { timeout: 4000 });
    await pageAdmin.select('[data-testid="complaint-status-select"]', 'Resolved');
    await pageAdmin.type(
      '[data-testid="complaint-admin-notes-input"]',
      'Safety hazard investigated. Customer site informed and safety clearance issued.'
    );

    await pageAdmin.click('[data-testid="save-complaint-btn"]');
    await pageAdmin.waitForFunction(() => !document.querySelector('[data-testid="complaint-status-select"]'), { timeout: 5000 });

    // Verify in MongoDB
    const updatedComplaint = await Complaint.findOne({ complaintId: filedComplaintId });
    const complaintResolved = updatedComplaint && updatedComplaint.status === 'Resolved';
    recordResult('6. Admin Complaint Resolution', complaintResolved, `Status: ${updatedComplaint?.status}, Notes saved`);

    // ------------------------------------------------------------------
    // STEP 7: Worker Views Resolution & Admin Response
    // ------------------------------------------------------------------
    await pageWorker.reload({ waitUntil: 'networkidle2' });
    await pageWorker.waitForSelector(`[data-testid="complaint-card-${filedComplaintId}"]`, { timeout: 5000 });
    const refreshedCardText = await pageWorker.$eval(`[data-testid="complaint-card-${filedComplaintId}"]`, el => el.textContent);
    const workerSawResolution = refreshedCardText.includes('Resolved') && refreshedCardText.includes('Safety hazard investigated');
    recordResult('7. Worker Sees Admin Resolution', workerSawResolution, 'Worker received admin resolution & notes');

    // ------------------------------------------------------------------
    // STEP 8: Worker Applies for Additional Category (Electrical)
    // ------------------------------------------------------------------
    await pageWorker.goto(`${BASE_URL}/worker/dashboard`, { waitUntil: 'networkidle2' });
    await pageWorker.waitForSelector('[data-testid="apply-more-services-btn"]', { timeout: 5000 });
    await pageWorker.click('[data-testid="apply-more-services-btn"]');

    await pageWorker.waitForSelector('[data-testid="apply-category-checkbox-Electrical"]', { timeout: 4000 });

    // Verify Plumbing is disabled/already approved
    const isPlumbingDisabled = await pageWorker.$eval(
      '[data-testid="apply-category-checkbox-Plumbing"]',
      el => el.disabled
    );
    recordResult('8a. Already Approved Category Disabled', isPlumbingDisabled, 'Plumbing is disabled for re-selection');

    // Select Electrical
    await pageWorker.click('[data-testid="apply-category-checkbox-Electrical"]');
    await pageWorker.type('[data-testid="apply-experience-input"]', '4');
    await pageWorker.type(
      '[data-testid="apply-qualifications-input"]',
      'Licensed Grade A Electrician with 4 years industrial wiring and circuit repair experience.'
    );

    await pageWorker.click('[data-testid="submit-apply-services-btn"]');
    await pageWorker.waitForFunction(() => !document.querySelector('[data-testid="apply-category-checkbox-Electrical"]'), { timeout: 5000 });

    // Verify in MongoDB
    const additionalApp = await WorkerApplication.findOne({
      userId: workerDoc._id,
      applicationType: 'additional_category'
    }).sort({ createdAt: -1 });

    const appSaved = additionalApp && additionalApp.applicationStatus === 'pending' && additionalApp.requestedCategories?.includes('Electrical');
    if (additionalApp) testAppId = additionalApp._id.toString();
    recordResult('8b. Additional Application Submission', appSaved, `Application stored as pending for Electrical`);

    // ------------------------------------------------------------------
    // STEP 9: Verify Worker "My Service Applications" View
    // ------------------------------------------------------------------
    const workerAppsTab = await pageWorker.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item, button'));
      return items.find(el => el.textContent.includes('My Service Applications'));
    });
    if (workerAppsTab) {
      await workerAppsTab.click();
    } else {
      await pageWorker.goto(`${BASE_URL}/worker/dashboard?tab=applications`, { waitUntil: 'networkidle2' });
    }

    await pageWorker.waitForSelector(`[data-testid="application-card-${testAppId}"]`, { timeout: 5000 });
    const appCardText = await pageWorker.$eval(`[data-testid="application-card-${testAppId}"]`, el => el.textContent);
    const showsElectrical = appCardText.includes('Electrical');
    const showsPending = appCardText.includes('Pending Review') || appCardText.includes('pending');
    recordResult('9. Worker My Service Applications View', showsElectrical && showsPending, 'Application displayed with pending badge');

    // ------------------------------------------------------------------
    // STEP 10: Category Eligibility Check (BEFORE ADMIN APPROVAL)
    // Worker MUST NOT receive Electrical bookings while application is pending
    // ------------------------------------------------------------------
    const electricalService = await Service.findOne({ category: 'Electrical' });
    if (!electricalService) throw new Error('No Electrical service found');

    // Check worker's current approved categories in DB
    const preApprovalWorker = await User.findById(workerDoc._id);
    const doesNotHaveElectrical = !preApprovalWorker.approvedCategories.includes('Electrical');

    // Create an Electrical booking to test work request distribution
    const bookingPreApproval = await Booking.create({
      bookingId: `BK-TEST-PRE-${Date.now().toString().slice(-4)}`,
      customerId: customerDoc._id,
      serviceId: electricalService._id,
      category: 'Electrical',
      serviceName: electricalService.name,
      pricing: { totalAmount: 499 },
      serviceAddress: { fullAddress: '100 Sector 15', city: 'Noida', pincode: '201301' },
      scheduledDate: new Date(),
      status: 'pending'
    });

    // Simulate work request distribution for this category
    const eligibleWorkersPre = await User.find({
      roles: 'worker',
      workerStatus: 'approved',
      isActive: true,
      isAvailable: true,
      approvedCategories: { $in: ['Electrical'] }
    });

    const isWorkerEligiblePre = eligibleWorkersPre.some(w => w._id.toString() === workerDoc._id.toString());
    recordResult(
      '10. Eligibility Filter While Pending',
      doesNotHaveElectrical && !isWorkerEligiblePre,
      'Worker with pending application is NOT eligible for Electrical requests'
    );

    // ------------------------------------------------------------------
    // STEP 11: Admin Reviews & Approves Additional Category in Chrome
    // ------------------------------------------------------------------
    // Navigate to Worker Applications in Admin session
    const adminAppsTab = await pageAdmin.evaluateHandle(() => {
      const items = Array.from(document.querySelectorAll('.sidebar-nav-item, button'));
      return items.find(el => el.textContent.includes('Worker Applications') || el.textContent.includes('Applications'));
    });
    if (adminAppsTab) {
      await adminAppsTab.click();
    } else {
      await pageAdmin.goto(`${BASE_URL}/admin/dashboard?tab=applications`, { waitUntil: 'networkidle2' });
    }

    await pageAdmin.waitForSelector('[data-testid="tab-additional-applications"]', { timeout: 5000 });
    await pageAdmin.click('[data-testid="tab-additional-applications"]');

    await pageAdmin.waitForSelector(`[data-testid="review-additional-btn-${testAppId}"]`, { timeout: 5000 });
    await pageAdmin.click(`[data-testid="review-additional-btn-${testAppId}"]`);

    await pageAdmin.waitForSelector('[data-testid="checkbox-approve-Electrical"]', { timeout: 4000 });
    await pageAdmin.type(
      '[data-testid="admin-additional-notes-input"]',
      'Electrical trade license verified. Approved for electrical services.'
    );

    await pageAdmin.click('[data-testid="admin-approve-cats-btn"]');
    await pageAdmin.waitForFunction(() => !document.querySelector('[data-testid="checkbox-approve-Electrical"]'), { timeout: 5000 });

    // Verify User in MongoDB now has Electrical in approvedCategories
    const postApprovalWorker = await User.findById(workerDoc._id);
    const hasElectrical = postApprovalWorker.approvedCategories.includes('Electrical');
    const hasPlumbing = postApprovalWorker.approvedCategories.includes('Plumbing');

    recordResult(
      '11. Admin Approves Additional Category',
      hasElectrical && hasPlumbing,
      `Worker approvedCategories: [${postApprovalWorker.approvedCategories.join(', ')}]`
    );

    // ------------------------------------------------------------------
    // STEP 12: Category Eligibility Check (AFTER ADMIN APPROVAL)
    // Worker MUST NOW be eligible and receive Electrical bookings
    // ------------------------------------------------------------------
    const eligibleWorkersPost = await User.find({
      roles: 'worker',
      workerStatus: 'approved',
      isActive: true,
      isAvailable: true,
      approvedCategories: { $in: ['Electrical'] }
    });

    const isWorkerEligiblePost = eligibleWorkersPost.some(w => w._id.toString() === workerDoc._id.toString());
    recordResult(
      '12. Eligibility Filter After Approval',
      isWorkerEligiblePost,
      'Worker is NOW eligible to receive Electrical service bookings'
    );

    // Create a new Electrical booking and dispatch request to worker
    const bookingPostApproval = await Booking.create({
      bookingId: `BK-TEST-POST-${Date.now().toString().slice(-4)}`,
      customerId: customerDoc._id,
      serviceId: electricalService._id,
      category: 'Electrical',
      serviceName: electricalService.name,
      pricing: { totalAmount: 499 },
      serviceAddress: { fullAddress: '200 Sector 62', city: 'Noida', pincode: '201301' },
      scheduledDate: new Date(),
      status: 'Pending'
    });

    const workRequest = await WorkRequest.create({
      bookingId: bookingPostApproval._id,
      workerId: workerDoc._id,
      status: 'Pending',
      expiresAt: new Date(Date.now() + 600000)
    });

    // Check worker dashboard receives request
    await pageWorker.goto(`${BASE_URL}/worker/dashboard`, { waitUntil: 'networkidle2' });
    await pageWorker.waitForSelector('.accept-job-btn, [data-testid^="accept-request-btn"]', { timeout: 8000 });
    const hasWorkRequestBtn = await pageWorker.$('.accept-job-btn, [data-testid^="accept-request-btn"]');

    recordResult(
      '13. Live Electrical Work Request in Worker UI',
      Boolean(hasWorkRequestBtn),
      'Worker dashboard rendered incoming work request for newly approved category'
    );

    // ------------------------------------------------------------------
    // STEP 13: Test Rejection Flow
    // Apply for Painting and Admin rejects it
    // ------------------------------------------------------------------
    await pageWorker.click('[data-testid="apply-more-services-btn"]');
    await pageWorker.waitForSelector('[data-testid="apply-category-checkbox-Painting"]', { timeout: 4000 });

    // Electrical should now be disabled since it was approved!
    const isElectricalDisabled = await pageWorker.$eval(
      '[data-testid="apply-category-checkbox-Electrical"]',
      el => el.disabled
    );
    recordResult('14. Newly Approved Category Disabled in Form', isElectricalDisabled, 'Electrical is now disabled');

    // Select Painting
    await pageWorker.click('[data-testid="apply-category-checkbox-Painting"]');
    await pageWorker.type('[data-testid="apply-experience-input"]', '1');
    await pageWorker.type('[data-testid="apply-qualifications-input"]', 'Basic wall painting');
    await pageWorker.click('[data-testid="submit-apply-services-btn"]');
    await pageWorker.waitForFunction(() => !document.querySelector('[data-testid="apply-category-checkbox-Painting"]'), { timeout: 5000 });

    const paintingApp = await WorkerApplication.findOne({
      userId: workerDoc._id,
      requestedCategories: 'Painting'
    }).sort({ createdAt: -1 });

    // Admin rejects Painting application
    await pageAdmin.goto(`${BASE_URL}/admin/dashboard?tab=applications`, { waitUntil: 'networkidle2' });
    await pageAdmin.waitForSelector('[data-testid="tab-additional-applications"]', { timeout: 5000 });
    await pageAdmin.click('[data-testid="tab-additional-applications"]');

    await pageAdmin.waitForSelector(`[data-testid="review-additional-btn-${paintingApp._id}"]`, { timeout: 5000 });
    await pageAdmin.click(`[data-testid="review-additional-btn-${paintingApp._id}"]`);

    await pageAdmin.waitForSelector('[data-testid="admin-reject-app-btn"]', { timeout: 4000 });
    await pageAdmin.type(
      '[data-testid="admin-additional-notes-input"]',
      'Minimum 3 years certified commercial painting experience required.'
    );
    await pageAdmin.click('[data-testid="admin-reject-app-btn"]');
    await pageAdmin.waitForFunction(() => !document.querySelector('[data-testid="admin-reject-app-btn"]'), { timeout: 5000 });

    // Verify in MongoDB: Painting was NOT added to worker
    const workerAfterReject = await User.findById(workerDoc._id);
    const doesNotHavePainting = !workerAfterReject.approvedCategories.includes('Painting');
    const rejectedAppDoc = await WorkerApplication.findById(paintingApp._id);
    const isAppRejected = rejectedAppDoc.applicationStatus === 'rejected';

    recordResult(
      '15. Admin Rejection of Additional Category',
      doesNotHavePainting && isAppRejected,
      'Painting correctly rejected and not added to worker approvedCategories'
    );

    // Clean up test bookings and requests
    await Booking.deleteMany({ bookingId: { $in: [bookingPreApproval.bookingId, bookingPostApproval.bookingId] } });
    await WorkRequest.deleteMany({ _id: workRequest._id });

  } catch (err) {
    console.error('Test execution error:', err);
    recordResult('Execution', false, err.message);
  } finally {
    await browserWorker.close();
    await browserAdmin.close();
    await mongoose.disconnect();
  }

  console.log('\n======================================================================');
  console.log('AUDIT SUMMARY: WORKER COMPLAINTS & ADDITIONAL CATEGORIES');
  console.log('======================================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL CHECKS: ${results.length}`);
  console.log(`PASSED: ${results.filter(r => r.passed).length}`);
  console.log(`FAILED: ${results.filter(r => !r.passed).length}`);
  console.log(`RESULT: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);

  return allPassed;
}

// Allow direct CLI execution
if (process.argv[1]?.endsWith('test_worker_complaints_and_services.js')) {
  runWorkerComplaintsAndServicesTest()
    .then(passed => process.exit(passed ? 0 : 1))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
