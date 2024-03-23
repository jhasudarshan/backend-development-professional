import { asyncHandler } from "../utills/asynchandler.js";

const registerUser = asyncHandler( async (req,res) => {
    res.status(200).json({
        message: "Ok"
    })
} )


export { registerUser }