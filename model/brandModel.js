import { required } from "joi";
import mongoose from "mongoose";

const brandschema = new mongoose.Schema({
    brandName: {type: String, require: true},
    description: {type: String, required: true},
    foundedYear: {type: Number, required: true},
    website: {type: String, required: true},
    country: {type: String, required: true},
},
{timestamps:true}
)
export default mongoose.model('Brand',brandschema)