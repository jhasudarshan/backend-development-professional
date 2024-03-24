import { asyncHandler } from "../utills/asynchandler.js";
import {ApiError} from "../utills/ApiError.js"
import {User} from "../models/user.modle.js"
import {uploadOnCloudinary} from "../utills/cloudinary.js"
import { ApiResponse } from "../utills/ApiResponse.js";

const registerUser = asyncHandler( async (req,res) => {
    /////User Register Steps:
    //1)get user details from frontend
    //2)Validation -> not Empty
    //3)check if user already exists: username, email
    //4)check for images , check for avatar
    //5)upload them to cloudinary, avatar
    //6)create user object - create entry in db
    //7) remove password and refresh token field from response
    //8) check for user creation
    //9) return res


    const  {fullname,email,username,password} = req.body
    console.log("email: ",email);
    console.log("fullname: ",fullname);
    console.log("username: ",username);

    // if(fullname === ""){
    //     throw new ApiError(400,"fullname is required")
    // }

    if(
        [fullname,email,username,password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400,"All fields are required")
    }

    const existedUser =await User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser)
    {
        throw new ApiError(409,"User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar File is Required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar)
    {
        throw new ApiError(400,"Avatar File is Required")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage: coverImage.url,
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went Wrong registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )
} )


export { registerUser }