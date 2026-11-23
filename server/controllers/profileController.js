const bcrypt = require("bcryptjs");
const User = require("../models/User");

const CLASS_LEVELS = ["11", "12", "dropper"];

// What the profile page shows (never the password)
const profileOf = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone || "",
  classLevel: u.classLevel || "",
  targetYear: u.targetYear || null,
  college: u.college || "",
  section: u.section || "",
  streak: u.streak || { current: 0, longest: 0 },
  createdAt: u.createdAt,
});

// GET /api/auth/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user: profileOf(user) });
  } catch (error) {
    console.error("getProfile error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};

// PUT /api/auth/profile   body: { name, phone, classLevel, targetYear }
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { name, phone, classLevel, targetYear, college, section } = req.body;

    if (name !== undefined) {
      const clean = String(name).trim();
      if (clean.length < 2 || clean.length > 60) return res.status(400).json({ message: "Name must be 2 to 60 characters" });
      user.name = clean;
    }
    if (phone !== undefined) {
      const digits = String(phone).replace(/[\s-]/g, "");
      if (digits && !/^(\+91)?[6-9]\d{9}$/.test(digits)) return res.status(400).json({ message: "Enter a valid 10-digit mobile number" });
      user.phone = digits;
    }
    if (classLevel !== undefined) {
      if (classLevel && !CLASS_LEVELS.includes(classLevel)) return res.status(400).json({ message: "Class must be 11, 12 or dropper" });
      user.classLevel = classLevel || undefined;
    }
    if (targetYear !== undefined) {
      const year = Number(targetYear);
      const now = new Date().getFullYear();
      if (targetYear && (!Number.isInteger(year) || year < now || year > now + 4)) return res.status(400).json({ message: "Choose a valid target year" });
      user.targetYear = targetYear ? year : undefined;
    }

    if (college !== undefined) {
      const clean = String(college).trim();
      if (!clean) return res.status(400).json({ message: "Enter your college name" });
      if (clean.length > 120) return res.status(400).json({ message: "The college name is too long" });
      user.college = clean;
    }
    // Sections are only for MB PU
    if (section !== undefined || college !== undefined) {
      const isMB = String(user.college || "").trim().toLowerCase() === "mb pu";
      const sec = String(section || "").toUpperCase();
      if (isMB && !["A", "B", "C", "D"].includes(sec)) return res.status(400).json({ message: "Choose your section (A, B, C or D)" });
      user.section = isMB ? sec : undefined;
    }

    await user.save();
    res.json({ message: "Profile saved", user: profileOf(user) });
  } catch (error) {
    console.error("updateProfile error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};

// PUT /api/auth/password   body: { currentPassword, newPassword }
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Fill in both passwords" });
    if (String(newPassword).length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });

    const user = await User.findById(req.user._id || req.user.id).select("+passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(400).json({ message: "Your current password is not correct" });
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return res.status(400).json({ message: "The new password must be different from the old one" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password changed" });
  } catch (error) {
    console.error("changePassword error:", error.message);
    res.status(500).json({ message: "Something went wrong on the server" });
  }
};

module.exports = { getProfile, updateProfile, changePassword };