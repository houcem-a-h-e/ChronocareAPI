import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoute from "./routes/auth.route.js";
import userRoute from "./routes/user.route.js";

const app = express();
let port = process.env.PORT || 8800
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json()); // Keep this for non-file routes
app.use(express.urlencoded({ extended: true })); // Add for form data
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api", userRoute);

app.use("/uploads", express.static("uploads"));
app.listen(port, () => {
  console.log("Server is running!");
});
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: err.message
  });
});