// server/routes/quote.routes.js
import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import * as quoteCtrl from '../controllers/quote.js';

const router = express.Router();

// Define routes for quotes
// Ensure all routes are protected by verifyToken middleware
router.post("/", verifyToken, quoteCtrl.createQuote);
router.get("/", verifyToken, quoteCtrl.getAllQuotes);
router.put("/:id", verifyToken, quoteCtrl.updateQuote);
router.delete("/:id", verifyToken, quoteCtrl.deleteQuote);

export default router;
