const express = require("express");
const { register, login, getMe, deleteAccount } = require("../controllers/authController");
const { forgotPassword, resetPassword } = require("../controllers/passwordController");
const protect = require("../middleware/auth");
const { getProfile, updateProfile, changePassword } = require("../controllers/profileController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, changePassword);
router.delete("/account", protect, deleteAccount);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;