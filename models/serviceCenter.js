const mongoose = require("mongoose");

const serviceCenterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    location: { type: String, required: true },
    image: { type: String, required: true },
    type: {
      type: String,
      enum: ["auto_repair", "auto_parts_store"],
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceCenter", serviceCenterSchema);
