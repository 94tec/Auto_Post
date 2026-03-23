// components/RoleGuard.jsx
// Wraps any JSX that should only appear for certain roles.
//
// Usage:
//   <RoleGuard allowedRoles={['admin']}>
//     <button>Delete</button>
//   </RoleGuard>
//
//   <RoleGuard allowedRoles={['admin', 'user']} fallback={<p>No access</p>}>
//     <Dashboard />
//   </RoleGuard>
import { useSelector } from 'react-redux';
import { selectRole, selectAuthLoading, selectRoleLoading } from '../store/authSlice';

const RoleGuard = ({
  children,
  allowedRoles = [],
  fallback     = null,  // rendered when role not allowed
  loadingNode  = null,  // rendered while auth is resolving
}) => {
  const role        = useSelector(selectRole);
  const authLoading = useSelector(selectAuthLoading);
  const roleLoading = useSelector(selectRoleLoading);

  if (authLoading || roleLoading) return loadingNode;
  if (!allowedRoles.includes(role)) return fallback;
  return children;
};

export default RoleGuard;