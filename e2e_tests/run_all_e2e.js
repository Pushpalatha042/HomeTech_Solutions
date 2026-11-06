import { execSync } from 'child_process';

const suites = [
  { name: '1. Customer Registration', file: 'e2e_tests/test_registration.js' },
  { name: '2. Customer Login & Auth Guards', file: 'e2e_tests/test_login.js' },
  { name: '3. Customer Dashboard & Profile', file: 'e2e_tests/test_dashboard.js' },
  { name: '4. Service Catalogue & Booking Flow', file: 'e2e_tests/test_booking.js' },
  { name: '5. Worker & Customer Lifecycle Interaction', file: 'e2e_tests/test_worker_lifecycle.js' },
  { name: '6. Header, Footer & Responsive Navigation', file: 'e2e_tests/test_navigation_responsive.js' },
  { name: '7. Worker Service History & Filtering', file: 'e2e_tests/test_worker_history.js' },
  { name: '8. Admin Module & Access Control', file: 'e2e_tests/test_admin_module.js' },
  { name: '9. Live GPS Tracking & Leaflet Map', file: 'e2e_tests/test_live_gps_tracking.js' },
  { name: '10. Security & IDOR Protection', file: 'e2e_tests/test_security_api.js' },
  { name: '11. File Uploads & Image Serving', file: 'e2e_tests/test_file_uploads.js' },
  { name: '12. Worker Complaints & Additional Categories', file: 'e2e_tests/test_worker_complaints_and_services.js' },
  { name: '13. Booking-Specific Worker Complaints', file: 'e2e_tests/test_booking_specific_worker_complaints.js' },
  { name: '14. Track Button & Post-Completion Worker Complaints', file: 'e2e_tests/test_track_button_and_post_completion_complaints.js' }
];

console.log('======================================================================');
console.log('HOMETECH SOLUTIONS — COMPREHENSIVE E2E AUDIT IN GOOGLE CHROME');
console.log('======================================================================\n');

const suiteResults = [];

for (const suite of suites) {
  console.log(`\n>>> EXECUTING: ${suite.name} ...`);
  const startTime = Date.now();
  try {
    const stdout = execSync(`node ${suite.file}`, { encoding: 'utf8', stdio: 'pipe' });
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Parse passes and fails
    const passMatches = (stdout.match(/✓ PASS/g) || []).length;
    const failMatches = (stdout.match(/✗ FAIL/g) || []).length;
    const total = passMatches + failMatches;
    
    console.log(stdout.trim());
    suiteResults.push({
      name: suite.name,
      total,
      passed: passMatches,
      failed: failMatches,
      duration: `${duration}s`,
      status: failMatches === 0 && passMatches > 0 ? 'PASS' : 'FAIL'
    });
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const stdout = err.stdout || '';
    const stderr = err.stderr || '';
    console.error(stdout);
    console.error(stderr);
    const passMatches = (stdout.match(/✓ PASS/g) || []).length;
    const failMatches = Math.max(1, (stdout.match(/✗ FAIL/g) || []).length);
    suiteResults.push({
      name: suite.name,
      total: passMatches + failMatches,
      passed: passMatches,
      failed: failMatches,
      duration: `${duration}s`,
      status: 'FAIL'
    });
  }
}

console.log('\n======================================================================');
console.log('FINAL CONSOLIDATED TEST EXECUTION SUMMARY');
console.log('======================================================================\n');
console.log('| Module / Feature | Test Cases Executed | Passed | Failed | Duration | Status |');
console.log('|:---|:---:|:---:|:---:|:---:|:---:|');
for (const s of suiteResults) {
  console.log(`| ${s.name} | ${s.total} | ${s.passed} | ${s.failed} | ${s.duration} | ${s.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} |`);
}
const totalExecuted = suiteResults.reduce((sum, s) => sum + s.total, 0);
const totalPassed = suiteResults.reduce((sum, s) => sum + s.passed, 0);
const totalFailed = suiteResults.reduce((sum, s) => sum + s.failed, 0);
console.log(`| **Total** | **${totalExecuted}** | **${totalPassed}** | **${totalFailed}** | - | **${totalFailed === 0 ? '✅ 100% PASS' : '❌ SOME FAILED'}** |`);
console.log('\n======================================================================');
