import http from 'http';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok, data };
}

async function run() {
  console.log('--- STARTING HOMETECH VERIFICATION SUITE ---');

  // 1. Authenticate users
  console.log('\n[1] Authenticating Customer, Worker, Admin...');
  const custRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@hometech.demo', password: 'HomeTech@123' })
  });
  if (!custRes.ok) throw new Error('Customer login failed: ' + JSON.stringify(custRes.data));
  const custToken = custRes.data.token;
  const custHeaders = { Authorization: `Bearer ${custToken}` };
  console.log('✓ Customer logged in');

  const workerRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'worker@hometech.demo', password: 'HomeTech@123' })
  });
  if (!workerRes.ok) throw new Error('Worker login failed: ' + JSON.stringify(workerRes.data));
  const workerToken = workerRes.data.token;
  const workerHeaders = { Authorization: `Bearer ${workerToken}` };
  console.log('✓ Worker logged in');

  const adminRes = await request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@hometech.demo', password: 'HomeTech@123' })
  });
  if (!adminRes.ok) throw new Error('Admin login failed: ' + JSON.stringify(adminRes.data));
  const adminHeaders = { Authorization: `Bearer ${adminRes.data.token}` };
  console.log('✓ Admin logged in');

  // 2. Fetch service
  const srvRes = await request('/services', { headers: custHeaders });
  const service = srvRes.data[0];
  console.log(`✓ Using service: ${service.name} (${service.category})`);

  // 3. Test Problem Photo Upload (Multipart)
  console.log('\n[2] Testing Problem Photos Upload (Part 3)...');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const dummyJpg = Buffer.from('dummy-jpg-image-bytes-for-testing');
  
  const bodyParts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="photos"; filename="test-broken-pipe.jpg"',
    'Content-Type: image/jpeg',
    '',
    dummyJpg.toString('binary'),
    `--${boundary}--`
  ];
  const multipartBody = Buffer.from(bodyParts.join('\r\n'), 'binary');

  const uploadRes = await fetch(`${API_BASE}/bookings/upload-problem-photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${custToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: multipartBody
  });
  const uploadData = await uploadRes.json();
  if (uploadRes.status !== 200 || !uploadData.photos || uploadData.photos.length === 0) {
    throw new Error('Problem photo upload failed: ' + JSON.stringify(uploadData));
  }
  console.log(`✓ Problem photo uploaded successfully: ${uploadData.photos[0].url}`);
  const uploadedProblemPhotos = uploadData.photos;

  // 4. Create Booking with Problem Photos
  console.log('\n[3] Creating Customer Booking with Problem Photos (Part 3)...');
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const bookRes = await request('/bookings', {
    method: 'POST',
    headers: { ...custHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId: service._id,
      bookingDate: tmrw.toISOString().split('T')[0],
      bookingTime: '10:00 AM',
      address: '777, Tech Park Avenue, Vijayawada',
      contactNumber: '9876543210',
      instructions: 'Water pipe leaking heavily under kitchen sink',
      problemPhotos: uploadedProblemPhotos
    })
  });
  if (!bookRes.ok) throw new Error('Create booking failed: ' + JSON.stringify(bookRes.data));
  const booking = bookRes.data.booking;
  console.log(`✓ Booking created: ${booking.bookingId} with ${booking.problemPhotos.length} problem photo(s)`);

  // 5. Worker receives request and sees problem photos
  console.log('\n[4] Worker checks requests and accepts...');
  const wrRes = await request('/work-requests', { headers: workerHeaders });
  console.log('Work requests response:', wrRes.status, wrRes.data);
  const requestsList = Array.isArray(wrRes.data) ? wrRes.data : (wrRes.data?.requests || []);
  const myReq = requestsList.find(r => r.bookingId === booking.bookingId || r.bookingMongoId === booking._id || r.bookingMongoId === booking.id);
  if (!myReq) throw new Error('Worker did not receive work request for booking ' + booking.bookingId);
  console.log(`✓ Work request found for worker! Problem photos visible: ${myReq.problemPhotos?.length || 0}`);

  const acceptRes = await request(`/work-requests/${myReq._id}/accept`, {
    method: 'PUT',
    headers: workerHeaders
  });
  if (!acceptRes.ok) throw new Error('Worker failed to accept work request: ' + JSON.stringify(acceptRes.data));
  console.log('✓ Work request accepted by worker');

  // 6. Test Initial Live GPS (should be null / waiting)
  console.log('\n[5] Testing Customer Tracking API before GPS pings (Part 2)...');
  const trackInit = await request(`/tracking/${booking._id}`, { headers: custHeaders });
  if (!trackInit.ok || trackInit.data.location !== null) {
    throw new Error('Initial tracking expected location: null, got: ' + JSON.stringify(trackInit.data));
  }
  console.log(`✓ Initial tracking returns location: null with message: "${trackInit.data.message}"`);

  // 7. Worker automatically sends GPS coordinates
  console.log('\n[6] Worker sends live GPS location (Part 2)...');
  const postLocRes = await request(`/tracking/${booking._id}/location`, {
    method: 'POST',
    headers: { ...workerHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: 16.5125,
      longitude: 80.6510,
      accuracy: 8,
      speed: 18.5
    })
  });
  if (!postLocRes.ok) throw new Error('Post GPS location failed: ' + JSON.stringify(postLocRes.data));
  console.log('✓ Worker GPS location recorded in MongoDB');

  // 8. Customer fetches tracking with valid location
  const trackAfter = await request(`/tracking/${booking._id}`, { headers: custHeaders });
  if (!trackAfter.ok || !trackAfter.data.location || trackAfter.data.location.latitude !== 16.5125) {
    throw new Error('Tracking failed to return valid coords: ' + JSON.stringify(trackAfter.data));
  }
  console.log(`✓ Customer tracking received live coordinates: [${trackAfter.data.location.latitude}, ${trackAfter.data.location.longitude}]`);

  // 9. Worker starts job
  console.log('\n[7] Worker starts job...');
  const startRes = await request(`/workers/jobs/${booking._id}/start-job`, {
    method: 'PUT',
    headers: workerHeaders
  });
  if (!startRes.ok) throw new Error('Start job failed: ' + JSON.stringify(startRes.data));
  console.log('✓ Worker started job, status: In Progress');

  // 10. Customer Confirms Completion (Part 1)
  console.log('\n[8] Customer confirms completion (Part 1)...');
  const compRes = await request(`/bookings/${booking._id}/confirm-completion`, {
    method: 'PUT',
    headers: custHeaders
  });
  if (!compRes.ok) throw new Error('Confirm completion failed: ' + JSON.stringify(compRes.data));
  const compBooking = compRes.data.booking;
  if (compBooking.status !== 'Completed' || compBooking.paymentStatus !== 'Paid') {
    throw new Error('Completed booking status invalid: ' + JSON.stringify(compBooking));
  }
  console.log(`✓ Booking confirmed Completed, paymentStatus: ${compBooking.paymentStatus}`);

  // 11. Customer Uploads Completed Work Photos (Part 4)
  console.log('\n[9] Customer uploads After-Service / Completed Work Photos (Part 4)...');
  const dummyAfterJpg = Buffer.from('dummy-after-service-jpg-bytes');
  const afterParts = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="photos"; filename="fixed-pipe.jpg"',
    'Content-Type: image/jpeg',
    '',
    dummyAfterJpg.toString('binary'),
    `--${boundary}--`
  ];
  const afterMultipartBody = Buffer.from(afterParts.join('\r\n'), 'binary');

  const afterUploadRes = await fetch(`${API_BASE}/bookings/${booking._id}/completion-photos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${custToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: afterMultipartBody
  });
  const afterUploadData = await afterUploadRes.json();
  if (afterUploadRes.status !== 200 || !afterUploadData.photos || afterUploadData.photos.length === 0) {
    throw new Error('After photos upload failed: ' + JSON.stringify(afterUploadData));
  }
  console.log(`✓ After-service photo uploaded: ${afterUploadData.photos[0].url}`);

  // 12. Customer Submits 5-Star Rating & Review (Part 1 & 4)
  console.log('\n[10] Customer submits star rating and review...');
  const revRes = await request(`/bookings/${booking._id}/review`, {
    method: 'POST',
    headers: { ...custHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rating: 5,
      comment: 'Super fast leak repair! Very clean and professional technician.'
    })
  });
  if (!revRes.ok) throw new Error('Submit review failed: ' + JSON.stringify(revRes.data));
  console.log(`✓ Rating & review submitted successfully: 5 Stars`);

  // 13. Admin Quality Inspection & Service Report (Part 4)
  console.log('\n[11] Admin reviews Service Quality Report (Part 4)...');
  const adminBkgRes = await request(`/bookings/${booking._id}`, { headers: adminHeaders });
  const finalBooking = adminBkgRes.data;
  console.log('✓ Admin retrieved booking report:');
  console.log(`  - Booking ID: ${finalBooking.bookingId}`);
  console.log(`  - Status: ${finalBooking.status}`);
  console.log(`  - Problem Photos (Before): ${finalBooking.problemPhotos?.length || 0}`);
  console.log(`  - Completed Photos (After): ${finalBooking.completionPhotos?.length || finalBooking.completedPhotos?.length || 0}`);

  const adminRevRes = await request(`/bookings/${booking._id}/review`, { headers: adminHeaders });
  console.log(`  - Customer Feedback: "${adminRevRes.data.comment}" (${adminRevRes.data.rating} Stars)`);

  console.log('\n======================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
