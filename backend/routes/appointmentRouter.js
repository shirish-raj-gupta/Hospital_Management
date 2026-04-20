import express from "express";
import {clerkMiddleware , requireAuth} from "@clerk/express";
import {getAppointments , confirmPayment , getStats ,createAppointment , getAppointmentsByPatient, getAppointmentsByDoctor , updateAppointment, cancelAppointment , getRegisteredCount} from "../controllers/appointmentController.js";


const appointmentRouter = express.Router();

appointmentRouter.get("/", getAppointments);
appointmentRouter.get("/confirm", confirmPayment);
appointmentRouter.get("/stats/summary", getStats);

//authentic routes
appointmentRouter.post("/", clerkMiddleware(),requireAuth(), createAppointment);
appointmentRouter.get("/me", clerkMiddleware(),requireAuth(), getAppointmentsByPatient);

appointmentRouter.get("/doctor/:doctorId",  getAppointmentsByDoctor);
appointmentRouter.get("/:id/cancel", cancelAppointment);
appointmentRouter.get("/patients/count", getRegisteredCount);
appointmentRouter.get("/:id",updateAppointment);

export default appointmentRouter;