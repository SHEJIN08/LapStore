import mongoose from 'mongoose';
import slugify from 'slugify';

const categorySchema = new mongoose.Schema({
  categoryName: { type: String, required: true, unique: true },
  slug: { type: String, unique: true, index: true},
  description: { type: String},
  orders: { type: Number, default: 0 },
  isListed: { type: Boolean, default: true },
  showInNav: {type: Boolean, default: true},
 isFeatured: {type: Boolean, default: true}
}, { timestamps: true });

categorySchema.pre('save', function(next) {
    // Only run this if the 'name' field was actually modified
    if (this.isModified('categoryName')) {
        this.slug = slugify(this.categoryName, {
            lower: true,  // convert to lower case
            strict: true ,
            trim: true 
        });
    }
    next();
});

// This ensures that if you update directly, the slug updates too.
categorySchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  
  // Check if categoryName is being updated
  if (update.categoryName) {
    update.slug = slugify(update.categoryName, {
      lower: true,
      strict: true,
      trim: true
    });
  }
  next();
});

export default mongoose.model('Category', categorySchema);