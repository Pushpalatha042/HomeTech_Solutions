import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
import connectDB from './config/db.js';
import User from './models/User.js';
import ServiceCategory from './models/ServiceCategory.js';
import Service from './models/Service.js';
import Booking from './models/Booking.js';
import Payment from './models/Payment.js';
import WorkerApplication from './models/WorkerApplication.js';
import Review from './models/Review.js';
import WorkerLocation from './models/WorkerLocation.js';
import WorkRequest from './models/WorkRequest.js';

dotenv.config();

async function runSeed() {
  try {
    await connectDB();
    console.log('Connected to MongoDB for seeding...');

    // Clear existing collections for a clean, consistent seed state
    await User.deleteMany({});
    await Booking.deleteMany({});
    await Payment.deleteMany({});
    await WorkerApplication.deleteMany({});
    await Review.deleteMany({});
    await WorkerLocation.deleteMany({});
    await WorkRequest.deleteMany({});

    // Password satisfying all strong password rules: Min 8, Upper, Lower, Number, Special
    const defaultPassword = await bcrypt.hash('HomeTech@123', 12);

    // 1. Seed Service Categories
    const categoriesData = [
      { name: 'Plumbing', description: 'Expert solutions for taps, leaks, pipes, and fixtures', icon: 'Wrench' },
      { name: 'Electrical', description: 'Certified electrical repairs, wiring, lighting and safety', icon: 'Zap' },
      { name: 'Cleaning', description: 'Comprehensive home, kitchen and deep cleaning services', icon: 'Sparkles' },
      { name: 'Carpentry', description: 'Furniture repair, custom woodwork, doors and fittings', icon: 'Hammer' },
      { name: 'Painting', description: 'Interior and exterior wall painting and surface finishing', icon: 'PaintRoller' },
      { name: 'Appliance Repair', description: 'Fast diagnostics and servicing for household appliances', icon: 'Refrigerator' },
      { name: 'AC Repair', description: 'AC servicing, gas refills, installation and cooling repairs', icon: 'Wind' },
      { name: 'Pest Control', description: 'Safe, eco-friendly pest control and inspection services', icon: 'Bug' },
      { name: 'Home Maintenance', description: 'All-in-one general home maintenance and repairs', icon: 'Home' }
    ];

    const categoryMap = {};
    for (const cat of categoriesData) {
      const saved = await ServiceCategory.findOneAndUpdate(
        { name: cat.name },
        { $set: cat },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      categoryMap[cat.name] = saved._id;
    }
    console.log(`Seeded ${categoriesData.length} categories.`);

    // 2. Seed Services
    const servicesData = [
      {
        name: 'Plumbing Service',
        category: 'Plumbing',
        categoryId: categoryMap['Plumbing'],
        description: 'Professional plumbing services for leaks, taps, pipes, bathroom fittings and drain unblocking.',
        price: 299,
        image: '/assets/images/plumbing.jpg',
        features: ['Leak Repair', 'Tap & Pipe Installation', 'Bathroom Fittings', 'Drain Cleaning'],
        rating: 4.8,
        reviewsCount: 120
      },
      {
        name: 'Electrical Service',
        category: 'Electrical',
        categoryId: categoryMap['Electrical'],
        description: 'Qualified help for electrical repairs, circuit breakers, light fixtures and safe appliance hookups.',
        price: 399,
        image: '/assets/images/electrical.jpg',
        features: ['Switch & Socket Repair', 'Light Installation', 'Fan Assembly', 'Safety Earthing Checks'],
        rating: 4.9,
        reviewsCount: 95
      },
      {
        name: 'Cleaning Service',
        category: 'Cleaning',
        categoryId: categoryMap['Cleaning'],
        description: 'Deep and standard home cleaning for kitchens, bathrooms, floors and living spaces.',
        price: 249,
        image: '/assets/images/cleaning.jpg',
        features: ['Deep Kitchen Clean', 'Bathroom Sanitization', 'Floor Scrubbing', 'Dusting & Vacuuming'],
        rating: 4.7,
        reviewsCount: 154
      },
      {
        name: 'Carpentry Service',
        category: 'Carpentry',
        categoryId: categoryMap['Carpentry'],
        description: 'Furniture assembly, hinge repairs, custom wooden shelves and structural carpentry.',
        price: 499,
        image: '/assets/images/carpentry.jpg',
        features: ['Furniture Assembly', 'Door & Window Alignment', 'Custom Shelves', 'Lock Installation'],
        rating: 4.8,
        reviewsCount: 88
      },
      {
        name: 'Painting Service',
        category: 'Painting',
        categoryId: categoryMap['Painting'],
        description: 'High-quality wall painting, waterproof coating, touch-ups and colour consultations.',
        price: 699,
        image: '/assets/images/painting.jpg',
        features: ['Wall Putty & Primer', 'Room Painting', 'Texture Art', 'Waterproofing Touch-ups'],
        rating: 4.9,
        reviewsCount: 72
      },
      {
        name: 'Appliance Repair',
        category: 'Appliance Repair',
        categoryId: categoryMap['Appliance Repair'],
        description: 'Prompt diagnosis and repair for washing machines, refrigerators, microwaves, and geysers.',
        price: 299,
        image: '/assets/images/appliance.jpg',
        features: ['Refrigerator Cooling Check', 'Washing Machine Drum Fix', 'Microwave Diagnosis', 'Geyser Servicing'],
        rating: 4.7,
        reviewsCount: 110
      },
      {
        name: 'AC Repair & Service',
        category: 'AC Repair',
        categoryId: categoryMap['AC Repair'],
        description: 'Comprehensive split and window AC cleaning, gas charging, filter wash and troubleshooting.',
        price: 449,
        image: '/assets/images/ac-repair.jpg',
        features: ['Deep Jet Cleaning', 'Gas Leak Check & Refill', 'Cooling Coil Inspection', 'Installation / Uninstallation'],
        rating: 4.8,
        reviewsCount: 65
      },
      {
        name: 'Pest Control Service',
        category: 'Pest Control',
        categoryId: categoryMap['Pest Control'],
        description: 'Odorless pest eradication treatments for termites, cockroaches, bed bugs and rodents.',
        price: 599,
        image: '/assets/images/pest-control.jpg',
        features: ['Cockroach Gel Treatment', 'Termite Protection', 'Bed Bug Spray', 'Rodent Bait Stations'],
        rating: 4.6,
        reviewsCount: 43
      },
      {
        name: 'Complete Home Maintenance',
        category: 'Home Maintenance',
        categoryId: categoryMap['Home Maintenance'],
        description: 'End-to-end multi-skilled handyman service for periodic inspection and preventive home care.',
        price: 799,
        image: '/assets/images/home-maintenance.jpg',
        features: ['Plumbing & Tap Audit', 'Electrical Load Check', 'Door & Lock Lubrication', 'Tile & Grout Seal'],
        rating: 4.9,
        reviewsCount: 38
      }
    ];

    const serviceMap = {};
    for (const s of servicesData) {
      const saved = await Service.findOneAndUpdate(
        { name: s.name },
        { $set: s },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      serviceMap[s.name] = saved;
    }
    console.log(`Seeded ${servicesData.length} services.`);

    // 3. Seed Users (Admin, Dual-Dashboard Workers, Customers, Applicants)
    const adminUser = await User.findOneAndUpdate(
      { email: 'admin@hometech.demo' },
      {
        $set: {
          name: 'Platform Administrator',
          email: 'admin@hometech.demo',
          phone: '9876543210',
          password: defaultPassword,
          roles: ['customer', 'admin'],
          activeRole: 'admin',
          isPhoneVerified: true,
          isActive: true,
          workerStatus: 'not_applied',
          address: 'HomeTech Central HQ, Vijayawada'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Worker 1: Approved Plumber
    const workerRahul = await User.findOneAndUpdate(
      { email: 'worker@hometech.demo' },
      {
        $set: {
          name: 'Rahul Kumar',
          email: 'worker@hometech.demo',
          phone: '9876501111',
          password: defaultPassword,
          roles: ['customer', 'worker'],
          activeRole: 'worker',
          isPhoneVerified: true,
          isActive: true,
          workerStatus: 'approved',
          approvedCategories: ['Plumbing'],
          isAvailable: true,
          address: '123, Green Street, Vijayawada'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Worker 2: Approved Electrician & Appliance Technician (Worker B)
    const workerAmit = await User.findOneAndUpdate(
      { email: 'amit.worker@hometech.demo' },
      {
        $set: {
          name: 'Amit Sharma',
          email: 'amit.worker@hometech.demo',
          phone: '9876502222',
          password: defaultPassword,
          roles: ['customer', 'worker'],
          activeRole: 'worker',
          isPhoneVerified: true,
          isActive: true,
          workerStatus: 'approved',
          approvedCategories: ['Electrical', 'Appliance Repair', 'AC Repair'],
          isAvailable: true,
          address: '45, Ring Road, Vijayawada'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Worker 3: Approved Plumber & Carpenter (Worker C)
    const workerVikram = await User.findOneAndUpdate(
      { email: 'workerc@hometech.demo' },
      {
        $set: {
          name: 'Vikram Singh',
          email: 'workerc@hometech.demo',
          phone: '9876503333',
          password: defaultPassword,
          roles: ['customer', 'worker'],
          activeRole: 'worker',
          isPhoneVerified: true,
          isActive: true,
          workerStatus: 'approved',
          approvedCategories: ['Plumbing', 'Carpentry'],
          isAvailable: true,
          address: '78, Gandhinagar, Vijayawada'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // WorkerApplication for Worker C
    await WorkerApplication.findOneAndUpdate(
      { userId: workerVikram._id },
      {
        $set: {
          userId: workerVikram._id,
          fullName: 'Vikram Singh',
          phone: '9876503333',
          email: 'workerc@hometech.demo',
          skills: ['Plumbing', 'Pipe Repair', 'Carpentry', 'Woodwork'],
          selectedCategories: ['Plumbing', 'Carpentry'],
          approvedCategories: ['Plumbing', 'Carpentry'],
          experience: 5,
          serviceLocation: 'Vijayawada Central',
          address: '78, Gandhinagar, Vijayawada',
          professionalDescription: 'Certified master plumber and carpenter with 5 years experience.',
          applicationStatus: 'approved'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Customer: John Doe
    const customerJohn = await User.findOneAndUpdate(
      { email: 'customer@hometech.demo' },
      {
        $set: {
          name: 'John Doe',
          email: 'customer@hometech.demo',
          phone: '9876504444',
          password: defaultPassword,
          roles: ['customer'],
          activeRole: 'customer',
          isPhoneVerified: true,
          isActive: true,
          workerStatus: 'not_applied',
          address: '123, Green Street, Mumbai, Maharashtra 400001'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Customer Applicant: Suresh Verma (Pending Worker Application)
    const applicantSuresh = await User.findOneAndUpdate(
      { email: 'suresh.applicant@hometech.demo' },
      {
        $set: {
          name: 'Suresh Verma',
          email: 'suresh.applicant@hometech.demo',
          phone: '9876505555',
          password: defaultPassword,
          roles: ['customer'],
          activeRole: 'customer',
          isPhoneVerified: true,
          isActive: true,
          workerStatus: 'pending',
          address: '77, Lake View Road, Vijayawada'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('Seeded Users (Admin, Workers, Customer, Applicant).');

    // 4. Seed Worker Applications
    await WorkerApplication.findOneAndUpdate(
      { userId: workerRahul._id },
      {
        $set: {
          fullName: 'Rahul Kumar',
          phone: '9876501111',
          email: 'worker@hometech.demo',
          skills: ['Pipe Fitting', 'Bathroom Overhaul', 'Leak Detection'],
          selectedCategories: ['Plumbing'],
          approvedCategories: ['Plumbing'],
          experience: 5,
          serviceLocation: 'Vijayawada, Urban',
          address: '123, Green Street, Vijayawada',
          professionalDescription: 'Certified master plumber with over 5 years of commercial and residential expertise.',
          applicationStatus: 'approved',
          reviewedBy: adminUser._id,
          reviewedAt: new Date(Date.now() - 30 * 86400000)
        }
      },
      { upsert: true, new: true }
    );

    await WorkerApplication.findOneAndUpdate(
      { userId: applicantSuresh._id },
      {
        $set: {
          fullName: 'Suresh Verma',
          phone: '9876505555',
          email: 'suresh.applicant@hometech.demo',
          skills: ['Inverter AC Repairs', 'Gas Charging', 'Wiring'],
          selectedCategories: ['AC Repair', 'Appliance Repair'],
          approvedCategories: [],
          experience: 3,
          serviceLocation: 'Vijayawada Central',
          address: '77, Lake View Road, Vijayawada',
          professionalDescription: 'Experienced HVAC & AC technician seeking to join HomeTech network.',
          applicationStatus: 'pending'
        }
      },
      { upsert: true, new: true }
    );

    // 5. Seed Bookings
    // Booking 1: Active In-Progress / Accepted Plumbing Job (for John Doe & Rahul Kumar)
    const bookingPlumbing = await Booking.findOneAndUpdate(
      { bookingId: 'HT-BKG-1001' },
      {
        $set: {
          bookingId: 'HT-BKG-1001',
          customerId: customerJohn._id,
          workerId: workerRahul._id,
          serviceId: serviceMap['Plumbing Service']._id,
          category: 'Plumbing',
          categoryId: categoryMap['Plumbing'],
          bookingDate: new Date(),
          bookingTime: '10:00 AM',
          address: '123, Green Street, Mumbai, Maharashtra 400001',
          contactNumber: '9876504444',
          instructions: 'Kitchen sink tap is leaking continuously. Please bring replacement washers.',
          totalAmount: 299,
          status: 'Accepted',
          paymentStatus: 'Paid'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Location for active booking HT-BKG-1001 (Vijayawada coordinates around 16.5062, 80.6480 or Mumbai 19.0760, 72.8777)
    await WorkerLocation.create({
      workerId: workerRahul._id,
      bookingId: bookingPlumbing._id,
      latitude: 19.0790,
      longitude: 72.8800,
      accuracy: 8,
      heading: 90,
      speed: 18,
      lastUpdated: new Date()
    });

    // Payment for Booking 1
    await Payment.findOneAndUpdate(
      { bookingId: bookingPlumbing._id },
      {
        $set: {
          paymentId: 'HT-PAY-2001',
          customerId: customerJohn._id,
          bookingId: bookingPlumbing._id,
          amount: 299,
          paymentMethod: 'Online Mock Payment (Test)',
          paymentStatus: 'Paid',
          transactionReference: 'TXN-HOMETECH-SEED-901',
          invoiceNumber: 'INV-2026-001'
        }
      },
      { upsert: true, new: true }
    );

    // Booking 2: Completed Electrical Job
    const bookingElectrical = await Booking.findOneAndUpdate(
      { bookingId: 'HT-BKG-1002' },
      {
        $set: {
          bookingId: 'HT-BKG-1002',
          customerId: customerJohn._id,
          workerId: workerAmit._id,
          serviceId: serviceMap['Electrical Service']._id,
          category: 'Electrical',
          categoryId: categoryMap['Electrical'],
          bookingDate: new Date(Date.now() - 3 * 86400000),
          bookingTime: '02:00 PM',
          address: '123, Green Street, Mumbai, Maharashtra 400001',
          contactNumber: '9876504444',
          instructions: 'Master bedroom ceiling fan regulator replacement.',
          totalAmount: 399,
          status: 'Completed',
          paymentStatus: 'Paid'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Payment.findOneAndUpdate(
      { bookingId: bookingElectrical._id },
      {
        $set: {
          paymentId: 'HT-PAY-2002',
          customerId: customerJohn._id,
          bookingId: bookingElectrical._id,
          amount: 399,
          paymentMethod: 'Online Mock Payment (Test)',
          paymentStatus: 'Paid',
          transactionReference: 'TXN-HOMETECH-SEED-902',
          invoiceNumber: 'INV-2026-002'
        }
      },
      { upsert: true, new: true }
    );

    // Booking 3: Pending Job for Cleaning (eligible for workers with Cleaning category)
    await Booking.findOneAndUpdate(
      { bookingId: 'HT-BKG-1003' },
      {
        $set: {
          bookingId: 'HT-BKG-1003',
          customerId: customerJohn._id,
          workerId: null,
          serviceId: serviceMap['Cleaning Service']._id,
          category: 'Cleaning',
          categoryId: categoryMap['Cleaning'],
          bookingDate: new Date(Date.now() + 86400000),
          bookingTime: '11:00 AM',
          address: '123, Green Street, Mumbai, Maharashtra 400001',
          contactNumber: '9876504444',
          instructions: 'Full deep cleaning before family event.',
          totalAmount: 249,
          status: 'Pending',
          paymentStatus: 'Pending'
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Seed Review for completed booking
    await Review.findOneAndUpdate(
      { bookingId: bookingElectrical._id },
      {
        $set: {
          customerId: customerJohn._id,
          workerId: workerAmit._id,
          bookingId: bookingElectrical._id,
          rating: 5,
          comment: 'Amit did a wonderful job fixing the electrical wiring quickly and safely.',
          serviceName: 'Electrical Service'
        }
      },
      { upsert: true, new: true }
    );

    console.log('Seeding finished successfully!');
    console.log('Default credentials for all demo accounts: HomeTech@123');
    console.log('Admin: admin@hometech.demo');
    console.log('Worker (Plumbing): worker@hometech.demo');
    console.log('Worker (Electrical): amit.worker@hometech.demo');
    console.log('Customer: customer@hometech.demo');
    console.log('Pending Applicant: suresh.applicant@hometech.demo');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

runSeed();
