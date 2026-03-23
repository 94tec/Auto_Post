// hooks/useRole.js
// Drop-in hook for permission checks anywhere in the app.
// Works with both JSX guards and imperative logic.
import { useSelector } from 'react-redux';
import {
  selectUser,
  selectRole,
  selectAuthLoading,
  selectRoleLoading,
  ROLES,
} from '../store/authSlice';

const useRole = () => {
  const user        = useSelector(selectUser);
  const role        = useSelector(selectRole);
  const authLoading = useSelector(selectAuthLoading);
  const roleLoading = useSelector(selectRoleLoading);

  /**
   * isAllowed(['admin', 'user']) → true if current role is in the list.
   * Pass ROLES constants or plain strings: 'admin', 'user', 'guest'.
   */
  const isAllowed = (allowedRoles = []) => allowedRoles.includes(role);

  return {
    user,
    role,
    loading: authLoading || roleLoading,
    isGuest:   role === ROLES.GUEST,
    isUser:    role === ROLES.USER,
    isAdmin:   role === ROLES.ADMIN,
    isAllowed,
  };
};

export default useRole;