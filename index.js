const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "your_secret_key"; // 🔐 change this later

const ADMIN_DB = "admins.json";

function readAdmins() {
  if (!fs.existsSync(ADMIN_DB)) return [];
  return JSON.parse(fs.readFileSync(ADMIN_DB));
}

function writeAdmins(data) {
  fs.writeFileSync(ADMIN_DB, JSON.stringify(data, null, 2));
}
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
app.post("/add-product", verifyToken, upload.single("image"), (req, res) => {
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

app.post("/create-admin", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const admins = readAdmins();

  admins.push({
    id: Date.now(),
    username,
    password: hashedPassword
  });

  writeAdmins(admins);

  res.json({ message: "Admin created" });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const admins = readAdmins();
  const admin = admins.find(a => a.username === username);

  if (!admin) return res.status(401).json({ message: "Invalid user" });

  const match = await bcrypt.compare(password, admin.password);

  if (!match) return res.status(401).json({ message: "Wrong password" });

  // 🎟️ create token (expires in 1 hour)
  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token });
});

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) return res.status(403).json({ message: "No token" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token expired" });

    req.user = user;
    next();
  });
}