import express from "express";
import { registerPersonnnelDeSante, logout,getUsersforAdmin, registerPatient,login,registerAdmin,updateUserActivation
 } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/registerPatient", registerPatient);
router.post("/registerAdmin", registerAdmin);
router.post("/registerPersonnnelDeSante", registerPersonnnelDeSante);
router.put("/updateUserActivation/:email",updateUserActivation)
router.post("/login", login);
router.post("/logout", logout);
router.get("/espaceAdmin", getUsersforAdmin)
export default router;
