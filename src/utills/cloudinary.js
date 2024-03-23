import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

          
cloudinary.config({ 
  cloud_name: 'CLOUDINARY_CLOUD_NAME', 
  api_key: 'CLOUDINARY_CLOUD_KEY', 
  api_secret: 'CLOUDINARY_CLOUD_SECRET' 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath)  return null
        //upload the file to cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type:"auto"
        })
        //file has been uploadedsuccessfull
        console.log("File is uploaded on cloudinary",response.url);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation got failed

        return null;
    } 
}

export {uploadOnCloudinary}



cloudinary.uploader.upload("https://upload.wikimedia.org/wikipedia/commons/a/ae/Olympic_flag.jpg",
  { public_id: "olympic_flag" }, 
  function(error, result) {console.log(result); });