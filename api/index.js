// index.js (CommonJS)
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

import Car from "../models/Car.js";
import User from "../models/User.js";
import Category from "../models/Category.js";
import ServiceCenter from "../models/ServiceCenter.js";

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("Error:", err));

// ================= APIs =================

// تسجيل الدخول
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "المستخدم غير موجود" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "كلمة المرور غير صحيحة" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, user: { email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: "خطأ في تسجيل الدخول" });
  }
});

// إضافة مستخدم جديد
app.post("/api/users/add", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "الرجاء إدخال جميع الحقول" });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res
        .status(400)
        .json({ message: "البريد الإلكتروني مستخدم مسبقًا" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "viewer"
    });
    await newUser.save();

    res.status(201).json({
      message: "تم إنشاء المستخدم بنجاح",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "حدث خطأ أثناء إنشاء المستخدم" });
  }
});

// جلب جميع المستخدمين
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching users", error: error.message });
  }
});

// جلب بيانات مستخدم واحد بناءً على الـ ID
app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "المستخدم غير موجود" });
    }
    res.json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "خطأ في جلب بيانات المستخدم", error: error.message });
  }
});

// تعديل مستخدم
app.put("/api/users/:id", async (req, res) => {
  try {
    const updatedData = { ...req.body };
    if (updatedData.password)
      updatedData.password = await bcrypt.hash(updatedData.password, 10);
    const updated = await User.findByIdAndUpdate(req.params.id, updatedData, {
      new: true
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating user" });
  }
});

// حذف مستخدم
app.delete("/api/Delete/user/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting User" });
  }
});

// ================= السيارات =================

// جلب جميع السيارات
app.get("/api/cars", async (req, res) => {
  try {
    const cars = await Car.find();
    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء جلب السيارات", error });
  }
});

// إضافة سيارة وربطها بالتصنيف
app.post("/api/cars/add", async (req, res) => {
  try {
    const { brand, model, ...carData } = req.body;
    let foundCategory = await Category.findOne({ slug: brand, type: model });
    if (!foundCategory) {
      foundCategory = new Category({ slug: brand, type: model });
      await foundCategory.save();
    }

    const newCar = new Car({
      ...carData,
      brand,
      model,
      categorySlug: foundCategory.slug,
      categoryType: foundCategory.type
    });
    await newCar.save();
    res.status(201).json({ message: "Car added successfully", car: newCar });
  } catch (error) {
    res.status(500).json({ message: "Error adding car", error });
  }
});

// تعديل سيارة
app.put("/api/cars/:id", async (req, res) => {
  try {
    let { categorySlug, categoryType, ...carData } = req.body;
    categorySlug = categorySlug.trim();
    categoryType = categoryType.trim();

    let foundCategory = await Category.findOne({
      slug: categorySlug,
      type: categoryType
    });
    if (!foundCategory) {
      foundCategory = new Category({ slug: categorySlug, type: categoryType });
      await foundCategory.save();
    }

    const updatedCar = await Car.findByIdAndUpdate(
      req.params.id,
      {
        ...carData,
        categorySlug: foundCategory.slug,
        categoryType: foundCategory.type
      },
      { new: true, runValidators: true }
    );

    if (!updatedCar)
      return res.status(404).json({ message: "السيارة غير موجودة" });

    res
      .status(200)
      .json({ message: "تم تعديل السيارة بنجاح", car: updatedCar });
  } catch (err) {
    if (err.code === 11000)
      return res
        .status(409)
        .json({ message: "هذا الموديل موجود مسبقاً لنفس الشركة" });
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء تعديل السيارة", error: err.message });
  }
});

// حذف سيارة
app.delete("/api/Delete/cars/:id", async (req, res) => {
  try {
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: "Car deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting car" });
  }
});

// جلب سيارة واحدة
app.get("/api/cars/:id", async (req, res) => {
  const car = await Car.findById(req.params.id);
  res.json(car);
});

// جلب سيارات حسب التصنيف
app.get("/api/cars/category/:slug", async (req, res) => {
  try {
    const cars = await Car.find({ categorySlug: req.params.slug });
    if (!cars.length)
      return res.status(404).json({ message: "لا توجد سيارات لهذا التصنيف" });
    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: "حدث خطأ أثناء جلب السيارات", error });
  }
});

// جلب سيارات حسب التصنيف والنوع
app.get("/api/cars/category/:slug/:type", async (req, res) => {
  try {
    const slug = req.params.slug.trim();
    const type = decodeURIComponent(req.params.type).trim();
    const cars = await Car.find({ categorySlug: slug, categoryType: type });
    if (!cars.length)
      return res.status(404).json({ message: "لا توجد سيارات لهذا التصنيف" });
    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: "خطأ في السيرفر", error });
  }
});

// ================= التصنيفات =================

// جلب جميع التصنيفات
app.get("/api/categorys", async (req, res) => {
  try {
    const categories = await Category.find();
    res.status(200).json(categories);
  } catch (err) {
    res
      .status(500)
      .json({ message: "خطأ في جلب التصنيفات", error: err.message });
  }
});

// إضافة تصنيف
app.post("/api/categorys/add", async (req, res) => {
  try {
    const { slug, type, image } = req.body;
    if (!slug || !type || !image)
      return res
        .status(400)
        .json({ message: "الرجاء إدخال slug و type و رابط الصورة" });

    const category = await Category.create({ slug, type, image });
    res.status(201).json({ message: "تم إضافة التصنيف بنجاح", category });
  } catch (error) {
    if (error.code === 11000)
      return res.status(409).json({ message: "هذا التصنيف موجود مسبقاً" });
    res.status(500).json({ message: "حدث خطأ أثناء إضافة التصنيف", error });
  }
});

// حذف تصنيف
app.delete("/api/Delete/categorys/:id", async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory)
      return res.status(404).json({ message: "التصنيف غير موجود" });
    res
      .status(200)
      .json({ message: "تم حذف التصنيف بنجاح", category: deletedCategory });
  } catch (err) {
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء حذف التصنيف", error: err.message });
  }
});

// ================= Service Centers =================

// جلب جميع المراكز والمتاجر
app.get("/api/service-centers", async (req, res) => {
  try {
    const centers = await ServiceCenter.find();
    res.status(200).json(centers);
  } catch (error) {
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء جلب البيانات", error: error.message });
  }
});

// إضافة مركز أو متجر
app.post("/api/add/service-centers", async (req, res) => {
  try {
    const { name, phone, location, image, type } = req.body;
    if (!name || !phone || !location || !image || !type)
      return res
        .status(400)
        .json({ success: false, message: "جميع الحقول مطلوبة" });

    if (!["auto_repair", "auto_parts_store"].includes(type))
      return res
        .status(400)
        .json({ success: false, message: "نوع النشاط غير صالح" });

    const newCenter = await ServiceCenter.create({
      name,
      phone,
      location,
      image,
      type
    });
    res.status(201).json({
      success: true,
      message: "تم إضافة المركز / المتجر بنجاح",
      data: newCenter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء الإضافة",
      error: error.message
    });
  }
});

// حذف مركز أو متجر
app.delete("/api/delete/service-centers/:id", async (req, res) => {
  try {
    const deletedCenter = await ServiceCenter.findByIdAndDelete(req.params.id);
    if (!deletedCenter)
      return res
        .status(404)
        .json({ success: false, message: "المركز أو المتجر غير موجود" });
    res.status(200).json({
      success: true,
      message: "تم حذف البيانات بنجاح",
      data: deletedCenter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء الحذف",
      error: error.message
    });
  }
});

// تعديل مركز أو متجر
app.put("/api/service-centers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, type, location, image } = req.body;
  try {
    const updatedCenter = await ServiceCenter.findByIdAndUpdate(
      id,
      { name, phone, type, location, image },
      { new: true }
    );
    if (!updatedCenter)
      return res.status(404).json({ message: "المركز أو المتجر غير موجود" });
    res.status(200).json({ message: "تم التعديل بنجاح", data: updatedCenter });
  } catch (error) {
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء التعديل", error: error.message });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
