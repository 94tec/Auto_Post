import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';

const ProtectedRoute = ({ children, redirectPath = '/login', showLoading = true }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return showLoading ? (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      </div>
    ) : null;
  }

  if (!currentUser) {
    return <Navigate to={redirectPath} replace state={{ from: location }} />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  redirectPath: PropTypes.string,
  showLoading: PropTypes.bool,
};

export default ProtectedRoute;