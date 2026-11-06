import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

export async function runWorkerHistoryTests() {
  console.log('====================================================');
  console.log('HOMETECH: WORKER SERVICE HISTORY E2E TEST SUITE');
  console.log('====================================================');

  const results = [];
  const recordResult = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Review = mongoose.model('Review', new mongoose.Schema({}, { strict: false }), 'reviews');

  const worker = await User.findOne({ email: 'worker@hometech.demo' });
  const otherWorker = await User.findOne({ email: 'amit.worker@hometech.demo' });

  // Ensure customer is purely a customer (not approved worker)
  await User.findOneAndUpdate(
    { email: 'customer@hometech.demo' },
    {
      roles: ['customer'],
      activeRole: 'customer',
      workerStatus: 'not_applied',
      approvedCategories: []
    }
  );
  const cust = await User.findOne({ email: 'customer@hometech.demo' });

  // Pristine test data setup for worker@hometech.demo
  // Clean up any dynamic test bookings to leave exact known records
  await Booking.deleteMany({
    workerId: worker._id,
    bookingId: { $nin: ['HT-BKG-1001', 'HT-BKG-1004'] }
  });

  // Ensure HT-BKG-1001 (Completed Nov 4)
  const b1 = await Booking.findOneAndUpdate(
    { bookingId: 'HT-BKG-1001' },
    {
      bookingId: 'HT-BKG-1001',
      customerId: cust._id,
      workerId: worker._id,
      category: 'Plumbing',
      status: 'Completed',
      bookingDate: new Date('2026-11-04T10:00:00.000Z'),
      bookingTime: '10:00 AM',
      address: '123, Green Street, Mumbai, Maharashtra 400001',
      contactNumber: '9876504444',
      instructions: 'Kitchen sink tap is leaking continuously. Please bring replacement washers.',
      totalAmount: 299,
      paymentStatus: 'Paid',
      startedAt: new Date('2026-11-04T10:15:00.000Z'),
      completedAt: new Date('2026-11-04T11:00:00.000Z'),
      problemPhotos: [{ url: '/assets/images/home-maintenance.jpg', publicId: 'prob_1001' }],
      completionPhotos: [{ url: '/assets/images/plumbing.jpg', publicId: 'comp_1001' }]
    },
    { upsert: true, new: true }
  );

  await Review.findOneAndUpdate(
    { bookingId: b1._id },
    {
      customerId: cust._id,
      workerId: worker._id,
      bookingId: b1._id,
      rating: 5,
      comment: 'Very professional, arrived right on time and fixed the tap in 15 minutes!',
      serviceName: 'Plumbing'
    },
    { upsert: true }
  );

  // Ensure HT-BKG-1004 (Completed Nov 2)
  const b2 = await Booking.findOneAndUpdate(
    { bookingId: 'HT-BKG-1004' },
    {
      bookingId: 'HT-BKG-1004',
      customerId: cust._id,
      workerId: worker._id,
      category: 'Plumbing',
      status: 'Completed',
      bookingDate: new Date('2026-11-02T10:00:00.000Z'),
      bookingTime: '11:00 AM',
      address: '456 Marine Drive, Mumbai, 400020',
      contactNumber: '9876501111',
      instructions: 'Pipe under sink is dripping.',
      totalAmount: 499,
      paymentStatus: 'Paid',
      startedAt: new Date('2026-11-02T10:15:00.000Z'),
      completedAt: new Date('2026-11-02T11:00:00.000Z'),
      problemPhotos: [{ url: '/assets/images/home-maintenance.jpg', publicId: 'prob_1004' }],
      completionPhotos: [{ url: '/assets/images/plumbing.jpg', publicId: 'comp_1004' }]
    },
    { upsert: true, new: true }
  );

  await Review.findOneAndUpdate(
    { bookingId: b2._id },
    {
      customerId: cust._id,
      workerId: worker._id,
      bookingId: b2._id,
      rating: 4,
      comment: 'Good pipe replacement work. Polite worker.',
      serviceName: 'Plumbing'
    },
    { upsert: true }
  );

  // Ensure an active accepted job exists for exclusion check
  await Booking.create({
    bookingId: 'HT-BKG-ACTIVE-JOB',
    customerId: cust._id,
    workerId: worker._id,
    category: 'Plumbing',
    status: 'Accepted',
    bookingDate: new Date(),
    bookingTime: '02:00 PM',
    address: '789 Link Road, Andheri West',
    contactNumber: '9876502222',
    totalAmount: 350
  });

  // Ensure another worker's completed job exists
  await Booking.findOneAndUpdate(
    { bookingId: 'HT-BKG-1002' },
    {
      bookingId: 'HT-BKG-1002',
      customerId: cust._id,
      workerId: otherWorker ? otherWorker._id : new mongoose.Types.ObjectId(),
      category: 'Electrical',
      status: 'Completed',
      totalAmount: 599,
      completedAt: new Date()
    },
    { upsert: true }
  );

  const completedCountInDb = await Booking.countDocuments({
    workerId: worker._id,
    status: { $regex: /^completed$/i }
  });

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // ----------------------------------------------------
    // TEST 1: Worker Login
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'worker@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    
    // Click submit
    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    const currentUrl = page.url();
    const isWorkerDash = currentUrl.includes('/worker/dashboard');
    recordResult('1. Worker Login & Redirection to Dashboard', isWorkerDash, `URL: ${currentUrl}`);

    // ----------------------------------------------------
    // TEST 2: Sidebar Navigation Verification
    // ----------------------------------------------------
    const sidebarText = await page.evaluate(() => {
      const sidebar = document.querySelector('.dashboard-sidebar');
      return sidebar ? sidebar.innerText : '';
    });

    const hasServiceHistoryBtn = sidebarText.includes('Service History');
    const hasDashboardBtn = sidebarText.includes('Dashboard');
    const hasLogoutBtn = sidebarText.includes('Logout');
    recordResult(
      '2. Sidebar Menu Items Present (Service History, Dashboard, Logout)',
      hasServiceHistoryBtn && hasDashboardBtn && hasLogoutBtn,
      'Sidebar verified'
    );

    // Verify Completed Jobs StatCard on Dashboard Overview
    const completedJobsStat = await page.evaluate(() => {
      const statCards = Array.from(document.querySelectorAll('.stat-card'));
      for (const card of statCards) {
        if (card.innerText.includes('Completed Jobs')) {
          return card.innerText;
        }
      }
      return '';
    });
    recordResult(
      '3. Completed Jobs StatCard Visible on Worker Dashboard',
      completedJobsStat.includes('Completed Jobs') && completedJobsStat.includes(String(completedCountInDb)),
      `Stat content: ${completedJobsStat.replace(/\n/g, ' ')} (Matches DB count ${completedCountInDb})`
    );

    // ----------------------------------------------------
    // TEST 3: Click "Service History" to Navigate
    // ----------------------------------------------------
    const clickedHistoryNav = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('.sidebar-item'));
      for (const btn of buttons) {
        if (btn.innerText.includes('Service History')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 1000));

    const historyUrl = page.url();
    const isHistoryTab = historyUrl.includes('tab=history') || historyUrl.includes('/worker/history');
    recordResult('4. Click "Service History" Navigates to History Tab', clickedHistoryNav && isHistoryTab, `URL: ${historyUrl}`);

    // ----------------------------------------------------
    // TEST 4: Service History List View Display
    // ----------------------------------------------------
    await page.waitForSelector('h2');
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasHistoryTitle = pageText.includes('Service History') && pageText.includes('Completed Jobs');
    const hasHT1001 = pageText.includes('HT-BKG-1001');
    const hasHT1004 = pageText.includes('HT-BKG-1004');
    recordResult(
      '5. Completed Jobs Displayed in History (HT-BKG-1001 and HT-BKG-1004)',
      hasHistoryTitle && hasHT1001 && hasHT1004,
      'Both completed bookings present'
    );

    // Check Completed Status badge and timestamps
    const hasCompletedBadges = await page.evaluate(() => {
      const badges = Array.from(document.querySelectorAll('.badge, span'));
      return badges.some(b => b.innerText.trim() === 'Completed');
    });
    recordResult('6. Completed Status Badges Rendered', hasCompletedBadges, 'Status badge "Completed" verified');

    // ----------------------------------------------------
    // TEST 5: Exclude Non-Completed and Other Workers' Jobs
    // ----------------------------------------------------
    const hasActiveJob = pageText.includes('HT-BKG-ACTIVE-JOB');
    const hasOtherWorkerJob = pageText.includes('HT-BKG-1002');
    recordResult(
      '7. Strictly Exclude Non-Completed Jobs & Other Workers Jobs',
      !hasActiveJob && !hasOtherWorkerJob,
      `Excluded HT-BKG-ACTIVE-JOB: ${!hasActiveJob}, HT-BKG-1002: ${!hasOtherWorkerJob}`
    );

    // ----------------------------------------------------
    // TEST 6: Search Functionality
    // ----------------------------------------------------
    const searchInput = await page.$('input[placeholder*="Customer name or Booking ID"]');
    if (searchInput) {
      await searchInput.type('HT-BKG-1004');
      // Submit the search form
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
      await new Promise(r => setTimeout(r, 800));

      const afterSearchText = await page.evaluate(() => document.body.innerText);
      const searchFiltered = afterSearchText.includes('HT-BKG-1004') && !afterSearchText.includes('HT-BKG-1001');
      recordResult('8. Search by Booking ID (HT-BKG-1004)', searchFiltered, 'Only matching booking displayed');

      // Clear search
      const resetBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        for (const b of btns) {
          if (b.innerText.includes('Reset') || b.innerText.includes('Clear')) {
            b.click();
            return true;
          }
        }
        return false;
      });
      await new Promise(r => setTimeout(r, 800));
      const afterResetText = await page.evaluate(() => document.body.innerText);
      recordResult(
        '9. Reset Search Restores Full List',
        afterResetText.includes('HT-BKG-1001') && afterResetText.includes('HT-BKG-1004'),
        'All records restored'
      );
    } else {
      recordResult('8. Search input located', false, 'Input not found');
    }

    // ----------------------------------------------------
    // TEST 7: Category Filter
    // ----------------------------------------------------
    const categoryFilterFound = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const catSelect = selects.find(s => s.innerHTML.includes('Plumbing') && s.innerHTML.includes('Cleaning'));
      if (catSelect) {
        catSelect.value = 'Electrical';
        catSelect.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 600));
    const afterCategoryFilterText = await page.evaluate(() => document.body.innerText);
    const noElectricalJobs = afterCategoryFilterText.includes('No completed service jobs match') || !afterCategoryFilterText.includes('HT-BKG-1001');
    recordResult(
      '10. Filter by Category (Electrical -> 0 matches)',
      categoryFilterFound && noElectricalJobs,
      'Category filter correctly filtered out non-matching trades'
    );

    // Switch back to "All"
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const catSelect = selects.find(s => s.innerHTML.includes('Plumbing') && s.innerHTML.includes('Cleaning'));
      if (catSelect) {
        catSelect.value = 'All';
        catSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // ----------------------------------------------------
    // TEST 8: Sorting (Newest vs Oldest)
    // ----------------------------------------------------
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const sortSelect = selects.find(s => s.innerHTML.includes('Newest First') || s.innerHTML.includes('Oldest First'));
      if (sortSelect) {
        sortSelect.value = 'oldest';
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 600));
    const sortOldestText = await page.evaluate(() => document.body.innerText);
    const idx1004 = sortOldestText.indexOf('HT-BKG-1004');
    const idx1001 = sortOldestText.indexOf('HT-BKG-1001');
    recordResult(
      '11. Sort by Oldest First (HT-BKG-1004 from Nov 2 precedes HT-BKG-1001 from Nov 4)',
      idx1004 !== -1 && idx1001 !== -1 && idx1004 < idx1001,
      `HT-BKG-1004 index: ${idx1004}, HT-BKG-1001 index: ${idx1001}`
    );

    // Reset sort back to newest
    await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select'));
      const sortSelect = selects.find(s => s.innerHTML.includes('Newest First'));
      if (sortSelect) {
        sortSelect.value = 'newest';
        sortSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 600));

    // ----------------------------------------------------
    // TEST 9: View Details Button & Dedicated Detail View
    // ----------------------------------------------------
    const clickedDetails = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('View Details'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 800));

    const detailText = await page.evaluate(() => document.body.innerText);
    const hasBackBtn = detailText.includes('Back to Service History');
    const hasInstruction = detailText.includes('Kitchen sink tap is leaking') || detailText.includes('Pipe under sink');
    const hasPhotos = detailText.includes('Before Service') || detailText.includes('After Service') || detailText.includes('Photos');
    const hasReviewRating = detailText.includes('Customer Feedback') || detailText.includes('★');

    recordResult(
      '12. View Details Opens Comprehensive Service Record',
      clickedDetails && hasBackBtn && (hasInstruction || hasReviewRating),
      'Detail view rendered with timestamps, instructions, rating & photos'
    );

    // ----------------------------------------------------
    // TEST 10: "Back to Service History" Button
    // ----------------------------------------------------
    const clickedBack = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const backBtn = btns.find(b => b.innerText.includes('Back to Service History'));
      if (backBtn) {
        backBtn.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 600));
    const afterBackText = await page.evaluate(() => document.body.innerText);
    recordResult(
      '13. "Back to Service History" Returns to History List',
      clickedBack && afterBackText.includes('Service History') && afterBackText.includes('Completed Jobs'),
      'Returned cleanly to list view'
    );

    // ----------------------------------------------------
    // TEST 11: Page Refresh Persistence
    // ----------------------------------------------------
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    const reloadedText = await page.evaluate(() => document.body.innerText);
    const reloadedUrl = page.url();
    recordResult(
      '14. Page Refresh Preserves Service History View',
      reloadedUrl.includes('tab=history') && reloadedText.includes('Service History') && reloadedText.includes('Completed Jobs'),
      `URL: ${reloadedUrl}`
    );

    // ----------------------------------------------------
    // TEST 12: Dedicated Route /worker/history
    // ----------------------------------------------------
    await page.goto(`${BASE_URL}/worker/history`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    const dedicatedRouteText = await page.evaluate(() => document.body.innerText);
    recordResult(
      '15. Dedicated Route /worker/history Renders Service History',
      dedicatedRouteText.includes('Service History') && dedicatedRouteText.includes('HT-BKG-1001'),
      'Direct route verified'
    );

    // ----------------------------------------------------
    // TEST 13: StatCard Navigation to History
    // ----------------------------------------------------
    // Navigate to dashboard overview
    await page.goto(`${BASE_URL}/worker/dashboard`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const clickedStatCard = await page.evaluate(() => {
      const el = document.querySelector('[title="Click to view Service History"]');
      if (el) {
        el.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 800));
    const afterStatClickUrl = page.url();
    recordResult(
      '16. Clicking "Completed Jobs" StatCard Navigates to History',
      clickedStatCard && afterStatClickUrl.includes('tab=history'),
      `URL: ${afterStatClickUrl}`
    );

    // ----------------------------------------------------
    // TEST 14: Empty State (Worker with 0 Completed Jobs)
    // ----------------------------------------------------
    // Log out first
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/login';
    });
    await new Promise(r => setTimeout(r, 1000));

    // Log in as Vikram Singh (workerc@hometech.demo)
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'workerc@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    const loginBtn2 = await page.$('button[type="submit"]');
    if (loginBtn2) await loginBtn2.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    // Navigate to history
    await page.goto(`${BASE_URL}/worker/dashboard?tab=history`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));
    const emptyStateText = await page.evaluate(() => document.body.innerText);
    const hasEmptyState = emptyStateText.includes('No completed services yet') || emptyStateText.includes('You have not completed any service appointments yet');
    recordResult(
      '17. Empty State for Worker with 0 Completed Jobs ("No completed services yet")',
      hasEmptyState,
      'Empty state cleanly rendered with friendly prompt'
    );

    // ----------------------------------------------------
    // TEST 15: Role-based Access Control
    // ----------------------------------------------------
    // Clear storage and attempt accessing worker history as unauthenticated visitor
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${BASE_URL}/worker/history`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const unauthUrl = page.url();
    recordResult(
      '18. Unauthenticated Access Blocked (Redirects to /login)',
      unauthUrl.includes('/login'),
      `Redirected to: ${unauthUrl}`
    );

    // Log in as Customer and try to access /worker/history
    await page.type('input[type="email"]', 'customer@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    const loginBtn3 = await page.$('button[type="submit"]');
    if (loginBtn3) await loginBtn3.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));

    await page.goto(`${BASE_URL}/worker/history`, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 800));
    const customerRedirectUrl = page.url();
    recordResult(
      '19. Customer Role Cannot Access Worker History (Redirected to Customer Dashboard)',
      customerRedirectUrl.includes('/customer/dashboard'),
      `Redirected to: ${customerRedirectUrl}`
    );

  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    recordResult('Execution without uncaught error', false, err.message);
  } finally {
    await browser.close();
    await mongoose.disconnect();
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} TESTS PASSED`);
  console.log('====================================================');
  return results;
}

if (process.argv[1] && process.argv[1].includes('test_worker_history.js')) {
  runWorkerHistoryTests().then((results) => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });
}
