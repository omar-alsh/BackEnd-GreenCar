const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true },
    type: { type: String, required: true },
    image: { type: String, required: true }
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
