// context/AuthContext.jsx — REPLACE your existing version with this entirely
//
// Syncs Firebase Auth → both React state AND Redux store simultaneously.
// • React state  → useAuth() works immediately, no Redux dependency
// • Redux store  → useRole() / RoleGuard read role from Firestore via Redux
// • Backward compatible: useAuth() still returns { user, loading, logout, setUser }

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useDispatch, useSelector }  from 'react-redux';
import { auth }         from '../config/firebase';
import {
  setUser    as reduxSetUser,
  setLoading as reduxSetLoading,
  fetchUserRole,
  selectRole,
  selectEmailVerified,
  selectAdminApproved,
  selectStatus,
  selectMustChangePassword,
  selectAuthInitialized,
} from '../store/authSlice';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();

  // Read enriched profile fields from Redux (populated by fetchUserRole from RTDB)
  const reduxRole          = useSelector(selectRole);
  const reduxEmailVerified = useSelector(selectEmailVerified);
  const reduxAdminApproved = useSelector(selectAdminApproved);
  const reduxStatus        = useSelector(selectStatus);
  const reduxMustChangePassword = useSelector(selectMustChangePassword);
  const authInitialized         = useSelector(selectAuthInitialized);

  const [baseUser, setBaseUser] = useState(null); // raw Firebase Auth fields
  const [loading,  setLoading]  = useState(true);
  const [roleFetched, setRoleFetched] = useState(false);

  useEffect(() => {
    dispatch(reduxSetLoading(true));

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const safe = {
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL:    firebaseUser.photoURL,
        };
        setBaseUser(safe);
        dispatch(reduxSetUser(safe));
        await dispatch(fetchUserRole(firebaseUser.uid));
        setRoleFetched(true); 
      } else {
        setBaseUser(null); 
        setRoleFetched(false);
        //setLoading(false);
        dispatch(reduxSetUser(null));
      }
      setLoading(false);
    });

    return unsub;
  }, [dispatch]);

  const logout = async () => {
    await signOut(auth);
    setBaseUser(null);
    setRoleFetched(false);
    dispatch(reduxSetUser(null));
  };

  // Merge DB profile into user so every consumer gets:
  // user.role, user.emailVerified, user.adminApproved, user.status
  const user = baseUser
    ? {
        ...baseUser,
        role:          reduxRole,
        emailVerified: reduxEmailVerified,
        adminApproved: reduxAdminApproved,
        status:        reduxStatus,
        mustChangePassword: reduxMustChangePassword,
      }
    : null;

  const roleReady = roleFetched;

  return (
    <AuthContext.Provider value={{
      user, loading, authInitialized,logout,
      setUser: setBaseUser,
      roleReady,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Named export for the rare cases that need the context object directly
export { AuthContext };

// Hook — preferred way to consume auth anywhere
export const useAuth = () => useContext(AuthContext);

export default AuthContext;