import acRepairImg from './ac-repair.jpg';
import applianceImg from './appliance.jpg';
import carpentryImg from './carpentry.jpg';
import cleaningImg from './cleaning.jpg';
import electricalImg from './electrical.jpg';
import homeMaintenanceImg from './home-maintenance.jpg';
import paintingImg from './painting.jpg';
import pestControlImg from './pest-control.jpg';
import plumbingImg from './plumbing.jpg';

import avatarCustomer from './avatar-customer.jpg';
import avatarWorker from './avatar-worker.jpg';
import bookingBanner from './booking-banner.jpg';
import contactSupport from './contact-support.jpg';

export const serviceCategoryImages = {
  'AC Repair': acRepairImg,
  'Appliance Repair': applianceImg,
  'Carpentry': carpentryImg,
  'Cleaning': cleaningImg,
  'Electrical': electricalImg,
  'Home Maintenance': homeMaintenanceImg,
  'Painting': paintingImg,
  'Pest Control': pestControlImg,
  'Plumbing': plumbingImg
};

/**
 * Returns the matching service category image
 * @param {string|object} serviceOrCategory - Category string or service object
 * @returns {string} Image path / URL
 */
export function getServiceImage(serviceOrCategory) {
  if (!serviceOrCategory) return homeMaintenanceImg;
  if (typeof serviceOrCategory === 'string') {
    return serviceCategoryImages[serviceOrCategory] || homeMaintenanceImg;
  }
  const cat = serviceOrCategory.category;
  if (cat && serviceCategoryImages[cat]) {
    return serviceCategoryImages[cat];
  }
  return serviceOrCategory.image || homeMaintenanceImg;
}

export {
  acRepairImg,
  applianceImg,
  carpentryImg,
  cleaningImg,
  electricalImg,
  homeMaintenanceImg,
  paintingImg,
  pestControlImg,
  plumbingImg,
  avatarCustomer,
  avatarWorker,
  bookingBanner,
  contactSupport
};
