import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import dotenv from "dotenv";
import Stripe from "stripe";
import { getAuth, clerkClient } from "@clerk/express";

dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    })
  : null;

const FRONTEND_URL = process.env.FRONTEND_URL;
const MAJOR_ADMIN_ID = process.env.MAJOR_ADMIN_ID;

//HELPER FUNCTIONS
//IT WILL RETURN A FINITE NUMBER
const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

//THIS FN WILL CREATE FRONTEND URL
const buildFrontendBase = (req) => {
  if (FRONTEND_URL) return FRONTEND_URL.replace(/\/$/, "");
  const origin = req.get("origin") || req.get("referer");
  if (origin) return origin.replace(/\/$/, "");
  const host = req.get("host");
  if (host) return `${req.protocol || "http"}://${host}`.replace(/\/$/, "");
  return null;
};

//THIS FN WILL GET THE USER FROM THE CLERK AND RETURN THE USER DETAILS
function resolveClerkUserId(req) {
  try {
    const auth = req.auth || {};
    const fromReq =
      auth?.userId || auth?.user_id || auth?.user?.id || req.user?.id || null;
    if (fromReq) return fromReq;
    try {
      const serverAuth = getAuth ? getAuth(req) : null;
      return serverAuth?.userId || null;
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

//TO GET APPOINTMENTS OF A USER
export const getAppointments = async (req, res) => {
  try {
    const {
      doctorId,
      mobile,
      status,
      search = "",
      limit: limitRaw = 50,
      page: pageRaw = 1,
      patientClerkId,
      createdBy,
    } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (doctorId) filter.doctorId = doctorId;
    if (mobile) filter.mobile = mobile;
    if (status) filter.status = status;
    if (patientClerkId) filter.createdBy = patientClerkId;
    if (createdBy) filter.createdBy = createdBy;
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { notes: re }];
    }
    const items = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("doctorId", "name speacialization owner imageurl image");
    const total = await Appointment.countDocuments(filter);
    return res.json({
      success: true,
      appointsments: items,
      meta: { total, page, limit, count: items.length },
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch appointments", error: error.message });
  }
};

//to get appontsmenmts by patient
export const getAppointmentsByPatient = async (req, res) => {
  try {
    const queryCreatedBy = req.query.createdBy || null;
    const clerkUserId = req.auth.userId || null;
    const resolvedCreatedBy = queryCreatedBy || clerkUserId || null;
    console.log("Resolved createdBy:", resolvedCreatedBy);

    if (!resolvedCreatedBy) {
      return res.status(401).json({ message: "autehntication error" });
    }

    const filter = {};
    if (resolvedCreatedBy) filter.createdBy = resolvedCreatedBy;
    if (req.query.mobile) filter.mobile = req.query.mobile;
    const appointments = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .lean();
    return res.json({ success: true, appointments });
  } catch (error) {
    console.error("Error fetching appointments by patient:", error);
    return res.status(500).json({
      message: "Failed to fetch appointments by patient",
      error: error.message,
    });
  }
};

//to create an appointment
export const createAppointment = async (req, res) => {
  try {
    //create
    const {
      doctorId,
      patientName,
      mobile,
      age = "",
      gender = "",
      date,
      time,
      fee,
      fees,
      notes = "",
      email,
      paymentMethod,
      owner: ownerFromBody = null,
      doctorName: doctorNameFromBody,
      speciality: specialityFromBody,
      doctorImageUrl: doctorImageUrlFromBody,
      doctorImagePublicId: doctorImagePublicIdFromBody,
    } = req.body || {};
    const clerkUserId = resolveClerkUserId(req);
    if (!clerkUserId) {
      return res.status(401).json({ message: "Authentication is required" });
    }
    if (!doctorId || !patientName || !mobile || !date || !time) {
      return res.status(400).json({
        message: "doctorId, patientName, mobile, date and time are required",
      });
    }
    const numericFee = safeNumber(fee ?? fees);
    if (numericFee === null) {
      return res.status(400).json({ message: "fee must be a finite number" });
    }
    //duplicate booking prevention
    const existingBooking = await Appointment.findOne({
      doctorId,
      createdBy: clerkUserId,
      date: String(date),
      time: String(time),
      status: { $ne: "cancelled" },
    }).lean();
    if (existingBooking) {
      return res.status(409).json({
        message:
          "You already have an appointment booked with this doctor at the same date and time.",
      });
    }
    let doctor = null;
    try {
      doctor = await Doctor.findById(doctorId).lean();
    } catch (error) {
      console.error("Error fetching doctor:", error);
      return res
        .status(500)
        .json({ message: "Failed to fetch doctor", error: error.message });
    }
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }
    // Resolve owner, names, images, etc.
    let resolvedOwner = ownerFromBody || doctor.owner || null;
    if (!resolvedOwner) resolvedOwner = MAJOR_ADMIN_ID || String(doctorId);

    const doctorName =
      (doctor.name && String(doctor.name).trim()) ||
      (doctorNameFromBody && String(doctorNameFromBody).trim()) ||
      "";
    const speciality =
      (doctor.specialization && String(doctor.specialization).trim()) ||
      (doctor.speciality && String(doctor.speciality).trim()) ||
      (specialityFromBody && String(specialityFromBody).trim()) ||
      "";

    const doctorImageUrl =
      (doctor.imageUrl && String(doctor.imageUrl).trim()) ||
      (doctor.image && String(doctor.image).trim()) ||
      (doctor.avatarUrl && String(doctor.avatarUrl).trim()) ||
      (doctor.profileImage &&
        doctor.profileImage.url &&
        String(doctor.profileImage.url).trim()) ||
      (doctorImageUrlFromBody && String(doctorImageUrlFromBody).trim()) ||
      "";

    const doctorImagePublicId =
      (doctor.imagePublicId && String(doctor.imagePublicId).trim()) ||
      (doctor.profileImage &&
        doctor.profileImage.publicId &&
        String(doctor.profileImage.publicId).trim()) ||
      (doctorImagePublicIdFromBody &&
        String(doctorImagePublicIdFromBody).trim()) ||
      "";

    const doctorImage = { url: doctorImageUrl, publicId: doctorImagePublicId };

    const base = {
      doctorId: String(doctor._id || doctorId),
      doctorName,
      speciality,
      doctorImage,
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: age ? Number(age) : undefined,
      gender: gender ? String(gender) : "",
      date: String(date),
      time: String(time),
      fees: numericFee,
      status: "Pending",
      payment: {
        method: paymentMethod === "Cash" ? "Cash" : "Online",
        status: "Pending",
        amount: numericFee,
      },
      notes: notes || "",
      createdBy: clerkUserId,
      owner: resolvedOwner,
      sessionId: null,
    };

    // Free appointment
    if (numericFee === 0) {
      const created = await Appointment.create({
        ...base,
        status: "Confirmed",
        payment: { method: base.payment.method, status: "Paid", amount: 0 },
        paidAt: new Date(),
      });
      return res
        .status(201)
        .json({ success: true, appointment: created, checkoutUrl: null });
    }

    // Cash payment
    if (paymentMethod === "Cash") {
      const created = await Appointment.create({
        ...base,
        status: "Pending",
        payment: { method: "Cash", status: "Pending", amount: numericFee },
      });
      return res
        .status(201)
        .json({ success: true, appointment: created, checkoutUrl: null });
    }

    // Online: Stripe
    if (!stripe)
      return res
        .status(500)
        .json({ success: false, message: "Stripe not configured on server" });

    const frontBase = buildFrontendBase(req);
    if (!frontBase) {
      return res.status(500).json({
        success: false,
        message:
          "Frontend URL could not be determined. Set FRONTEND_URL or send Origin header.",
      });
    }

    const successUrl = `${frontBase}/appointment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${frontBase}/appointment/cancel`;

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        customer_email: email || undefined,
        line_items: [
          {
            price_data: {
              currency: "inr",
              product_data: {
                name: `Appointment - ${String(patientName).slice(0, 40)}`,
              },
              unit_amount: Math.round(numericFee * 100),
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          doctorId: String(doctorId),
          doctorName: doctorName || "",
          speciality: speciality || "",
          patientName: base.patientName,
          mobile: base.mobile,
          clerkUserId: clerkUserId || "",
        },
      });
    } catch (stripeErr) {
      console.error("Stripe create session error:", stripeErr);
      const message =
        stripeErr?.raw?.message || stripeErr?.message || "Stripe error";
      return res.status(502).json({
        success: false,
        message: `Payment provider error: ${message}`,
      });
    }

    try {
      const created = await Appointment.create({
        ...base,
        sessionId: session.id,
        payment: {
          ...base.payment,
          providerId: session.payment_intent || session.paymentIntent || null,
        },
        status: "Pending",
      });
      return res.status(201).json({
        success: true,
        appointment: created,
        checkoutUrl: session.url || null,
      });
    } catch (dbErr) {
      console.error("DB error saving appointment after stripe session:", dbErr);
      return res.status(500).json({
        success: false,
        message: "Failed to create appointment record",
      });
    }
  } catch (err) {
    console.error("createAppointment unexpected:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

//CONFIRM PAYMENT
export const confirmPayment = async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) {
      return res
        .status(400)
        .json({ success: false, message: "session_id is required" });
    }
    if (!stripe) {
      return res
        .status(500)
        .json({ success: false, message: "Stripe not configured on server" });
    }
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id);
    } catch (err) {
      console.error("confirmPayment unexpected:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }
    if (session.payment_status !== "paid") {
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed" });
    }
    // confirmPayment
    // Try match by sessionId first
    let appt = await Appointment.findOneAndUpdate(
      { sessionId: session_id },
      {
        "payment.status": "Paid",
        "payment.providerId":
          session.payment_intent || session.payment_intent_id || null,
        status: "Confirmed",
        paidAt: new Date(),
      },
      { new: true },
    );

    // fallback: try match via metadata (doctorId + mobile + patientName)
    if (!appt) {
      const meta = session.metadata || {};
      if (meta.doctorId && meta.mobile && meta.patientName) {
        appt = await Appointment.findOneAndUpdate(
          {
            doctorId: meta.doctorId,
            mobile: meta.mobile,
            patientName: meta.patientName,
            fees: Math.round((session.amount_total || 0) / 100) || undefined,
          },
          {
            "payment.status": "Paid",
            "payment.providerId": session.payment_intent || null,
            status: "Confirmed",
            paidAt: new Date(),
            sessionId: session_id,
          },
          { new: true },
        );
      }
    }

    // last attempt: find appointment created in last 15 minutes with matching amount
    if (!appt) {
      const amount = Math.round((session.amount_total || 0) / 100);
      const fifteenAgo = new Date(Date.now() - 1000 * 60 * 15);
      appt = await Appointment.findOneAndUpdate(
        { fees: amount, createdAt: { $gte: fifteenAgo } },
        {
          "payment.status": "Paid",
          "payment.providerId": session.payment_intent || null,
          status: "Confirmed",
          paidAt: new Date(),
          sessionId: session_id,
        },
        { new: true },
      );
    }

    if (!appt) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this payment session",
      });
    }
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("confirmPayment unexpected:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

//to udpate an appointment
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const appt = await Appointment.findById(id);
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    //updateAppointment
    const terminal = appt.status === "Completed" || appt.status === "Canceled";
    if (terminal && body.status && body.status !== appt.status) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot change status of a completed/canceled appointment",
        });
    }

    const update = {};
    if (body.status) update.status = body.status;
    if (body.notes !== undefined) update.notes = body.notes;

    if (body.date && body.time) {
      if (appt.status === "Completed" || appt.status === "Canceled") {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot reschedule completed/canceled appointment",
          });
      }
      update.date = body.date;
      update.time = body.time;
      update.status = "Rescheduled";
      update.rescheduledTo = { date: body.date, time: body.time };
    }
    const updated = await Appointment.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .populate({ path: "doctorId", select: "name imageurl" })
      .lean();
    return res.json({ success: true, appointment: updated });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return res
      .status(500)
      .json({ message: "Failed to update appointment", error: error.message });
  }
};

//to cancel an appointment
export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appt = await Appointment.findById(id);
    if (!appt) {
      return res.status(404).json({ message: "Appointment not found" });
    }
    appt.status = "Canceled";
    await appt.save();
    return res.json({
      success: true,
      message: "Appointment canceled successfully",
      appointment: appt,
    });
  } catch (error) {
    console.error("Error canceling appointment:", error);
    return res
      .status(500)
      .json({ message: "Failed to cancel appointment", error: error.message });
  }
};

//to get stats
export const getStats = async (req, res) => {
  try {
    const total = await Appointment.countDocuments();
    const paidAgg = await Appointment.aggregate([
      { $match: { "payment.status": "Paid" } },
      { $group: { _id: null, total: { $sum: "$fees" } } },
    ]);
    const revenue = (paidAgg[0] && paidAgg[0].total) || 0;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent = await Appointment.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });
    return res.json({ success: true, stats: { total, revenue, recent } });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return res
      .status(500)
      .json({ message: "Failed to fetch stats", error: error.message });
  }
};

//to get appoints by doctor
export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!doctorId) {
      return res.status(400).json({ message: "doctorId is required" });
    }
    const {
      mobile,
      status,
      search = "",
      limit: limitRaw = 50,
      page: pageRaw = 1,
    } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = { doctorId };
    if (mobile) filter.mobile = mobile;
    if (status) filter.status = status;
    if (search) {
      const re = new RegExp(search, "i");
      filter.$or = [{ patientName: re }, { mobile: re }, { notes: re }];
    }
    const items = await Appointment.find(filter)
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(limit)
      .populate("doctorId", "name speacialization owner imageurl image")
      .lean();
    const total = await Appointment.countDocuments(filter);
    return res.json({
      success: true,
      appointsments: items,
      meta: { total, page, limit, count: items.length },
    });
  } catch (error) {
    console.error("Error fetching appointments by doctor:", error);
    return res
      .status(500)
      .json({
        message: "Failed to fetch appointments by doctor",
        error: error.message,
      });
  }
};

//to get register COUNT
export const getRegisteredCount = async (req, res) => {
  try {
    const totalUsers = await clerkClient.users.getUserCount();
    return res.json({ success: true, count: totalUsers });
  } catch (error) {
    console.error("Error fetching registered count:", error);
    return res
      .status(500)
      .json({
        message: "Failed to fetch registered count",
        error: error.message,
      });
  }
};
