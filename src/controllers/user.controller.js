import { asyncHandler } from "../utills/asynchandler.js";
import {ApiError} from "../utills/ApiError.js"
import {User} from "../models/user.modle.js"
import {uploadOnCloudinary} from "../utills/cloudinary.js"
import { ApiResponse } from "../utills/ApiResponse.js";
import { Jwt } from "jsonwebtoken";
import mongoose, { mongo } from "mongoose";

const generateAccessAndRefereshToken  = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong While generating referesh and access token")
    }
}

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
    // console.log("email: ",email);
    // console.log("fullname: ",fullname);
    // console.log("username: ",username);

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
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0)
    {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar File is Required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar)
    {
        throw new ApiError(400,"Avatar File is Required")
    }

    const user = await User.create({
        fullname,
        avatar:avatar.url,
        coverImage: coverImage?.url || "",
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

const loginUser = asyncHandler(async (req,res) => {
    //req body ->data
    //1)take username or user_email from user
    //2)check in data_base isthat user exist in data_base
    //3)take passwpoord from user
    //4)if exist then check the username and password are matched or not?
    //5)access and refresh Token 
    //send cookie

    const {username,email,password} = req.body

    if(!(username || email))
    {
        throw new ApiError(400,"username or email are required")
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user)
    {
        throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid)
    {
        throw new ApiError(401,"Invalid user credential")
    } 
    
    const {accessToken,refreshToken} = await generateAccessAndRefereshToken(user._id)

    //decide karo ki firse data base ko call krna expensive hai ya object mein store krna hi thik rahega decide karo
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken",accessToken,options).cookie("refreshToken",refreshToken,options).json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,
                refreshToken
            },
            "User logged In SuccessFully"
        )
    )
})

const logoutUser = asyncHandler(async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true,
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

const refereshAccessToken = asyncHandler(async (req, res) =>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "unauthorized request")
    }

   try {
     const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
     )
 
     const user = await User.findById(decodedToken?._id)
 
     if(!user)
     {
         throw new ApiError(401,"Invalid refresh token")
     }
 
     if(incomingRefreshToken!== user?.refreshToken){
         throw new ApiError(401,"Refresh token is expired or used")
     }
 
     const options = {
         httpOnly: true,
         secure: ture
     }
 
     const {accessToken,newrRefreshToken} = await generateAccessAndRefereshToken(user._id)
 
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newRefreshToken,options)
     .json(
         new ApiResponse(
             200,
             {
                 accessToken,refreshToken: newrRefreshToken
             },
             "Access Token refreshed"
         )
     )
   } catch (error) {
        throw new ApiError(401,error?.message || 
    "Invalid refresh token")
   }
})


const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword,newPassword} = req.body

    const user = await User.findById(req?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password Changed Successfully"))
})

const getCurrentUser = asyncHandler(async(req,res) => {
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res) => {
    const {fullname,email} = req.body

    if(!(fullname || email)){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account deatils updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res) => {
    const avatarLocalPath = req.file?.path

    //TODO: delete old avatar from cloudinary (Using Utility)
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading Avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar Updated Successfully"))
})

const updateCoverImage = asyncHandler(async (req,res) => {
    const coverImageLocalPath = req.file?.path

    //TODO: delete old avatar from cloudinary (Using Utility)
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"coverImage Updated Successfully"))
})

const getUserChannelProfile = asyncHandler(async (req,res) => {
    const username = req.params

    if(!username?.trim()){
        throw new ApiError(400,"Username is Missing")
    }

    //User.find({username})    
    const channel = await User.aggregate([{
        $match: {
            username: username?.toLowerCase()
        }
    },
    {
        $lookup: {
            from: "subscriptions",
            localField:"_id",
            foreignField:"channel",
            as:"subscribers"
        }
    },
    {
        $lookup:{
            from: "subscriptions",
            localField:"_id",
            foreignField:"subscriber",
            as:"subscribedTo"
        }
    },
    {
        $addFields: {
            subscribersCount: {
                $size: "$subscribers"
            },
            channelsSubscribedToCount: {
                $size : "$subscribedTo"
            },
            isSubscribed: {
                $cond: {
                    if: {$in: [req.user?._id,"$subscribers.subscriber"]},
                    then: true,
                    else: false
                }
            }
        }
    },
    {
        $project: {
            fullname: 1,
            username: 1,
            subscribersCount: 1,
            channelsSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
        }
    }
    ])

    if(!channel?.length){
        throw new ApiError(404,"channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User Channel Fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from :"videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "._id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"Watch history fetched Successfully")
    )
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refereshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    getUserChannelProfile,
    getWatchHistory
 }