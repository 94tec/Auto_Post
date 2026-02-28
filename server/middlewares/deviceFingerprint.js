// middleware/deviceFingerprint.js
import Fingerprint from 'express-fingerprint';

const deviceFingerprint = Fingerprint({
  parameters: [
    Fingerprint.useragent,
    Fingerprint.acceptHeaders,
    Fingerprint.geoip,
    (req) => {
      return {
        screenResolution: req.headers['x-screen-resolution'],
        timezone: req.headers['x-timezone'],
      };
    }
  ]
});

const verifyDevice = async (req, res, next) => {
  if (req.path === '/login') {
    const fingerprint = req.fingerprint;
    const knownDevice = await DeviceModel.findOne({
      userId: req.user?.id,
      fingerprint
    });
    
    if (!knownDevice && req.user) {
      sendNewDeviceAlert(req.user.email, req.ip, fingerprint);
    }
  }
  next();
};
export { deviceFingerprint, verifyDevice };