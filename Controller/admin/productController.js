import Product from '../../model/productModel.js' 
import Variant from '../../model/variantModel.js'; // Import this!
import Category from '../../model/categoryModel.js';

const loadProduct = async (req, res) => {
    try {
        // You might fetch data from DB here later, 
        // but for now, we pass an empty array to fix the error.
        
        res.render('admin/products', { 
            products: [],      // <--- You were missing this!
            currentPage: 1,    // Adding this to prevent pagination errors
            totalPages: 1      // Adding this to prevent pagination errors
        });

    } catch (error) {
        console.log(error.message);
        res.status(500).send("Server Error");
    }
}

 const addProduct = async (req, res) => {
    try {
        const { 
            name, 
            description, 
            price, 
            discountPrice, 
            ram: ram,         
            storage: storage, 
            color: color,
            processor,
            stock, 
            brand, 
            category,
            sku,
            graphics, 
           
            isPublished,
            specKeys,   // These come as arrays from the form
            specValues 
        } = req.body;

        // 1. Handle Images
        // Map over req.files to get just the filenames/paths
        // const images = req.files.map(file => file.filename); 
        const images = req.files ? req.files.map(file => file.filename) : [];

        // 2. Handle Specifications
        // We need to zip keys and values together: ['RAM', 'Color'] + ['16GB', 'Black'] 
        // Becomes: [{ key: 'RAM', value: '16GB'}, { key: 'Color', value: 'Black' }]
        let specifications = [];
        if (specKeys && specValues) {
            // Ensure they are arrays (if only 1 spec is added, it might be a string)
            const keys = Array.isArray(specKeys) ? specKeys : [specKeys];
            const values = Array.isArray(specValues) ? specValues : [specValues];

            specifications = keys.map((key, index) => ({
                key: key,
                value: values[index]
            })).filter(spec => spec.key !== ""); // Filter out empty rows
        }

        if (processor) {
            specifications.push({ key: "Processor", value: processor });
        }
        const newProduct = new Product({
            name,
            description,
            brand: brand,       // Maps to your Schema 'brandId'
            category: category, // Maps to your Schema 'categoryId'
            isPublished: isPublished === 'on',
            images: images,
            specifications: specifications
        });

        // 4. Save to Database
       const savedProduct = await newProduct.save();

       const newVariant = new Variant({
            productId: savedProduct._id,
            ram: ram,         
            storage: storage, 
            color: color || "Standard",
            price: price,
            stock: stock,
            sku: sku,
            graphics: graphics
        });

        await newVariant.save();
        // 5. Redirect back to products list
        res.redirect('/admin/products');

    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).send("Error adding product");
    }
};

export default { loadProduct, addProduct };