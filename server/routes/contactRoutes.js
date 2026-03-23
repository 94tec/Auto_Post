
// routes/contact.js  — wire: router.use('/contact', contactRoute)
// ══════════════════════════════════════════════════════════════
 
import express2 from 'express';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { sendContactEmail } from '../services/emailService.js';
 
const contactRouter = express2.Router();
 
contactRouter.post('/',
  rateLimiter({ max: 5, window: 60 * 10, keyBy: 'ip', message: 'Too many contact requests.' }),
  async (req, res) => {
    const { name, email, topic, message } = req.body;
    if (!name?.trim() || !email?.trim() || !message?.trim())
      return res.status(400).json({ error: 'name, email and message are required' });
    if (message.trim().length < 10)
      return res.status(400).json({ error: 'Message too short' });
 
    try {
      await sendContactEmail({ name, email, topic, message });
      return res.json({ success: true, message: 'Message received. We\'ll be in touch soon.' });
    } catch (err) {
      console.error('[Contact]', err.message);
      return res.status(500).json({ error: 'Failed to send. Please email us directly.' });
    }
  }
);
 
export { contactRouter };