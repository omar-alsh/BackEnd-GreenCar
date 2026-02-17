// // import multer from "multer";
// // import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import Car from "./models/Car.js"; // ← استيراد الموديل الصحيح
import User from "./models/User.js";
import Category from "./models/category.js";
import ServiceCenter from "./models/serviceCenter.js"

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة البيانات
mongoose
  .connect("mongodb+srv://omar:omar123@cluster2.sarmqlh.mongodb.net/GreenCar")
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => console.error("Error:", err));

// اعدادات تسجيل الدخول

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1) البحث عن المستخدم
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "المستخدم غير موجود" });
    }

    // 2) مقارنة كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "كلمة المرور غير صحيحة" });
    }

    // 3) إنشاء توكن
    const token = jwt.sign({ id: user._id, role: user.role }, "MY_SECRET_KEY", {
      expiresIn: "1d"
    });

    // 4) إرجاع التوكن
    res.json({
      token,
      user: {
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: "خطأ في تسجيل الدخول" });
  }
});

// API لإضافة مستخدم جديد مع تشفير كلمة المرور
app.post("/api/users/add", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // التحقق من الحقول
    if (!name || !email || !password) {
      return res.status(400).json({ message: "الرجاء إدخال جميع الحقول" });
    }

    // التحقق من وجود المستخدم مسبقًا
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "البريد الإلكتروني مستخدم مسبقًا" });
    }

    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // إنشاء المستخدم
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

// API لجلب جميع السيارات
app.get("/api/cars", async (req, res) => {
  try {
    const cars = await Car.find(); // جميع السيارات
    res.status(200).json(cars);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب السيارات", error });
  }
});

// Api اضافة سيارة وربطه بالتصنيف
// Api اضافة سيارة وربطه بالتصنيف
app.post("/api/cars/add", async (req, res) => {
  try {
    const { brand, model, ...carData } = req.body;

    // التحقق من وجود التصنيف أو إنشاء جديد
    let foundCategory = await Category.findOne({ slug: brand, type: model });

    if (!foundCategory) {
      // إذا لم يكن موجودًا، قم بإنشائه
      foundCategory = new Category({ slug: brand, type: model });
      await foundCategory.save();
    }

    // إنشاء السيارة وربطها بالتصنيف
    const newCar = new Car({
      ...carData,
      brand: brand,
      model: model,
      categorySlug: foundCategory.slug,
      categoryType: foundCategory.type
    });

    await newCar.save();

    res.status(201).json({ message: "Car added successfully", car: newCar });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding car", error });
  }
});

// app.post("/api/cars/add", async (req, res) => {
//   try {
//     const { categorySlug, ...carData } = req.body;

//     // تحقق أن التصنيف موجود
//     const foundCategory = await Category.findOne({ slug: categorySlug });
//     if (!foundCategory) {
//       return res.status(400).json({ message: "التصنيف غير موجود" });
//     }

//     // إنشاء السيارة مع الـ categorySlug
//     const newCar = new Car({
//       ...carData,
//       categorySlug: foundCategory.slug
//     });

//     await newCar.save();
//     res.status(201).json({ message: "Car added successfully", car: newCar });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Error adding car", error });
//   }
// });

//API تعديل سيارة

app.get("/api/cars/:id", async (req, res) => {
  const car = await Car.findById(req.params.id);
  res.json(car);
});

app.put("/api/cars/:id", async (req, res) => {
  try {
    let { categorySlug, categoryType, ...carData } = req.body;

    // تنظيف القيم (اختياري لكن مستحسن)
    categorySlug = categorySlug.trim();
    categoryType = categoryType.trim();

    // البحث بالـ slug + type
    let foundCategory = await Category.findOne({
      slug: categorySlug,
      type: categoryType
    });

    // إن لم يوجد ➜ إنشاؤه
    if (!foundCategory) {
      foundCategory = new Category({
        slug: categorySlug,
        type: categoryType
      });
      await foundCategory.save();
    }

    // تحديث السيارة
    const updatedCar = await Car.findByIdAndUpdate(
      req.params.id,
      {
        ...carData,
        categorySlug: foundCategory.slug,
        categoryType: foundCategory.type
      },
      { new: true, runValidators: true }
    );

    if (!updatedCar) {
      return res.status(404).json({
        message: "السيارة غير موجودة"
      });
    }

    res.status(200).json({
      message: "تم تعديل السيارة بنجاح",
      car: updatedCar
    });
  } catch (err) {
    console.error(err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: "هذا الموديل موجود مسبقاً لنفس الشركة"
      });
    }

    res.status(500).json({
      message: "حدث خطأ أثناء تعديل السيارة",
      error: err.message
    });
  }
});

// app.get("/api/cars/:id", async (req, res) => {
//   const car = await Car.findById(req.params.id);
//   res.json(car);
// });

// app.put("/api/cars/:id", async (req, res) => {
//   try {
//     const updated = await Car.findByIdAndUpdate(req.params.id, req.body, {
//       new: true
//     });
//     res.json(updated);
//   } catch (err) {
//     res.status(500).json({ message: "Error updating car" });
//   }
// });

//API لحذف سيارة
app.delete("/api/Delete/cars/:id", async (req, res) => {
  try {
    await Car.findByIdAndDelete(req.params.id);
    res.json({ message: "Car deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting car" });
  }
});

// API المستخدمين
//API لجلب جميع المستخدمين
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

// API لتعديل المستخدمين
app.get("/api/users/:id", async (req, res) => {
  const car = await User.findById(req.params.id);
  res.json(car);
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const updatedData = { ...req.body };
    if (updatedData.password) {
      updatedData.password = await bcrypt.hash(updatedData.password, 10);
    }
    const updated = await User.findByIdAndUpdate(req.params.id, updatedData, {
      new: true
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Error updating user" });
  }
});

//API لحذف مستخدم
app.delete("/api/Delete/user/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting User" });
  }
});






// API التصنيف
// جلب الفئات
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

// Api يقوم بجلب جميع ال slug
app.get("/api/categories/slugs", async (req, res) => {
  try {
    const slugs = await Category.distinct("slug");

    if (slugs.length === 0) {
      return res.status(404).json({ message: "لا توجد تصنيفات" });
    }

    res.status(200).json(slugs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب التصنيفات", error });
  }
});

// جلب جميع الtype المرتبطة ب slug واحد
app.get("/api/categories/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    // البحث عن جميع التصنيفات التي لها هذا الـ slug
    const categories = await Category.find({ slug }).select("type image -_id");
    // select("type image -_id") يعني إرجاع الحقول type و image فقط بدون _id

    if (categories.length === 0) {
      return res.status(404).json({
        message: "لا توجد تصنيفات لهذا الـ slug"
      });
    }

    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "حدث خطأ أثناء جلب التصنيفات",
      error
    });
  }
});

// app.get("/api/categories/:slug", async (req, res) => {
//   try {
//     const { slug } = req.params;

//     // جلب كل الـ categories التي لها نفس الـ slug
//     const categories = await Category.find({ slug }, { type: 1, _id: 0 });

//     if (categories.length === 0) {
//       return res.status(404).json({ message: "لا توجد أنواع لهذا التصنيف" });
//     }

//     // تحويلها إلى Array للـ types فقط
//     const types = categories.map((cat) => cat.type);

//     res.status(200).json(types);
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "حدث خطأ أثناء جلب الأنواع", error });
//   }
// });

// Api اضافة تصنيف جديد

app.post("/api/categorys/add", async (req, res) => {
  try {
    const { slug, type, image } = req.body;

    if (!slug || !type || !image) {
      return res.status(400).json({
        message: "الرجاء إدخال slug و type و رابط الصورة"
      });
    }

    const category = await Category.create({
      slug,
      type,
      image // رابط Cloudinary
    });

    res.status(201).json({
      message: "تم إضافة التصنيف بنجاح",
      category
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "هذا التصنيف موجود مسبقاً"
      });
    }

    console.error(error);
    res.status(500).json({
      message: "حدث خطأ أثناء إضافة التصنيف",
      error
    });
  }
});
// app.post("/api/categorys/add", async (req, res) => {
//   try {
//     const { slug, type } = req.body;

//     // التحقق من الحقول المطلوبة
//     if (!slug || !type) {
//       return res.status(400).json({ message: "حقول slug و type مطلوبة" });
//     }

//     // (اختياري) تنسيق القيم
//     const formattedSlug = slug.trim();
//     const formattedType = type.trim();

//     // التحقق من عدم تكرار type فقط (لأنه unique في الـ schema)
//     const existingCategory = await Category.findOne({ type: formattedType });
//     if (existingCategory) {
//       return res.status(409).json({ message: "هذا النوع موجود بالفعل" });
//     }

//     // إنشاء التصنيف
//     const newCategory = new Category({
//       slug: formattedSlug,
//       type: formattedType
//     });

//     await newCategory.save();

//     res.status(201).json({
//       message: "تم إضافة التصنيف بنجاح",
//       category: newCategory
//     });
//   } catch (err) {
//     console.error(err);

//     // التعامل مع خطأ التكرار من MongoDB
//     if (err.code === 11000) {
//       return res.status(409).json({ message: "قيمة مكررة غير مسموح بها" });
//     }

//     res.status(500).json({
//       message: "حدث خطأ أثناء إضافة التصنيف",
//       error: err.message
//     });
//   }
// });

// Api حذف التصنيف
app.delete("/api/Delete/categorys/:id", async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory) {
      return res.status(404).json({ message: "التصنيف غير موجود" });
    }
    res
      .status(200)
      .json({ message: "تم حذف التصنيف بنجاح", category: deletedCategory });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "حدث خطأ أثناء حذف التصنيف", error: err.message });
  }
});

// جلب جميع السيارات حسب تصنيف معين (slug)

app.get("/api/cars/category/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // جلب كل السيارات التي لها هذا الـ categorySlug مباشرة
    const cars = await Car.find({ categorySlug: slug });

    if (cars.length === 0) {
      return res.status(404).json({ message: "لا توجد سيارات لهذا التصنيف" });
    }

    res.status(200).json(cars);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "حدث خطأ أثناء جلب السيارات", error });
  }
});

// Api لتصنيف السيارات حسب ماركة السيارة و فئتها
app.get("/api/cars/category/:slug/:type", async (req, res) => {
  try {
    // const { slug, type } = req.params;
    const slug = req.params.slug.trim();
    const type = decodeURIComponent(req.params.type).trim();

    const cars = await Car.find({
      categorySlug: slug,
      categoryType: type
    });

    if (!cars.length) {
      return res.status(404).json({ message: "لا توجد سيارات لهذا التصنيف" });
    }

    res.status(200).json(cars);
  } catch (error) {
    res.status(500).json({ message: "خطأ في السيرفر", error });
  }
});


// Api جلب جميع بيانات ال ServiceCenter

app.get("/api/service-centers", async (req, res) => {
  try {
    const centers = await ServiceCenter.find();

    res.status(200).json(centers);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "حدث خطأ أثناء جلب البيانات",
      error: error.message
    });
  }
});

// Api لجلب جميع مراكز الصيانة
app.get("/api/service-centers/auto-repair-centers", async (req, res) => {
  try {
    const repairCenters = await ServiceCenter.find({ type: "auto_repair" });

    res.status(200).json({
      success: true,
      count: repairCenters.length,
      data: repairCenters
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Api لجلب جميع متاجر قطع السيارات
app.get("/api/service-centers/auto-parts-stores", async (req, res) => {
  try {
    const stores = await ServiceCenter.find({ type: "auto_parts_store" });

    res.status(200).json({
      success: true,
      count: stores.length,
      data: stores
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Api اضافة مركز او متجر جديد
app.post("/api/add/service-centers", async (req, res) => {
  try {
    const { name, phone, location, image, type } = req.body;

    // التحقق من البيانات المطلوبة
    if (!name || !phone || !location || !image || !type) {
      return res.status(400).json({
        success: false,
        message: "جميع الحقول مطلوبة"
      });
    }

    // التحقق من نوع النشاط
    if (!["auto_repair", "auto_parts_store"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "نوع النشاط غير صالح"
      });
    }

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
    console.error(error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء الإضافة",
      error: error.message
    });
  }
});


// Api حذف متجر او مركز 
app.delete("/api/delete/service-centers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const deletedCenter = await ServiceCenter.findByIdAndDelete(id);

    if (!deletedCenter) {
      return res.status(404).json({
        success: false,
        message: "المركز أو المتجر غير موجود"
      });
    }

    res.status(200).json({
      success: true,
      message: "تم حذف البيانات بنجاح",
      data: deletedCenter
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "حدث خطأ أثناء الحذف",
      error: error.message
    });
  }
});






// تعديل مركز أو متجر حسب الـ _id
// جلب مركز أو متجر واحد عن طريق الـ ID
app.get("/api/service-centers/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const center = await ServiceCenter.findById(id);

    if (!center) {
      return res.status(404).json({ message: "المركز أو المتجر غير موجود" });
    }

    res.status(200).json(center);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "حدث خطأ أثناء جلب بيانات المركز",
      error: error.message
    });
  }
});

app.put("/api/service-centers/:id", async (req, res) => {
  const { id } = req.params;
  const { name, phone, type, location, image } = req.body;

  try {
    // إيجاد المركز وتحديث البيانات
    const updatedCenter = await ServiceCenter.findByIdAndUpdate(
      id,
      { name, phone, type, location, image },
      { new: true } // لإرجاع النسخة المحدثة
    );

    if (!updatedCenter) {
      return res.status(404).json({ message: "المركز أو المتجر غير موجود" });
    }

    res.status(200).json({ message: "تم التعديل بنجاح", data: updatedCenter });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "حدث خطأ أثناء التعديل", error: error.message });
  }
});









// تشغيل السيرفر
app.listen(5000, () => console.log("Server running on port 5000"));
