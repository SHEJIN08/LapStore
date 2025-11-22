import Category from '../../model/categoryModel.js'


const loadCategory = async (req,res) => {
    try {
        const categories = await Category.find().sort({createdAt: -1})

      
        return res.render('admin/category',{
            categories: categories,
         })
    } catch (err) {
        console.error(err);
        res.status(500).json({success: false, message: 'Something went wrong'});
    }
   
}

const addCategory = async (req, res) => {
    try {
        const { categoryName, description, isListed, showInNav, orders, isFeatured } = req.body;

    
        if (!categoryName) {
          return res.status(400).json({success: false, message: 'Category name is required'})
        }

        const existingCategory = await Category.findOne({ 
            categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
        });
        
        if (existingCategory) {
             return res.status(400).json({success: false, message: 'Category already exist'})
        }

        // 2. Create Category
        const newCategory = new Category({
            categoryName,
            description,
            orders: Number(orders) || 0,
            isListed: isListed,
            showInNav: showInNav ,
            isFeatured: isFeatured 
        });

        await newCategory.save();
        return res.status(201).json({success: true, message: 'New Category added successfully'})

    } catch (err) {
        console.log(err)
        return res.status(500).json({success: false, message: 'Something went wrong'});
}
}
export default {loadCategory, addCategory}