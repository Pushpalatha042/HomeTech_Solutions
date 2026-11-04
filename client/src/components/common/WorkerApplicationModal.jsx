import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import api from '../../api';

const ALL_CATEGORIES = [
  'Plumbing',
  'Electrical',
  'Cleaning',
  'Carpentry',
  'Painting',
  'Appliance Repair',
  'AC Repair',
  'Pest Control',
  'Home Maintenance'
];

export default function WorkerApplicationModal({ isOpen, onClose }) {
  const { user, updateUser, notify } = useAuth();
  const [selectedCats, setSelectedCats] = useState([]);
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState(2);
  const [serviceLocation, setServiceLocation] = useState('Vijayawada Central');
  const [address, setAddress] = useState(user?.address || '');
  const [professionalDescription, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleCategory = (cat) => {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedCats.length === 0) {
      notify('Please select at least one work category.', 'danger');
      return;
    }
    if (!serviceLocation.trim()) {
      notify('Service location is required.', 'danger');
      return;
    }
    if (!address.trim()) {
      notify('Complete address is required.', 'danger');
      return;
    }
    if (!professionalDescription.trim()) {
      notify('Please enter a brief professional description.', 'danger');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        selectedCategories: selectedCats,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        experience: Number(experience),
        serviceLocation: serviceLocation.trim(),
        address: address.trim(),
        professionalDescription: professionalDescription.trim()
      };

      const { data } = await api.post('/worker-applications', payload);
      notify(data.message, 'success');
      updateUser({ ...user, workerStatus: 'pending' });
      onClose();
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to submit worker application.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply to Join as a Service Professional" maxWidth="640px">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label>Full Name</label>
            <input className="form-input" value={user?.name || ''} readOnly style={{ background: '#f1f5f9' }} />
          </div>
          <div className="form-group">
            <label>Registered Phone</label>
            <input className="form-input" value={user?.phone || ''} readOnly style={{ background: '#f1f5f9' }} />
          </div>
        </div>

        <div className="form-group">
          <label>Email Address</label>
          <input className="form-input" value={user?.email || ''} readOnly style={{ background: '#f1f5f9' }} />
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 700, marginBottom: '8px' }}>
            Select Your Work Categories (Select all that apply) *
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {ALL_CATEGORIES.map((cat) => {
              const isChecked = selectedCats.includes(cat);
              return (
                <label
                  key={cat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isChecked ? 'var(--primary-navy)' : 'var(--border-color)'}`,
                    backgroundColor: isChecked ? 'var(--accent-yellow-light)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCategory(cat)}
                  />
                  <span>{cat}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label>Years of Experience *</label>
            <input
              type="number"
              min="0"
              max="50"
              className="form-input"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Service City / Location *</label>
            <input
              className="form-input"
              placeholder="e.g. Vijayawada Urban"
              value={serviceLocation}
              onChange={(e) => setServiceLocation(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Specific Skills (comma separated)</label>
          <input
            className="form-input"
            placeholder="e.g. Pipe welding, Basin repair, Leak detection"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Full Residential / Workshop Address *</label>
          <textarea
            rows="2"
            className="form-textarea"
            placeholder="Enter complete address..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Short Professional Description *</label>
          <textarea
            rows="3"
            className="form-textarea"
            placeholder="Describe your trade experience, certifications, and work background..."
            value={professionalDescription}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-yellow" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Worker Application'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
