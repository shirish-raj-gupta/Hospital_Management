import Doctor from "../models/doctor.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

//helper functions 

// to convert time string to minutes for sorting the schedule slots
const parseTimeToMinutes = (t = "") => {
  const [time = "0:00", ampm = ""] = (t || "").split(" ");
  const [hh = 0, mm = 0] = time.split(":").map(Number);
  let h = hh % 12;
  if ((ampm || "").toUpperCase() === "PM") h += 12;
  return h * 60 + (mm || 0);
};


//this fn removes duplicate time slots and sorts them in ascending order for each date in the schedule by time
function dedupeAndSortSchedule(schedule = {}) {
  const out = {};
  Object.entries(schedule).forEach(([date, slots]) => {
    if (!Array.isArray(slots)) return;
    const uniq = Array.from(new Set(slots));
    uniq.sort((a, b) => parseTimeToMinutes(a) - parseTimeToMinutes(b));
    out[date] = uniq;
  });
  return out;
}

//this function accept the object or stringified version of schedule and returns the deduped and sorted schedule object
function parseScheduleInput(s) {
  if (!s) return {};
  if (typeof s === "string") {
    try {
      s = JSON.parse(s);
    } catch {
      return {};
    }
  }
  return dedupeAndSortSchedule(s || {});
}


//this function normalizes the doctor document by converting the Mongoose Map to a plain object and ensuring that all expected fields are present with default values if they are missing.
function normalizeDocForClient(raw = {}) {
  const doc = { ...raw };

  // convert Mongoose Map to plain object
  if (doc.schedule && typeof doc.schedule.forEach === "function") {
    const obj = {};
    doc.schedule.forEach((val, key) => {
      obj[key] = Array.isArray(val) ? val : [];
    });
    doc.schedule = obj;
  } else if (!doc.schedule || typeof doc.schedule !== "object") {
    doc.schedule = {};
  }

  doc.availability = doc.availability === undefined ? "Available" : doc.availability;
  doc.patients = doc.patients ?? "";
  doc.rating = doc.rating ?? 0;
  doc.fee = doc.fee ?? doc.fees ?? 0;

  return doc;
}

//to create a doctor 
export async function createDoctor(req, res) {
  try {
    const body = req.body || {};
    if(!body.email || !body.password || !body.name){
      return res.status(400).json({ message: "Name, email and password are required" });
    }
    const emailLC = (body.email || "" ).toLowerCase();
    if(await Doctor.findOne({ email: emailLC })){
      return res.status(409).json({ message: "Doctor with this email already exists" });
    }

    let imageUrl = null, imagePublicId = null;
    let imageId = body.imagePublicId || null;
    if(req.file?.path){
      const upload = await uploadToCloudinary(req.file.path, "Doctors");
      const imageUrl = uploaded.secure_url || uploaded?.url || null;
      const imagePublicId = uploaded?.public_id || uploaded?.publicId || imagePublicId || null;
    }
    const schedule = parseScheduleInput(body.schedule);
    // createDoctor
    const doc = new Doctor({
      email: emailLC,
      password: body.password,
      name: body.name,
      specialization: body.specialization || "",
      imageUrl,
      imagePublicId,
      availability: body.availability || "Available",
      experience: body.experience || "",
      qualifications: body.qualifications || "",
      location: body.location || "",
      about: body.about || "",
      fee: body.fee !== undefined ? Number(body.fee) : 0,
      schedule,
      success: body.success || "",
      patients: body.patients || "",
      rating: body.rating !== undefined ? Number(body.rating) : 0,
    });

    await doc.save();
    const secret = process.env.JWT_SECRET;
    if(!secret){
      console.warn("JWT_SECRET is not set in environment variables. Token generation will fail.");
      return res.status(500).json({ message: "Internal server error" });
    }

    const token = jwt.sign({id: doc._id.toString(), email: doc.email, role:"doctor"}, secret,{expiresIn: "7d"});
    const out = normalizeDocForClient(doc.toObject());
    delete out.password;
    return res.status(201).json({ data: out, token });
  }catch(error){
      console.error("Error creating doctor:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }