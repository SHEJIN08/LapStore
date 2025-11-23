import Category from '../../model/categoryModel.js'

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
        res.status(500).send('Server Error');
    }
}

// 2. POST: Add New Category
const addCategory = async (req, res) => {
    try {
        const { categoryName, description, isListed, orders } = req.body;

        if (!categoryName) {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        // Case-insensitive check for existing category
        const existingCategory = await Category.findOne({
            categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') }
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const newCategory = new Category({
            categoryName,
            description,
            orders: Number(orders) || 0,
            isListed: isListed === 'true' || isListed === true, // Handle string 'true' from forms
        });

        await newCategory.save();
        return res.status(201).json({ success: true, message: 'New Category added successfully' });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
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

        res.render('admin/edit-category', { category });
    } catch (error) {
        console.error(error);
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
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Check for duplicate name (excluding current category)
        const existingCategory = await Category.findOne({
            categoryName: { $regex: new RegExp(`^${categoryName}$`, 'i') },
            _id: { $ne: id } // Exclude current ID from check
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'Category name already exists' });
        }

        category.categoryName = categoryName;
        category.description = description;
        // Convert string "true"/"false" to boolean
        category.isListed = isListed === 'true' || isListed === true;

        await category.save();

        // RETURN JSON INSTEAD OF REDIRECT
        return res.status(200).json({ success: true, message: 'Category updated successfully' });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// 5. POST: Toggle Status (List/Unlist)
const getListOrUnlist = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Toggle status
        category.isListed = !category.isListed;
        await category.save();

        const statusText = category.isListed ? 'Listed' : 'Unlisted';
        return res.status(200).json({ success: true, message: `Category ${statusText} successfully` });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
};

export default { 
    loadCategory, 
    addCategory, 
    getEditCategory, 
    editCategory, 
    getListOrUnlist 
};