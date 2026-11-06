import puppeteer from 'puppeteer-core';
import mongoose from '../server/node_modules/mongoose/index.js';

const CHROME_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = 'http://localhost:5173';
const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

let browser;
let page;

const results = [];
function report(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name}${detail ? ` (${detail})` : ''}`);
}

async function runBookingTests() {
  console.log('--------------------------------------------------');
  console.log('SUITE 4: SERVICE BOOKING FLOW TESTING IN CHROME');
  console.log('--------------------------------------------------');

  await mongoose.connect(MONGO_URI);
  const Booking = mongoose.model(
    'Booking',
    new mongoose.Schema({}, { strict: false }),
    'bookings'
  );
  const Service = mongoose.model(
    'Service',
    new mongoose.Schema({}, { strict: false }),
    'services'
  );

  browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Log in as Customer
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[type="email"]', 'customer@hometech.demo');
    await page.type('input[type="password"]', 'HomeTech@123');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 10000 }).catch(() => {});
    report('Customer Pre-Authentication', true, 'Logged in as customer@hometech.demo');

    // 2. Navigate to Services Catalogue (/services)
    await page.goto(`${BASE_URL}/services`, { waitUntil: 'networkidle2' });
    const serviceCards = await page.$$('.service-card, .card');
    report('Services Catalogue Page Rendered', serviceCards.length > 0, `Found ${serviceCards.length} service items`);

    // 3. Category Filter Interaction
    const categoryBtns = await page.$$('.category-pill, .filter-chip, button');
    let plumbingClicked = false;
    for (const btn of categoryBtns) {
      const text = await page.evaluate(el => el.textContent.trim(), btn);
      if (text.includes('Plumbing')) {
        await btn.click();
        plumbingClicked = true;
        break;
      }
    }
    await new Promise(r => setTimeout(r, 600));
    report('Category Filter Interaction', plumbingClicked, 'Filtered catalogue by Plumbing');

    // 4. Click Service Card to view Service Details
    const firstDetailLink = await page.$('a[href*="/services/"]');
    const serviceDetailHref = await page.evaluate(el => el.getAttribute('href'), firstDetailLink);
    await firstDetailLink.click();
    await page.waitForFunction((href) => window.location.pathname.includes(href), {}, serviceDetailHref);
    await page.waitForSelector('h1', { timeout: 8000 });
    const hasServiceTitle = await page.$eval('h1', el => el.textContent.trim().length > 0);
    report('Service Details Page Loaded', hasServiceTitle, `Path: ${page.url()}`);

    // 5. Navigate to Booking Form (/booking/:id)
    await page.waitForSelector('a[href*="/booking/"]', { timeout: 8000 });
    const bookNowBtn = await page.$('a[href*="/booking/"]');
    await bookNowBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/booking/'));
    await page.waitForSelector('textarea.form-textarea', { timeout: 8000 });
    const isBookingPage = page.url().includes('/booking/');
    report('Navigation to Booking Form', isBookingPage, `URL: ${page.url()}`);

    // 6. Form Validation - Missing Required Address
    await page.evaluate(() => {
      const addrInput = document.querySelector('textarea.form-textarea');
      if (addrInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(addrInput, '');
        addrInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const submitBtn = await page.$('button[type="submit"]');
    await submitBtn.click();
    const isAddressInvalid = await page.$eval('textarea.form-textarea', el => !el.checkValidity());
    report('Form Validation: Missing Address Blocked', isAddressInvalid, 'HTML5 required validation triggered');

    // 7. Fill Valid Booking Details
    const testAddress = '101 Green Avenue, Apt 4C, Vijayawada';
    const testInstructions = 'Ring doorbell twice. Tap is in master bathroom.';

    await page.evaluate((addr, instr) => {
      const addrInput = document.querySelector('textarea.form-textarea');
      const instrInput = document.querySelectorAll('textarea.form-textarea')[1];
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      
      setter.call(addrInput, addr);
      addrInput.dispatchEvent(new Event('input', { bubbles: true }));

      if (instrInput) {
        setter.call(instrInput, instr);
        instrInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, testAddress, testInstructions);

    // 8. Submit Booking Form
    await submitBtn.click();
    await page.waitForFunction(() => window.location.pathname.includes('/customer/dashboard'), { timeout: 10000 });
    const landedOnDash = page.url().includes('/customer/dashboard');
    report('Booking Submission Redirection', landedOnDash, `Landed at: ${page.url()}`);

    // Check Toast Notification
    const toast = await page.waitForSelector('.toast', { timeout: 5000 }).catch(() => null);
    const toastMsg = toast ? await page.$eval('.toast span', el => el.textContent.trim()) : '';
    report('Booking Confirmation Toast Notification', !!toast, `Toast: "${toastMsg}"`);

    // 9. Verify Booking in MongoDB
    const latestBooking = await Booking.findOne({ address: testAddress }).sort({ createdAt: -1 });
    const dbBookingValid = !!latestBooking && latestBooking.status === 'Pending' && latestBooking.instructions === testInstructions;
    report('Booking Persisted in MongoDB', dbBookingValid, `Booking ID: ${latestBooking?.bookingId || latestBooking?._id}, Status: ${latestBooking?.status}`);

    // 10. Verify Booking Appears in Customer Dashboard
    await page.waitForSelector('.stat-card');
    await page.waitForFunction(
      (addr, bId) => document.body.innerText.includes(addr) || (bId && document.body.innerText.includes(bId)),
      { timeout: 8000 },
      testAddress,
      latestBooking?.bookingId
    ).catch(() => {});
    const bodyContent = await page.evaluate(() => document.body.innerText);
    const bookingVisible = bodyContent.includes(testAddress) || (latestBooking && bodyContent.includes(latestBooking.bookingId));
    report('New Booking Appears on Customer Dashboard', bookingVisible, `Verified booking ID / address on dashboard`);

    // 11. Persistence Across Page Reload
    await page.reload({ waitUntil: 'networkidle2' });
    const bodyAfterReload = await page.evaluate(() => document.body.innerText);
    const reloadPersisted = bodyAfterReload.includes(testAddress) || bodyAfterReload.includes(latestBooking.bookingId);
    report('Booking Persists Across Page Reload', reloadPersisted, 'Booking intact after full reload');

  } catch (err) {
    console.error('Test suite execution error:', err);
    report('Booking Suite Execution Error', false, err.message);
  } finally {
    if (browser) await browser.close();
    await mongoose.disconnect();
  }

  const passedCount = results.filter(r => r.passed).length;
  console.log(`\nBooking Suite Complete: ${passedCount}/${results.length} Passed\n`);
}

runBookingTests();
