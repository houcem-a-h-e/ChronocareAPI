import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoute from "./routes/auth.route.js";
import userRoute from "./routes/user.route.js";

const app = express();
let port = process.env.PORT || 4000
const allowedOrigins = ["https://chronocareapp.netlify.app"];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
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