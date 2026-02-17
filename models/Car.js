// Car.js
import mongoose from "mongoose";

const carSchema = new mongoose.Schema(
  {
    brand: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    price: { type: Number, required: true },
    mileage: { type: Number, default: 0 },
    fuelType: {
      type: String,
      enum: ["gasoline", "diesel", "hybrid", "electric"]
    },
    transmission: { type: String, enum: ["automatic", "manual"] },
    color: String,
    engine: { capacity: String, horsepower: Number, cylinders: Number },
    images: [String],
    features: [String],
    description: String,
    categorySlug: { type: String, required: true },
    categoryType: { type: String, required: true },
    status: { type: String, enum: ["available", "sold"], default: "available" }
  },
  { timestamps: true }
);

export default mongoose.model("Car", carSchema);
