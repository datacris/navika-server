const mongoose = require("mongoose");

const QuoteSchema = mongoose.Schema({
  quote: {
    type: String,
    required: true,
    trim: true,
  },
  reference: {
    type: String,
    trim: true,
  },
  author: {
    type: String,
    trim: true,
  },
  book: {
    type: String,
    trim: true,
  },
  created: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("Quote", QuoteSchema);
