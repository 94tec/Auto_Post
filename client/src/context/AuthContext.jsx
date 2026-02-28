import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { auth } from "../config/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

// Create context with TypeScript-ready interface
export const AuthContext = createContext({
  user: null,
  loading: true,
  isAuthenticated: false,
  logout: async () => {},
  setUser: () => {},
  checkAuth: () => false,
});

// Provider wrapper
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is authenticated
  const isAuthenticated = useMemo(() => !!user, [user]);

  // Handle user logout
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (error) {
      toast.error("Logout failed");
      console.error("Logout error:", error);
    }
  };

  // Check if user has specific role/claim
  const checkAuth = (requiredClaims = []) => {
    if (!user) return false;
    if (requiredClaims.length === 0) return true;
    
    // Implement your custom claim checking logic here
    // For example, if using Firebase custom claims:
    // return requiredClaims.some(claim => user.claims?.[claim]);
    
    return false;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // You could add additional user data fetching here
          // For example:
          // const tokenResult = await firebaseUser.getIdTokenResult();
          // const userWithClaims = {
          //   ...firebaseUser,
          //   claims: tokenResult.claims
          // };
          setUser(firebaseUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth state error:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    setUser,
    logout,
    checkAuth,
  }), [user, loading, isAuthenticated]);

  return (
    <AuthContext.Provider value={value}>
      {/* Only render children when auth state is determined */}
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Custom hook with additional safety checks
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};