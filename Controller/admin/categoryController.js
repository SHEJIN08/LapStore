import Category from '../../model/categoryModel.js'

const loadCategory = async (req,res) => {
    try {
        const categories = await Category.find().sort({createdAt: -1})

        const message = req.session.message || ""
        const type = req.session.type || ""
        req.session.message = null;
        req.session.type = null;
        return res.render('admin/category',{
            categories: categories,
            message,
            type
         })
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
   
}

const addCategory = async (req, res) => {
    try {
        const { categoryName, description, isListed, showInNav, orders, isFeatured } = req.body;

    
        if (!categoryName) {
            req.session.message = 'Category name is required';
            req.session.type = 'error';
            return res.redirect('/admin/category');
        }

        const existingCategory = await Category.findOne({ 
            categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
        });
        
        if (existingCategory) {
            req.session.message = 'Category already exists';
            req.session.type = 'error';
            return res.redirect('/admin/category');
        }

        // 2. Create Category
        const newCategory = new Category({
            categoryName,
            description,
            orders: Number(orders) || 0,
            // HTML Select sends "true"/"false" strings -> convert to Boolean
            isListed: isListed === 'true', 
            // HTML Checkbox: sends "true" if checked, undefined if unchecked
            showInNav: showInNav === 'true',
            isFeatured: isFeatured === 'true'
        });

        await newCategory.save();

        req.session.message = 'New Category Added successfully';
        req.session.type = 'success';
        res.redirect('/admin/category');

    } catch (err) {
        console.error(err);
        req.session.message = "Something went wrong";
        req.session.type = "error";
        res.redirect('/admin/category');
    }
}
export default {loadCategory, addCategory};