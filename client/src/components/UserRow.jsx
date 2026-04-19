// components/UserRow.jsx
import { useState, useRef } from 'react';
import { FiMoreVertical, FiMail, FiCheck, FiX } from 'react-icons/fi';
import DropdownMenu from './DropdownMenu';

const C = {
  green: '#34D399',
  red: '#f87171',
  amber: '#F59E0B',
  indigo: '#818CF8',
};

const UserRow = ({ user, currentUid, onAction, onOpenDetail }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const buttonRef = useRef(null);

  const roleColor = {
    admin: 'text-indigo-300',
    user: 'text-green-300',
    guest: 'text-gray-400',
  }[user.role] || 'text-gray-400';

  const statusColor = {
    active: 'text-green-300',
    awaiting: 'text-indigo-300',
    suspended: 'text-red-300',
    pending: 'text-amber-300',
  }[user.status] || 'text-gray-400';

  const canTakeActions = user.uid !== currentUid;

  const handleAction = (action) => {
    setDropdownOpen(false);
    onAction(action, user);
  };

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      <td className="py-3 px-4">
        <div>
          <p className="text-sm text-white/80">{user.displayName || '—'}</p>
          <p className="text-xs text-white/40">{user.email}</p>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs capitalize ${roleColor}`}>{user.role}</span>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs capitalize ${statusColor}`}>{user.status}</span>
      </td>
      <td className="py-3 px-4">
        {user.emailVerified ? (
          <FiCheck size={14} className="text-green-400" />
        ) : (
          <FiX size={14} className="text-red-400" />
        )}
      </td>
      <td className="py-3 px-4">
        {user.permissions?.write ? (
          <FiCheck size={14} className="text-green-400" />
        ) : (
          <FiX size={14} className="text-gray-500" />
        )}
      </td>
      <td className="py-3 px-4">
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition"
          >
            <FiMoreVertical size={14} className="text-white/40" />
          </button>
          <DropdownMenu
            isOpen={dropdownOpen}
            onClose={() => setDropdownOpen(false)}
            anchorRef={buttonRef}
          >
            {canTakeActions && (
              <>
                {user.role === 'guest' && (
                  <button
                    onClick={() => handleAction('approve')}
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"
                  >
                    Approve
                  </button>
                )}
                {user.role === 'user' && user.status === 'active' && !user.permissions?.write && (
                  <button
                    onClick={() => handleAction('grantWrite')}
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"
                  >
                    Grant Write
                  </button>
                )}
                {user.role === 'user' && user.status === 'active' && user.permissions?.write && (
                  <button
                    onClick={() => handleAction('revokeWrite')}
                    className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"
                  >
                    Revoke Write
                  </button>
                )}
                {user.status === 'active' && (
                  <button
                    onClick={() => handleAction('suspend')}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-white/10 transition"
                  >
                    Suspend
                  </button>
                )}
                {user.status === 'suspended' && (
                  <button
                    onClick={() => handleAction('reactivate')}
                    className="w-full text-left px-3 py-2 text-xs text-green-400 hover:bg-white/10 transition"
                  >
                    Reactivate
                  </button>
                )}
              </>
            )}
            <button
              onClick={() => {
                setDropdownOpen(false);
                onOpenDetail(user);
              }}
              className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 transition"
            >
              View Details
            </button>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
}

export default UserRow;