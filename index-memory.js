const express = require("express");
const multer = require("multer");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// store images
const storage = multer.memoryStorage();
const upload = multer({ storage });

// TEMP DATABASE (in memory)
let products = [];

// ADD PRODUCT
app.post("/add-product", upload.single("image"), (req, res) => {
  const data = req.body;

  const newProduct = {
    id: Date.now(),
    image: req.file ? req.file.buffer.toString("base64") : "",
    name: data.name,
    brand: data.brand,
    model: data.model,
    colorways: JSON.parse(data.colorways),
    soleplates: JSON.parse(data.soleplates),
    price: data.price
  };

  products.push(newProduct);
  res.json({ message: "Product added!" });
});

// GET PRODUCTS
app.get("/products", (req, res) => {
  res.json(products);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
