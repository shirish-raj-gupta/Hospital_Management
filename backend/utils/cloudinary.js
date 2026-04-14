import {v2 as cloudinary} from "cloudinary";
import fs  from "fs";

//configuring cloudinary

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// to upload image to cloudinary

export async function uploadToCloudinary(filePath, folder = "Doctor") {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type:"image"
    });
    //remove the local file after upload
    fs.unlinkSync(filePath);
    return result;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
}


// to delete an image that is present in cloudinary if user removes from ui
export async function deleteFromCloudinary(publicId){
  try{
    if(!publicId) return;
    await cloudinary.uploader.destroy(publicId);
  }
  catch(error){
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
}