 

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

export default { loadProduct };