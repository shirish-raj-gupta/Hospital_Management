import jwt from "jsonwebtoken";
import Doctor from "../models/doctor.js";

const JWT_SECRET = process.env.JWT_SECRET;

export default async function doctorAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authorization header missing or malformed" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.id) {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }
    const doctor = await Doctor.findById(payload.id).select("-password");
    if (!doctor) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }
    req.doctor = doctor;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}