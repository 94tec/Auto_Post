// server/controllers/quote.js
import * as quoteModel from '../models/quote.js';


// ✅ Create a new quote (with creator UID)
const createQuote = async (req, res) => {
  try {
    const { text, author } = req.body;
    const uid = req.user.uid;

    if (!text) {
      return res.status(400).json({ error: 'Quote text is required' });
    }

    // ❗ Prevent duplicate quotes
    const exists = await quoteModel.quoteExists(text);
    if (exists) {
      return res.status(409).json({ error: 'Quote already exists' });
    }

    const id = await quoteModel.createQuote({ text, author, uid });
    res.status(201).json({ success: true, id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// 📄 Get all quotes
const getAllQuotes = async (req, res) => {
  try {
    const quotes = await quoteModel.getAllQuotes();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
  
// 📄 Get single quote by ID}
const getQuoteById = async (req, res) => {
  try {
    const quote = await quoteModel.getQuoteById(req.params.id);
    console.log(`Fetching quote with ID ${req.params.id}`, quote); // 🔍 debug

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Error fetching quote:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
 
// ✏️ Update quote by ID
const updateQuote = async (req, res) => {
  try {
    await quoteModel.updateQuote(req.params.id, req.body);
    res.json({ success: true, message: 'Quote updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ❌ Delete quote by ID (Safe with existence check)
const deleteQuote = async (req, res) => {
  try {
    const id = req.params.id;

    // 1. Check if quote exists
    const quote = await quoteModel.getQuoteById(id);
    if (!quote) {
      return res.status(404).json({
        success: false,
        message: 'Quote not found or already deleted',
      });
    }

    // 2. Proceed to delete
    await quoteModel.deleteQuote(id);
    res.json({ success: true, message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete Error:', error.message);
    if (error.message === 'Quote not found') {
      return res.status(404).json({ error: 'Quote not found' });
    }
    res.status(500).json({ error: error.message });
  }
};
// Export all functions
export {
  createQuote,    
  getAllQuotes,
  getQuoteById,
  updateQuote,
  deleteQuote
};


  