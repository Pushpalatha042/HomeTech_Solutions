import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Toast() {
  const { notice, notify } = useAuth();
  if (!notice) return null;

  const isSuccess = notice.type === 'success';
  const isDanger = notice.type === 'danger';

  return (
    <div className="toast-container">
      <div
        className="toast"
        style={{
          borderLeftColor: isSuccess
            ? 'var(--success)'
            : isDanger
            ? 'var(--danger)'
            : 'var(--accent-yellow)'
        }}
      >
        {isSuccess ? (
          <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
        ) : isDanger ? (
          <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
        ) : (
          <Info size={18} style={{ color: 'var(--accent-yellow)' }} />
        )}
        <span>{notice.message}</span>
        <button
          onClick={() => notify('')}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            marginLeft: 'auto'
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
