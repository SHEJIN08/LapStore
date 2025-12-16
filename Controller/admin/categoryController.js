import categoryService from "../../services/admin/categoryService.js";
import { StatusCode, ResponseMessage } from "../../utils/statusCode.js";

// --- LOAD CATEGORIES ---
const loadCategory = async (req, res) => {
    try {
        const search = req.query.search || '';
        const filter = req.query.status || 'all';
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        // Call Service
        const { categories, totalCategories, totalPages } = await categoryService.getAllCategoriesService({ 
            search, filter, page, limit 
        });

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
};

// --- ADD CATEGORY ---
const addCategory = async (req, res) => {
    try {
        const { categoryName, description, isListed, count } = req.body;

        if (!categoryName) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.MISSING_FIELDS });
        }

        // Call Service
        await categoryService.createCategoryService({ categoryName, description, isListed, count });

        return res.status(StatusCode.CREATED).json({ success: true, message: ResponseMessage.CREATED });

    } catch (err) {
        if (err.message === ResponseMessage.DUP_CATEGORY) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.DUP_CATEGORY });
        }
        console.error(err);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- GET EDIT PAGE ---
const getEditCategory = async (req, res) => {
    try {
        const id = req.params.id;

        // Call Service (Gets Category + Product Stats)
        const { category, products } = await categoryService.getCategoryWithProductsService(id);

        res.render('admin/edit-category', { 
            category: category, 
            products: products 
        });

    } catch (error) {
        console.error("Error in getEditCategory:", error);
        if (error.message === "Category not found") {
             return res.render('user/404');
        }
        res.redirect('/admin/category');
    }
};

// --- EDIT CATEGORY (PUT) ---
const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description, isListed } = req.body;

        await categoryService.updateCategoryService(id, { categoryName, description, isListed });

        return res.status(StatusCode.OK).json({ success: true, message: ResponseMessage.CATEGORY_STATUS });

    } catch (error) {
        if (error.message === ResponseMessage.DUP_CATEGORY) {
            return res.status(StatusCode.BAD_REQUEST).json({ success: false, message: ResponseMessage.DUP_CATEGORY });
        }
        if (error.message === "Category not found") {
            return res.status(StatusCode.NOT_FOUND).render('user/404');
        }
        console.error(error);
        return res.status(StatusCode.INTERNAL_SERVER_ERROR).json({ success: false, message: ResponseMessage.SERVER_ERROR });
    }
};

// --- TOGGLE STATUS ---
const getListOrUnlist = async (req, res) => {
    try {
        const id = req.params.id;
        
        const category = await categoryService.toggleCategoryStatusService(id);

        const statusText = category.isListed ? 'Listed' : 'Unlisted';
        return res.status(StatusCode.OK).json({ success: true, message: `Category ${statusText} successfully` });

    } catch (error) {
        if (error.message === "Category not found") {
            return res.status(StatusCode.NOT_FOUND).render('user/404');
        }
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