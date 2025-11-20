import Brand from '../../model/brandModel.js'

// 1. GET: Load the Brands Table Page
const getBrandPage = async (req, res) => {
    try {
        // Pagination logic
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        // Fetch brands from DB
        const brandData = await Brand.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Count total for pagination
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
        
        const message = req.session.message || ""
        const type = req.session.type || ""
        req.session.message = null
        req.session.type = null

        res.render('admin/brand', {
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
            message,type
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// 2. GET: Load the "Add Brand" Form
const getAddBrandPage = (req, res) => {
    res.render('admin/add-brand');
};

// 3. POST: Handle the Form Submission
const addBrand = async (req, res) => {
    try {
        const { brandName, country, foundedYear, website, description } = req.body;
        if(!req.file){
            req.session.message = 'Please upload a brand logo';
            req.session.type =  'error'
            return res.render('admin/add-brand')
        }
        const image = req.file.url; //path contains full url of cloudinary

        // Check if brand already exists (Case insensitive)
        const findBrand = await Brand.findOne({ brandName: { $regex: new RegExp("^" + brandName + "$", "i") }});
        
        if (findBrand) {
            req.session.message = 'Brand already exists';
            req.sessiontype='error' 
            return res.render('admin/add-brand');
        }

        const newBrand = new Brand({
            brandName,
            brandImage: [image], // Saving as an array
            country,
            foundedYear,
            website,
            description
        });

        await newBrand.save();
        req.session.message = 'New Brand Added successfully';
        req.session.type = 'success';
        res.redirect('/admin/brands');

    } catch (error) {
        console.error(error);
        res.status(500).send("Server Error");
    }
};

// 4. GET: Block/Unblock Brand (Optional Extra)
const blockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } });
        res.redirect('/admin/brands');
    } catch (error) {
        console.error(error);
    }
};

const unBlockBrand = async (req, res) => {
    try {
        const id = req.query.id;
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect('/admin/brands');
    } catch (error) {
        console.error(error);
    }
};
// Render the Edit Page with existing data
const getEditBrand = async (req, res) => {
    try {
        const id = req.query.id;
        const brand = await Brand.findById(id);
        
        if (!brand) {
            return res.redirect('/admin/brands');
        }

        res.render('admin/edit-brand', { brand: brand });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageerror');
    }
};

//  Handle the Update
const editBrand = async (req, res) => {
    try {
        const id = req.query.id;
        const { brandName, country, foundedYear, website, description } = req.body;
        
        // Find the existing brand first
        const brand = await Brand.findById(id);

        if (!brand) {
            return res.status(404).send('Brand not found');
        }

        // Update text fields
        brand.brandName = brandName;
        brand.country = country;
        brand.foundedYear = foundedYear;
        brand.website = website;
        brand.description = description;

        // Handle Image: If a new file is uploaded, replace the old one
        if (req.file) {
            brand.brandImage = [req.file.url];
        }
      req.session.message = 'Brand edited successfully';
      req.session.type = 'success';

        await brand.save();

        res.redirect('/admin/brands');

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

export default {getBrandPage, getAddBrandPage, addBrand, blockBrand, unBlockBrand, getEditBrand, editBrand};

