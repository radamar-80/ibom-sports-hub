const express = require("express");
const { diskStorage, MulterError } = require("multer");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "your_secret_key";
const ADMIN_DB = "admins.json";
const DB_FILE = "products.json";
const REVIEWS_FILE = "reviews.json";
const TICKETS_FILE = "tickets.json";
const CATEGORIES_FILE = "categories.json";
const UPLOAD_DIR = "uploads";

function readCategories() {
  if (!fs.existsSync(CATEGORIES_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(CATEGORIES_FILE)); } catch(e) { return []; }
}
function writeCategories(data) {
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2));
}

function readReviews() {
  if (!fs.existsSync(REVIEWS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(REVIEWS_FILE)); } catch(e) { return []; }
}
function writeReviews(data) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(data, null, 2));
}

function readTickets() {
  if (!fs.existsSync(TICKETS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TICKETS_FILE)); } catch(e) { return []; }
}
function writeTickets(data) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function readAdmins() {
  if (!fs.existsSync(ADMIN_DB)) return [];
  return JSON.parse(fs.readFileSync(ADMIN_DB));
}

function writeAdmins(data) {
  fs.writeFileSync(ADMIN_DB, JSON.stringify(data, null, 2));
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use(express.static("."));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
app.use("/uploads", express.static(UPLOAD_DIR));

// Serve static frontend assets (HTML, images, etc.) from project root
app.use(express.static(__dirname, { extensions: ["html"] }));

// storage for images
const storage = diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR + "/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

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

// ADD PRODUCT
app.post("/add-product", verifyToken, upload.single("image"), (req, res) => {
  const data = req.body;

  const newProduct = {
    id: Date.now(),
    image: req.file ? req.file.filename : "",
    brand: data.brand,
    model: data.model,
    name: data.name,
    colorways: data.colorways ? JSON.parse(data.colorways) : [],
    soleplates: data.soleplates ? JSON.parse(data.soleplates) : [],
    price: data.price,
    categoryId: data.categoryId || "",
    subcategoryId: data.subcategoryId || "",
    sectionId: data.sectionId || "",
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

// GET CATEGORIES (public)
app.get("/categories", (req, res) => {
  res.json(readCategories());
});

// UPDATE CATEGORIES (admin only)
app.put("/categories", verifyToken, (req, res) => {
  writeCategories(req.body);
  res.json({ message: "Categories updated" });
});

// GET REVIEWS
app.get("/reviews", (req, res) => {
  res.json(readReviews());
});

// SUBMIT REVIEW
app.post("/submit-review", express.json({ limit: "10mb" }), (req, res) => {
  const { rating, text, name, photo } = req.body;
  const reviews = readReviews();
  reviews.push({
    id: Date.now(),
    rating: parseInt(rating) || 0,
    text: text || "",
    name: name || "",
    photo: photo || "",
    timestamp: new Date().toISOString()
  });
  writeReviews(reviews);
  res.json({ message: "Review submitted!" });
});

// ── TICKETS ──

// Create ticket (customer, no auth)
app.post("/tickets", (req, res) => {
  const { name, issue } = req.body;
  if (!name || !issue) return res.status(400).json({ message: "Name and issue required" });
  const ticket = {
    id: Date.now().toString(),
    name: name.trim(),
    issue: issue.trim(),
    status: "open",
    createdAt: new Date().toISOString(),
    messages: []
  };
  const tickets = readTickets();
  tickets.push(ticket);
  writeTickets(tickets);
  res.json(ticket);
});

// Get all tickets (admin)
app.get("/tickets", verifyToken, (req, res) => {
  res.json(readTickets());
});

// Get single ticket (by ID, no auth — customer uses their ID)
app.get("/tickets/:id", (req, res) => {
  const ticket = readTickets().find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  res.json(ticket);
});

// Send message on a ticket (customer or admin)
app.post("/tickets/:id/messages", (req, res) => {
  const { from, text } = req.body;
  if (!text || !from) return res.status(400).json({ message: "Missing fields" });
  const tickets = readTickets();
  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  if (ticket.status === "closed") return res.status(400).json({ message: "Ticket is closed" });
  ticket.messages.push({ from, text: text.trim(), timestamp: new Date().toISOString() });
  writeTickets(tickets);
  res.json(ticket);
});

// Update ticket status (admin)
app.put("/tickets/:id/status", verifyToken, (req, res) => {
  const { status } = req.body;
  const tickets = readTickets();
  const ticket = tickets.find(t => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ message: "Ticket not found" });
  ticket.status = status;
  writeTickets(tickets);
  res.json(ticket);
});

// CREATE ADMIN
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

// LOGIN
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const admins = readAdmins();
  const admin = admins.find(a => a.username === username);

  if (!admin) return res.status(401).json({ message: "Invalid user" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ message: "Wrong password" });

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});