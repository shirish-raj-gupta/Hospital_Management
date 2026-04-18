import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = "uploads";
if(!fs.existsSync(uploadDir)){
  fs.mkdirSync(uploadDir);
}//ensure uploads folder


//multer setup
const storage = multer.storage.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename:function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
})

//filefilter
const filefilter = function (req, file, cb) {
  if(
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/webp"
  ){
    cb(null, true);
  } else {
    cb(new Error("Only .jpg, .jpeg, .png, .webp files are allowed"), false);
  }
}

//  multer configure
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, //5MB limit
  fileFilter: filefilter
});

export default upload;