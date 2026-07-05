const express = require("express");
const { diskStorage, MulterError } = require("multer");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const OpenAI = require("openai");

const SECRET = process.env.JWT_SECRET || "your_secret_key";
const ADMIN_DB = "admins.json";
const DB_FILE = "products.json";
const REVIEWS_FILE = "reviews.json";
const TICKETS_FILE = "tickets.json";
const CATEGORIES_FILE = "categories.json";
const AI_CHATS_FILE = "ai-chats.json";
const UPLOAD_DIR = "uploads";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Two-number call routing: company line during business hours, a worker's
// personal line overnight. Numbers are placeholders until real ones are
// supplied — update via COMPANY_PHONE_DAY / COMPANY_PHONE_NIGHT env vars.
const COMPANY_PHONE_DAY = process.env.COMPANY_PHONE_DAY || "+2348001234567";
const COMPANY_PHONE_NIGHT = process.env.COMPANY_PHONE_NIGHT || "+2348007654321";

function getActiveCallNumber() {
  const lagosHour = parseInt(
    new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(new Date()),
    10
  );
  const isDay = lagosHour >= 8 && lagosHour < 20; // 8:00am - 7:59pm
  return { number: isDay ? COMPANY_PHONE_DAY : COMPANY_PHONE_NIGHT, period: isDay ? "day" : "night" };
}

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

function readAiChats() {
  if (!fs.existsSync(AI_CHATS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(AI_CHATS_FILE)); } catch (e) { return []; }
}
function writeAiChats(data) {
  fs.writeFileSync(AI_CHATS_FILE, JSON.stringify(data, null, 2));
}

const STOPWORDS = new Set(["the","a","an","is","are","was","were","how","what","when","where","why",
  "do","does","did","i","you","my","your","to","of","for","in","on","and","or","with","can","it","this",
  "that","have","has","please","hi","hello","help","need","about","me","us"]);

function tokenize(text) {
  return (text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

function keywordSet(text) {
  return new Set(tokenize(text).filter(w => w.length > 2 && !STOPWORDS.has(w)));
}

// Builds a Q&A "answer pool" by analysing closed/answered tickets: the customer's
// original issue paired with the first admin reply. Used to surface relevant past
// support answers to the AI Assistant chatbot for similar future questions.
function buildTicketAnswerPool() {
  const tickets = readTickets();
  const pool = [];
  for (const t of tickets) {
    const firstAdminMsg = (t.messages || []).find(m => m.from === "admin");
    if (t.issue && firstAdminMsg && firstAdminMsg.text) {
      pool.push({ question: t.issue, answer: firstAdminMsg.text });
    }
  }
  return pool;
}

// Finds the most relevant prior support answers for a given user message using
// simple keyword overlap (no external NLP dependency needed for this dataset size).
function findRelevantAnswers(message, limit) {
  const pool = buildTicketAnswerPool();
  if (pool.length === 0) return [];
  const queryWords = keywordSet(message);
  if (queryWords.size === 0) return [];

  const scored = pool.map(entry => {
    const entryWords = keywordSet(entry.question);
    let overlap = 0;
    for (const w of queryWords) if (entryWords.has(w)) overlap++;
    return { ...entry, score: overlap };
  }).filter(e => e.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit || 3);
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
    stock: data.stock !== undefined ? parseInt(data.stock) : null,
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

// GET ACTIVE CALL NUMBER (company line 8am-8pm, worker's line overnight)
app.get("/call-number", (req, res) => {
  res.json(getActiveCallNumber());
});

// DELETE PRODUCT
app.delete("/products/:id", verifyToken, (req, res) => {
  const id = parseInt(req.params.id);
  const products = readDB();
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ message: "Product not found" });
  const [removed] = products.splice(index, 1);
  // remove old image file if it exists
  if (removed.image) {
    const imgPath = path.join(UPLOAD_DIR, removed.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }
  writeDB(products);
  res.json({ message: "Product deleted" });
});

// EDIT PRODUCT (text fields; image optional)
app.put("/products/:id", verifyToken, upload.single("image"), (req, res) => {
  const id = parseInt(req.params.id);
  const products = readDB();
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  const d = req.body;
  product.brand        = d.brand        ?? product.brand;
  product.model        = d.model        ?? product.model;
  product.name         = d.name         ?? product.name;
  product.price        = d.price        ?? product.price;
  product.categoryId   = d.categoryId   ?? product.categoryId;
  product.subcategoryId= d.subcategoryId?? product.subcategoryId;
  product.sectionId    = d.sectionId    ?? product.sectionId;
  product.colorways    = d.colorways    ? JSON.parse(d.colorways)   : product.colorways;
  product.soleplates   = d.soleplates   ? JSON.parse(d.soleplates)  : product.soleplates;
  if (d.stock !== undefined) product.stock = parseInt(d.stock);
  if (req.file) {
    // remove old image
    if (product.image) {
      const old = path.join(UPLOAD_DIR, product.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    product.image = req.file.filename;
  }
  writeDB(products);
  res.json({ message: "Product updated", product });
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

// ── AI ASSISTANT CHATBOT ──

// Create a new AI chat session
app.post("/ai-chat/sessions", (req, res) => {
  const chats = readAiChats();
  const session = {
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    messages: []
  };
  chats.push(session);
  writeAiChats(chats);
  res.json(session);
});

// Get an existing AI chat session
app.get("/ai-chat/sessions/:id", (req, res) => {
  const session = readAiChats().find(s => s.id === req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });
  res.json(session);
});

// Send a message to the AI Assistant (text + optional image attachment)
app.post("/ai-chat/sessions/:id/messages", upload.single("attachment"), async (req, res) => {
  try {
    if (!openai) {
      return res.status(503).json({ message: "AI Assistant is not configured. Please contact support." });
    }

    const chats = readAiChats();
    const session = chats.find(s => s.id === req.params.id);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const text = (req.body.text || "").trim().slice(0, 500);
    const attachment = req.file ? req.file.filename : null;
    if (!text && !attachment) {
      return res.status(400).json({ message: "Message or attachment required" });
    }

    const userMsg = {
      from: "user",
      text,
      attachment,
      timestamp: new Date().toISOString()
    };
    session.messages.push(userMsg);

    // Build product catalog summary so the AI can recommend items on the site
    const products = readDB();
    const catalogSummary = products.slice(0, 60).map(p =>
      `${p.brand || ""} ${p.name || p.model || ""} - ₦${p.price || "N/A"}${p.stock === 0 ? " (out of stock)" : ""}`
    ).join("; ");

    // Pull relevant past support answers (analysed from direct tickets)
    const relevant = findRelevantAnswers(text, 3);
    const relevantText = relevant.length
      ? relevant.map(r => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n")
      : "None found.";

    const systemPrompt = `You are "AI Assistant", the friendly support & shopping helper for Ibom Sports Hub, an online store selling football boots, jerseys, and gear.
Your job: answer customer questions and recommend products available on this site.
Keep every reply to about 200 characters or fewer — be brief, direct, and fast to read.
If unsure or the request needs a human, suggest opening a Direct Ticket.
Available products (sample): ${catalogSummary || "catalog currently empty"}.
Relevant answers our support team has given to similar past questions:
${relevantText}`;

    const historyMessages = session.messages.slice(-10).filter(m => m.text).map(m => ({
      role: m.from === "assistant" ? "assistant" : "user",
      content: m.text
    }));

    const userContent = [];
    if (text) userContent.push({ type: "text", text });
    if (attachment) {
      const imgPath = path.join(UPLOAD_DIR, attachment);
      const imgBuffer = fs.readFileSync(imgPath);
      const ext = path.extname(attachment).slice(1) || "jpeg";
      const base64 = imgBuffer.toString("base64");
      userContent.push({ type: "image_url", image_url: { url: `data:image/${ext};base64,${base64}` } });
    }

    const messagesForModel = [
      { role: "system", content: systemPrompt },
      ...historyMessages.slice(0, -1),
      { role: "user", content: userContent.length ? userContent : text }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messagesForModel,
      max_tokens: 150
    });

    let reply = completion.choices[0]?.message?.content?.trim() || "Sorry, I couldn't come up with a response. Please try again or open a Direct Ticket.";
    if (reply.length > 220) reply = reply.slice(0, 217) + "...";

    const aiMsg = { from: "assistant", text: reply, timestamp: new Date().toISOString() };
    session.messages.push(aiMsg);
    writeAiChats(chats);

    res.json({ session, reply: aiMsg });
  } catch (e) {
    console.error("AI chat error:", e.message);

    // Graceful in-chat fallback instead of a raw error: surface a friendly
    // assistant bubble pointing the customer to Direct Ticket support.
    try {
      const chats = readAiChats();
      const session = chats.find(s => s.id === req.params.id);
      if (session) {
        const isQuota = e.status === 429 || /quota|rate limit/i.test(e.message || "");
        const fallbackText = isQuota
          ? "AI Assistant is busy right now. Please try again shortly, or open a Direct Ticket for help."
          : "AI Assistant is temporarily unavailable. Please try again or open a Direct Ticket.";
        const fallbackMsg = { from: "assistant", text: fallbackText, timestamp: new Date().toISOString(), fallback: true };
        session.messages.push(fallbackMsg);
        writeAiChats(chats);
        return res.json({ session, reply: fallbackMsg });
      }
    } catch (innerErr) {
      console.error("AI chat fallback error:", innerErr.message);
    }

    res.status(500).json({ message: "AI Assistant is temporarily unavailable. Please try again or open a Direct Ticket." });
  }
});

// LIST ADMINS (requires token, passwords excluded)
app.get("/admins", verifyToken, (req, res) => {
  const admins = readAdmins().map(({ password, ...rest }) => rest);
  res.json(admins);
});

// DELETE ADMIN (requires token, cannot delete yourself)
app.delete("/admins/:id", verifyToken, (req, res) => {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ message: "You cannot delete your own account" });
  const admins = readAdmins();
  const index = admins.findIndex(a => a.id === targetId);
  if (index === -1) return res.status(404).json({ message: "Admin not found" });
  admins.splice(index, 1);
  writeAdmins(admins);
  res.json({ message: "Admin deleted" });
});

// CREATE ADMIN (requires existing admin token)
app.post("/create-admin", verifyToken, async (req, res) => {
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

// CHANGE PASSWORD (requires existing admin token)
app.post("/change-password", verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ message: "Missing fields" });
  const admins = readAdmins();
  const admin = admins.find(a => a.id === req.user.id);
  if (!admin) return res.status(404).json({ message: "Admin not found" });
  const match = await bcrypt.compare(currentPassword, admin.password);
  if (!match) return res.status(401).json({ message: "Current password is incorrect" });
  admin.password = await bcrypt.hash(newPassword, 10);
  writeAdmins(admins);
  res.json({ message: "Password updated successfully" });
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