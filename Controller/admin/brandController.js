import Brand from '../../model/brandModel.js'

// 1. GET: Load the Brands Table Page
const getBrandPage = async (req, res) => {
    try {
        const search = req.query.search || '';
        const status = req.query.status || 'all';

        // Pagination logic
        const page = Number.parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        let query = {};

        if(status === 'active'){
            query.isBlocked = false;
        } else if(status === 'blocked'){
            query.isBlocked = true;
        }
        
        if(search) {
            const searchRegex = new RegExp(search,'i')

            query.$or = [
                {brandName: searchRegex}
            ]
        }
        // Fetch brands from DB
        const brandData = await Brand.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Count total for pagination
        const totalBrands = await Brand.countDocuments();
        const totalPages = Math.ceil(totalBrands / limit);
    
        res.render('admin/brand', {
            data: brandData,
            currentSearch: search,
            currentStatus: status,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: 'Something went wrong'});
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
           return res.status(400).json({success: false, message: 'Please upload a brand logo'});
        }
        const image = req.file.url; //path contains full url of cloudinary

        // Check if brand already exists (Case insensitive)
        const findBrand = await Brand.findOne({ brandName: { $regex: new RegExp("^" + brandName + "$", "i") }});
        
        if (findBrand) {
           return res.status(400).json({success: false, message: 'Brand already exist'});
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
       return res.status(200).json({success: true, message: 'New brand added successfully'});

    } catch (err) {
        console.error(err);
       return res.status(500).json({success: false, message: 'Something went wrong'});
    }
};

const BlockOrUnblock = async (req, res) => {
    try {
        const id = req.params.brandId;
        const brand = await Brand.findById(id);
        if(!brand){
            return res.status(400).json({success: false, message: "Brand not found"});
        }
        brand.isBlocked = !brand.isBlocked;
        await brand.save();
        return res.status(200).json({success: true, message: 'Brand status changed'})
    } catch (err) {
        console.error(err);
        return res.status(500).json({success: false, message: 'Something went wrong'});
    }
};

// Render the Edit Page with existing data
const getEditBrand = async (req, res) => {
    try {
        // 1. Get the ID from the URL (based on your logs, it is 'brandId')
        const brandId = req.params.brandId;
        
        // 2. Find the brand
        const brand = await Brand.findById(brandId);

        // 3. CHECK FIRST: If brand doesn't exist, redirect and STOP.
        if (!brand) {
            return res.redirect('/admin/brands'); // 'return' is crucial here!
        }

        // 4. Render ONLY if the brand exists (and hasn't redirected)
        res.render('admin/edit-brand', { brand:brand });

    } catch (error) {
        console.error("Error in getEditBrand:", error);
        // If ID format is invalid, redirect back to list
        return res.redirect('/admin/brands'); 
    }
};

//  Handle the Update
const editBrand = async (req, res) => {
    try {
        const id = req.params.brandId;
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
        await brand.save();
        return res.status(200).json({success: true, message: 'Brand updated successfully'});

    } catch (err) {
        console.error(err);
          return res.status(500).json({success: false, message: 'Something went wrong'});
    }
};

export default {getBrandPage, getAddBrandPage, addBrand, BlockOrUnblock, getEditBrand, editBrand};

