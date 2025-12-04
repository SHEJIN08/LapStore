import Category from '../../model/categoryModel.js'
import Product from '../../model/productModel.js';
import Variant from '../../model/variantModel.js';
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";
// 1. GET: Load Categories with Pagination
const loadCategory = async (req, res) => {
    try {
        const search = req.query.search || '';
        const filter = req.query.status || 'all';

        const page = parseInt(req.query.page) || 1;
        const limit = 4; // Items per page
        const skip = (page - 1) * limit;

        let query = {};

        if(filter=== 'active'){
            query.isListed = true;
        }else if(filter === 'blocked'){
            query.isListed = false;
        }

        if(search){
            const searchRegex = new RegExp(search,'i')

            query.$or = [
                {categoryName: searchRegex}
            ]
        }


        // Fetch categories with pagination
        const categories = await Category.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Get total count for pagination buttons
        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        return res.render('admin/category', {
            categories: categories,
            currentSearch: search,
            currentFilter: filter,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });

    } catch (err) {
        console.error(err);
        res.status(StatusCode.INTERNAL_SERVER_ERROR).json({success: false, message: ResponseMessage.SERVER_ERROR});
    }
}

// 2. POST: Add New Category
const addCategory = async (req, res) => {
    try {
        const { categoryName, description, isListed, orders } = req.body;

        if (!categoryName) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.MISSING_FIELDS });
        }

        // Case-insensitive check for existing category
        const existingCategory = await Category.findOne({
            categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });

        if (existingCategory) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.DUP_CATEGORY });
        }

        const newCategory = new Category({
            categoryName,
            description,
            orders: Number(orders) || 0,
            isListed: isListed === 'true' || isListed === true, 
        });

        await newCategory.save();
        return res.status(StatusCode.CREATED).json({ success: true, message: ResponseMessage.CREATED });

    } catch (err) {
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
}

// 3. GET: Render Edit Page
const getEditCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findById(id);

        if (!category) {
            return res.redirect('/admin/category');
        }
//  Fetch Products in this Category
        const productDocs = await Product.find({ category: id }).sort({ createdAt: -1 });

        const products = await Promise.all(productDocs.map(async (product) => {
            const variants = await Variant.find({ productId: product._id });

            // Calculate "Starts At" Price (Lowest price among variants)
            const prices = variants.map(v => v.salePrice).filter(p => p !== undefined);
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0;

            // Calculate Total Stock (Sum of all variant stocks)
            const totalStock = variants.reduce((acc, curr) => acc + (curr.stock || 0), 0);

            return {
                _id: product._id,
                name: product.name,
                isPublished: product.isPublished,
                price: minPrice,    
                stock: totalStock   
            };
        }));

        // 4. Render
        res.render('admin/edit-category', { 
            category: category, 
            products: products 
        });

    } catch (error) {
        console.error("Error in getEditCategory:", error);
        res.redirect('/admin/category');
    }

};

// 4. PUT: Handle Edit Form Submission
const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description, isListed } = req.body;

        const category = await Category.findById(id);
        if (!category) {
           return res.status(StatusCode.NOT_FOUND).render('user/404');
        }
        // Check for duplicate name (excluding current category)
        const existingCategory = await Category.findOne({
            categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') },
            _id: { $ne: id } // Exclude current ID from check
        });

        if (existingCategory) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.DUP_CATEGORY });
        }

        category.categoryName = categoryName;
        category.description = description;
        // Convert string "true"/"false" to boolean
        category.isListed = isListed === 'true' || isListed === true;

        await category.save();

        // RETURN JSON INSTEAD OF REDIRECT
        return res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.CATEGORY_STATUS });

    } catch (error) {
        console.error(error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// 5. POST: Toggle Status (List/Unlist)
const getListOrUnlist = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findById(id);

        if (!category) {
            return res.status(StatusCode.NOT_FOUND).render('user/404');
        }

        // Toggle status
        category.isListed = !category.isListed;
        await category.save();

        const statusText = category.isListed ? 'Listed' : 'Unlisted';
        return res.status(StatusCode.OK).json({ success: true, message: `Category ${statusText} successfully` });

    } catch (error) {
        console.error(error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

export default { 
    loadCategory, 
    addCategory, 
    getEditCategory, 
    editCategory, 
    getListOrUnlist 
};