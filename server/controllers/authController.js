// controllers/authController.js
const speakeasy = require('speakeasy');

exports.enable2FA = async (req, res) => {
  const secret = speakeasy.generateSecret({ length: 20 });
  await UserModel.update2FASecret(req.user.id, secret.base32);
  
  res.json({
    secret: secret.base32,
    qrCodeUrl: `otpauth://totp/YourApp:${req.user.email}?secret=${secret.base32}&issuer=YourApp`
  });
};

exports.verify2FA = async (req, res, next) => {
  const { token } = req.body;
  const user = await UserModel.findById(req.user.id);
  
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 1
  });
  
  if (!verified) {
    return res.status(403).json({ error: 'Invalid 2FA token' });
  }
  
  // Store 2FA verification in session
  req.session.twoFactorVerified = true;
  next();
};