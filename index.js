const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// storage for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// fake database (JSON file)
const DB_FILE = "products.json";

function readDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ADD PRODUCT
app.post("/add-product", upload.single("image"), (req, res) => {
  const data = req.body;

  const newProduct = {
    id: Date.now(),
    image: req.file ? req.file.filename : "",
    brand: data.brand,
    model: data.model,
    name: data.name,
    colorways: JSON.parse(data.colorways),
    soleplates: JSON.parse(data.soleplates),
    price: data.price,
  };

  const products = readDB();
  products.push(newProduct);
  writeDB(products);

  res.json({ message: "Product added!" });
});

// GET PRODUCTS
app.get("/products", (req, res) => {
  res.json(readDB());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});