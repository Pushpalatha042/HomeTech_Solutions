# HomeTech Solutions — Full-Stack MERN Home Services Platform

HomeTech Solutions is a full-stack, enterprise-grade home services booking and management platform built on the **MERN Stack** (MongoDB, Express.js, React.js, Node.js) with real-time worker GPS location tracking powered by **Leaflet**, **OpenStreetMap**, and **Socket.IO**.

---

## 1. Key Features & Business Logic

- **Single Account, Dual Dashboard Architecture**:
  - Every public registration creates a Customer account (`roles: ['customer']`).
  - Customers can apply inside their dashboard to become a Worker ("Join as Worker").
  - Administrators review worker applications and approve specific service categories.
  - Upon approval, the same account gains access to both Customer and Worker Dashboards, switchable in real time without re-logging in.
- **Strict Category-Based Job Distribution**:
  - Workers receive work requests **ONLY** for categories they are approved for (e.g. Plumbing, Electrical, Cleaning).
  - Enforced in MongoDB queries and backend authorization logic.
  - Atomic database queries prevent multiple workers from accepting the same booking.
- **Live Worker Location Tracking**:
  - Workers share live device coordinates using the Browser Geolocation API (`navigator.geolocation.watchPosition`).
  - Coordinates are broadcast over Socket.IO rooms isolated by `bookingId`.
  - Customers track their assigned worker with live interactive Leaflet maps, custom markers, dashed routes, and dynamic ETA.
  - Administrators view all active assigned workers on an interactive multi-marker fleet tracking map.
- **Robust Authentication & Verification**:
  - 10-digit Indian numeric mobile number validation (`/^[6-9]\d{9}$/`).
  - Mandatory 6-digit Mobile OTP verification during signup with 5-minute expiry and rate-limiting.
  - Strong password requirements (Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character) with dynamic live UI validation and bcrypt hashing (12 rounds).
- **Payment Records & Tax Invoices**:
  - Test mock checkout generating official transaction references (`TXN-...`) and tax invoices (`INV-...`).
  - Printable and downloadable tax invoices with 18% GST breakdown.
- **Administrator Console**:
  - Manage users, worker applications (approve/reject with custom category selection), active workers, services, categories, bookings, and live fleet map.
  - Recharts visual analytics for monthly revenue trends and bookings by category.

---

## 2. Technology Stack

- **Frontend**: React 18, Vite, React Router DOM v6, Axios, Lucide React, Leaflet, Recharts, Context API, Centralized CSS3.
- **Backend**: Node.js, Express.js, REST API, JWT Authentication, bcryptjs, Socket.IO.
- **Database**: Local MongoDB Community Server (`mongodb://127.0.0.1:27017/hometech`), Mongoose ODM.

---

## 3. Getting Started & Local Setup

### Prerequisites
- Node.js v18+ (tested on Node v26)
- Local MongoDB Community Server running on `mongodb://127.0.0.1:27017`
- MongoDB Compass (optional, for viewing collections)

### Installation
From the project root (`c:\projects\hometech`):

```bash
# 1. Install root, server, and client dependencies
npm.cmd run install:all
```

### Database Seeding
Seed all 9 categories, 9 services, demo users, bookings, payments, and reviews:

```bash
npm.cmd run seed
```

### Start the Application
Start the backend and frontend concurrently:

```bash
npm.cmd run dev
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API & Sockets**: [http://localhost:5000](http://localhost:5000)
- **API Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 4. Demo Accounts

All demo accounts use password: `HomeTech@123`

| Role | Email | Phone | Approved Categories |
|---|---|---|---|
| **Administrator** | `admin@hometech.demo` | `9876543210` | Full Admin Privileges |
| **Worker (Plumbing)** | `worker@hometech.demo` | `9876501111` | Plumbing |
| **Worker (Electrical & AC)** | `amit.worker@hometech.demo` | `9876502222` | Electrical, Appliance Repair, AC Repair |
| **Customer** | `customer@hometech.demo` | `9876504444` | Customer Dashboard |
| **Pending Applicant** | `suresh.applicant@hometech.demo` | `9876505555` | Pending Admin Approval |

---

## 5. Automated Testing

Run the full end-to-end integration test suite verifying all 15 core workflows:

```bash
npm.cmd run test:all
```
"# HomeTech_Solutions" 
