// PasswordStrengthIndicator.jsx
const PasswordStrengthIndicator = ({ password }) => {
  const getStrength = (pass) => {
    if (!pass) return 0;

    let strength = 0;

    const hasUpper = /[A-Z]/.test(pass);
    const hasLower = /[a-z]/.test(pass);
    const hasDigit = /[0-9]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    const lengthScore = pass.length >= 12 ? 2 : pass.length >= 8 ? 1 : 0;
    const varietyScore = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

    strength = lengthScore + varietyScore;

    return Math.min(strength, 5);
  };

  const strength = getStrength(password);
  const strengthText = ['Very Weak', 'Weak', 'Moderate', 'Strong', 'Very Strong'][strength - 1] || '';
  
  // Use gold for very strong, green for strong, etc.
  const strengthColor = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-blue-500',
    'bg-[#F59E0B]' // gold for very strong
  ][strength - 1] || 'bg-gray-500';

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Password Strength:</span>
        {password && (
          <span className={`text-xs font-medium ${
            strength < 2 ? 'text-red-400' :
            strength < 3 ? 'text-orange-400' :
            strength < 4 ? 'text-yellow-400' :
            strength < 5 ? 'text-blue-400' : 'text-[#F59E0B]'
          }`}>
            {strengthText}
          </span>
        )}
      </div>
      <div className="flex gap-1 h-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-full rounded-full flex-1 transition-all duration-300 ${
              i <= strength ? strengthColor : 'bg-[#1C2135]' // slate inactive
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthIndicator;