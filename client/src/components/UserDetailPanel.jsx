// components/UserDetailPanel.jsx
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiShield, FiEdit2, FiLock, FiMail, FiUser } from 'react-icons/fi';

const C = {
  slate: '#141924',
  border: 'rgba(255,255,255,0.07)',
  amber: '#F59E0B',
  indigo: '#818CF8',
  dim: 'rgba(255,255,255,0.38)',
};

const UserDetailPanel = ({ user, isOpen, onClose, onAction }) => {
  if (!user) return null;

  const handleAction = (action) => {
    onAction(action, user);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 bg-[#0D1220] border-l border-white/10 shadow-2xl overflow-y-auto"
          >
            <div className="sticky top-0 bg-[#0D1220]/80 backdrop-blur-sm border-b border-white/10 p-4 flex justify-between items-center">
              <h2 className="text-base font-semibold text-white">User Details</h2>
              <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg">
                <FiX size={18} className="text-white/60" />
              </button>
            </div>
            <div className="p-5 space-y-6">
              {/* Avatar & name */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-amber-500/20 flex items-center justify-center text-lg font-bold text-indigo-300">
                  {(user.displayName?.[0] || user.email[0]).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{user.displayName || '—'}</h3>
                  <p className="text-sm text-dim">{user.email}</p>
                </div>
              </div>

              {/* Basic info */}
              <div className="space-y-2">
                <p className="text-xs text-dim uppercase tracking-wider">Account</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <span className="text-white/60">Role</span>
                  <span className="text-white capitalize">{user.role}</span>
                  <span className="text-white/60">Status</span>
                  <span className="text-white capitalize">{user.status}</span>
                  <span className="text-white/60">Email verified</span>
                  <span className="text-white">{user.emailVerified ? 'Yes' : 'No'}</span>
                  <span className="text-white/60">Admin approved</span>
                  <span className="text-white">{user.adminApproved ? 'Yes' : 'No'}</span>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <p className="text-xs text-dim uppercase tracking-wider mb-2">Permissions</p>
                <div className="flex flex-wrap gap-2">
                  {['read', 'write', 'delete'].map(perm => (
                    <span key={perm} className={`px-2 py-1 rounded text-xs ${user.permissions?.[perm] ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-dim'}`}>
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <p className="text-xs text-dim uppercase tracking-wider mb-2">Actions</p>
                <div className="space-y-2">
                  {user.role === 'guest' && (
                    <button onClick={() => handleAction('approve')} className="w-full py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-sm">
                      Approve User
                    </button>
                  )}
                  {user.role === 'user' && user.status === 'active' && !user.permissions?.write && (
                    <button onClick={() => handleAction('grantWrite')} className="w-full py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm">
                      Grant Write Access
                    </button>
                  )}
                  {user.role === 'user' && user.status === 'active' && user.permissions?.write && (
                    <button onClick={() => handleAction('revokeWrite')} className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm">
                      Revoke Write Access
                    </button>
                  )}
                  {user.status === 'active' && (
                    <button onClick={() => handleAction('suspend')} className="w-full py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-sm">
                      Suspend User
                    </button>
                  )}
                  {user.status === 'suspended' && (
                    <button onClick={() => handleAction('reactivate')} className="w-full py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-sm">
                      Reactivate User
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default UserDetailPanel;