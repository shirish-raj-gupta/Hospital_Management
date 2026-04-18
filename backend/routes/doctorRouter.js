import express from "express";
import multer from "multer";
import { getDoctors, getDoctorById, createDoctor, updateDoctor, deleteDoctor, loginDoctor, toggleAvailability } from "../controllers/doctorController.js";
import doctorAuth from "../middleware/doctorAuth.js";

const upload = multer ({dest: "/tmp"});
const doctorRouter = express.Router();

doctorRouter.get("/", getDoctors);
doctorRouter.get("/login", loginDoctor);
doctorRouter.get("/:id", getDoctorById);
doctorRouter.post("/", upload.single("image"), createDoctor);
doctorRouter.put("/:id", doctorAuth, upload.single("image"), updateDoctor);
doctorRouter.delete("/:id",deleteDoctor);


export default doctorRouter;