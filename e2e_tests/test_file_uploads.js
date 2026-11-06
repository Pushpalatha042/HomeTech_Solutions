import mongoose from '../server/node_modules/mongoose/index.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

const MONGO_URI = 'mongodb://127.0.0.1:27017/hometech';

function sendMultipartRequest({ path: reqPath, fields = {}, files = [], token = null }) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const crlf = '\r\n';

    let postData = Buffer.alloc(0);

    // Append regular fields
    for (const [key, val] of Object.entries(fields)) {
      let fieldPart = `--${boundary}${crlf}`;
      fieldPart += `Content-Disposition: form-data; name="${key}"${crlf}${crlf}`;
      fieldPart += `${val}${crlf}`;
      postData = Buffer.concat([postData, Buffer.from(fieldPart, 'utf8')]);
    }

    // Append files
    for (const file of files) {
      let fileHeader = `--${boundary}${crlf}`;
      fileHeader += `Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"${crlf}`;
      fileHeader += `Content-Type: ${file.contentType}${crlf}${crlf}`;
      postData = Buffer.concat([
        postData,
        Buffer.from(fileHeader, 'utf8'),
        file.buffer,
        Buffer.from(crlf, 'utf8')
      ]);
    }

    // End boundary
    postData = Buffer.concat([postData, Buffer.from(`--${boundary}--${crlf}`, 'utf8')]);

    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': postData.length
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: reqPath,
        method: 'POST',
        headers
      },
      (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(body);
          } catch (e) {
            parsed = { raw: body };
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function fetchHttp(reqPath) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 5000, path: reqPath }, (res) => {
      let body = Buffer.alloc(0);
      res.on('data', chunk => (body = Buffer.concat([body, chunk])));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, size: body.length }));
    }).on('error', reject);
  });
}

function loginApi(email, password) {
  const data = JSON.stringify({ email, password });
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      },
      (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve(JSON.parse(body || '{}')));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

export async function runFileUploadTests() {
  console.log('====================================================');
  console.log('SUITE 11: FILE UPLOADS, VALIDATION & STATIC SERVING');
  console.log('====================================================');

  const results = [];
  const recordResult = (name, passed, details = '') => {
    results.push({ name, passed, details });
    console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? '(' + details + ')' : ''}`);
  };

  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const Booking = mongoose.model('Booking', new mongoose.Schema({}, { strict: false }), 'bookings');

  const custLogin = await loginApi('customer@hometech.demo', 'HomeTech@123');
  const customerToken = custLogin.token;

  const workerLogin = await loginApi('worker@hometech.demo', 'HomeTech@123');
  const workerToken = workerLogin.token;

  const cust = await User.findOne({ email: 'customer@hometech.demo' });
  const worker = await User.findOne({ email: 'worker@hometech.demo' });

  // Minimal 1x1 transparent PNG buffer
  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );

  // Test Booking
  const testBkg = await Booking.create({
    bookingId: `HT-UPL-${Math.floor(100000 + Math.random() * 900000)}`,
    customerId: cust._id,
    workerId: worker._id,
    category: 'Plumbing',
    status: 'In Progress',
    address: '15 Gateway of India, Mumbai',
    contactNumber: '9876501111',
    bookingDate: new Date(),
    bookingTime: '02:00 PM',
    totalAmount: 599
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Valid Image Upload (Pre-booking / Problem Photos)
    // ----------------------------------------------------
    const uploadRes = await sendMultipartRequest({
      path: '/api/bookings/upload-problem-photos',
      token: customerToken,
      files: [
        {
          fieldname: 'photos',
          filename: 'leak_pipe.png',
          contentType: 'image/png',
          buffer: samplePngBuffer
        }
      ]
    });
    const photoUrl = uploadRes.data?.photos?.[0]?.url;
    recordResult(
      '1. Problem Photos Upload Returns HTTP 200 with File URL',
      uploadRes.status === 200 && !!photoUrl,
      `URL: ${photoUrl}`
    );

    // ----------------------------------------------------
    // TEST 2: Static File Serving Delivers Uploaded File
    // ----------------------------------------------------
    const staticRes = await fetchHttp(photoUrl);
    recordResult(
      '2. Uploaded Photo Served Statically with Image Content-Type',
      staticRes.status === 200 && staticRes.headers['content-type']?.includes('image'),
      `Content-Type: ${staticRes.headers['content-type']}, Size: ${staticRes.size}B`
    );

    // ----------------------------------------------------
    // TEST 3: Problem Photo Stored on Booking in MongoDB
    // ----------------------------------------------------
    const attachProblemRes = await sendMultipartRequest({
      path: `/api/bookings/${testBkg._id}/problem-photos`,
      token: customerToken,
      files: [
        {
          fieldname: 'photos',
          filename: 'clogged_sink.png',
          contentType: 'image/png',
          buffer: samplePngBuffer
        }
      ]
    });
    const bkgInDbAfterProblem = await Booking.findById(testBkg._id);
    recordResult(
      '3. Problem Photo Persisted into Booking problemPhotos Array in MongoDB',
      attachProblemRes.status === 200 && bkgInDbAfterProblem.problemPhotos?.length > 0,
      `Count: ${bkgInDbAfterProblem.problemPhotos?.length}`
    );

    // ----------------------------------------------------
    // TEST 4: Completion Photo Stored on Booking
    // ----------------------------------------------------
    const attachCompletionRes = await sendMultipartRequest({
      path: `/api/bookings/${testBkg._id}/completion-photos`,
      token: workerToken,
      files: [
        {
          fieldname: 'photos',
          filename: 'fixed_pipe.png',
          contentType: 'image/png',
          buffer: samplePngBuffer
        }
      ]
    });
    const bkgInDbAfterCompletion = await Booking.findById(testBkg._id);
    recordResult(
      '4. Completion Photo Persisted into completionPhotos Array in MongoDB',
      attachCompletionRes.status === 200 && bkgInDbAfterCompletion.completionPhotos?.length > 0,
      `Count: ${bkgInDbAfterCompletion.completionPhotos?.length}`
    );

    // ----------------------------------------------------
    // TEST 5: Unsupported File Extension Blocked (.exe / .sh)
    // ----------------------------------------------------
    const maliciousRes = await sendMultipartRequest({
      path: '/api/bookings/upload-problem-photos',
      token: customerToken,
      files: [
        {
          fieldname: 'photos',
          filename: 'exploit.sh',
          contentType: 'text/x-shellscript',
          buffer: Buffer.from('#!/bin/bash\necho "hacked"')
        }
      ]
    });
    recordResult(
      '5. Malicious File Type Rejected (HTTP 400 Bad Request)',
      maliciousRes.status === 400,
      `Status: ${maliciousRes.status}`
    );

    // ----------------------------------------------------
    // TEST 6: File Limit Enforcement (>5 files rejected)
    // ----------------------------------------------------
    const sixFiles = [1, 2, 3, 4, 5, 6].map(i => ({
      fieldname: 'photos',
      filename: `pic_${i}.png`,
      contentType: 'image/png',
      buffer: samplePngBuffer
    }));
    const limitRes = await sendMultipartRequest({
      path: '/api/bookings/upload-problem-photos',
      token: customerToken,
      files: sixFiles
    });
    recordResult(
      '6. File Batch Count Limit (>5 files) Rejected (HTTP 400)',
      limitRes.status === 400,
      `Status: ${limitRes.status}`
    );

  } catch (err) {
    console.error('File Upload Suite encountered an error:', err);
    recordResult('Execution without uncaught error', false, err.message);
  } finally {
    await mongoose.disconnect();
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${results.filter(r => r.passed).length} / ${results.length} TESTS PASSED`);
  console.log('====================================================');
  return results;
}

if (process.argv[1] && process.argv[1].includes('test_file_uploads.js')) {
  runFileUploadTests().then((results) => {
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  });
}
