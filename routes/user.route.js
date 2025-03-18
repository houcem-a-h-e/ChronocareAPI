import express from "express";
import multer from "multer";
import path from "path";
import {
  deleteUser,
  getUser,
  updateUser,
  savePost,
  profilePosts,
  getNotificationNumber,
  updateUserProfile 
} from "../controllers/user.controller.js";
import {verifyToken} from "../middleware/verifyToken.js";

const router = express.Router();
// router.get("/search/:id", verifyToken, getUser);
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Save uploaded files to the "uploads" directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to ensure unique filenames
  },
});
const upload = multer({ storage });
router.put("/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);
router.post("/save", verifyToken, savePost);
router.get("/profilePosts", verifyToken, profilePosts);
router.get("/notification", verifyToken, getNotificationNumber);
// Modify your route to handle upload errors
router.patch(
  "/users/:id/profile",
  verifyToken,
  (req, res, next) => {
    upload.single("profilePicture")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ 
          message: "File upload failed",
          error: err.message 
        });
      }
      next();
    });
  },
  updateUserProfile
);

export default router;
