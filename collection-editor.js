adminRequireSession();

const collectionKey = window.COLLECTION_KEY;
let collectionItems = [];
let allCollections = { newArrivals: [], specialPacks: [] };
let savingCollection = false;

window.addEventListener("load", () => {
  document.body.classList.add("loaded");
  loadCollectionItems();
});

function escapeCollectionHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    "\"": "&quot;", "'": "&#039;"
  }[char]));
}

function updateCollectionField(index, key, value) {
  if (collectionItems[index]) collectionItems[index][key] = value;
}

function renderCollectionEditor() {
  const editor = document.getElementById("collectionEditor");
  if (!collectionItems.length) {
    editor.innerHTML = `<div class="empty-node">No subsections yet.</div>`;
    return;
  }

  editor.innerHTML = collectionItems.map((item, index) => {
    const preview = item.image
      ? `<img class="image-preview" src="${escapeCollectionHtml(item.image)}" alt="Current subsection image">`
      : `<div class="image-preview image-placeholder">＋</div>`;
    return `<article class="subsection-card">
      <div class="subsection-head">
        <span class="subsection-number">Subsection ${index + 1}</span>
        <button class="delete-btn" onclick="deleteCollectionItem(${index})">Delete subsection</button>
      </div>
      <div class="field-grid">
        <div class="field">
          <label>Display name</label>
          <input type="text" value="${escapeCollectionHtml(item.name)}"
            oninput="updateCollectionField(${index},'name',this.value)">
        </div>
        <div class="field">
          <label>ID</label>
          <input type="text" value="${escapeCollectionHtml(item.id)}"
            oninput="updateCollectionField(${index},'id',this.value)">
          <div class="id-note">Use a unique ID for this collection subsection.</div>
        </div>
        <div class="image-field">
          ${preview}
          <div class="image-actions">
            <label for="collection-image-${index}">
              ${item.image ? "Change display picture" : "Add display picture"}
              <input type="file" id="collection-image-${index}" accept="image/*"
                onchange="handleCollectionImage(${index},event)">
            </label>
            ${item.image ? `<button class="clear-image" type="button" onclick="clearCollectionImage(${index})">Remove picture</button>` : ""}
          </div>
        </div>
      </div>
    </article>`;
  }).join("");
}

async function loadCollectionItems() {
  try {
    const response = await fetch("/collections");
    if (!response.ok) throw new Error("Failed to load collection data");
    const data = await response.json();
    allCollections = {
      newArrivals: Array.isArray(data.newArrivals) ? data.newArrivals : [],
      specialPacks: Array.isArray(data.specialPacks) ? data.specialPacks : []
    };
    collectionItems = Array.isArray(data[collectionKey]) ? data[collectionKey] : [];
    renderCollectionEditor();
  } catch (error) {
    document.getElementById("collectionEditor").innerHTML =
      `<div class="error-state">Could not load this collection. Please refresh and try again.</div>`;
  }
}

function createCollectionId() {
  const base = collectionKey === "newArrivals" ? "arrival" : "pack";
  const used = new Set(collectionItems.map(item => item.id));
  let id = base + "-new";
  let number = 2;
  while (used.has(id)) id = base + "-new-" + number++;
  return id;
}

function addCollectionItem() {
  collectionItems.push({ id: createCollectionId(), name: "New Subsection", image: "" });
  renderCollectionEditor();
}

function deleteCollectionItem(index) {
  if (!confirm("Delete this subsection from the collection?")) return;
  collectionItems.splice(index, 1);
  renderCollectionEditor();
}

function clearCollectionImage(index) {
  if (collectionItems[index]) collectionItems[index].image = "";
  renderCollectionEditor();
}

function handleCollectionImage(index, event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    event.target.value = "";
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    alert("Please choose an image smaller than 4 MB.");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (collectionItems[index]) collectionItems[index].image = reader.result;
    renderCollectionEditor();
  };
  reader.onerror = () => alert("Could not read that image. Please try another one.");
  reader.readAsDataURL(file);
}

function validateCollectionItems() {
  if (!collectionItems.length) return "Add at least one subsection.";
  const ids = new Set();
  for (const item of collectionItems) {
    if (!String(item.name || "").trim()) return "Subsection names cannot be blank.";
    if (!String(item.id || "").trim()) return "Subsection IDs cannot be blank.";
    if (ids.has(item.id)) return "Subsection IDs must be unique.";
    if (!String(item.image || "").trim()) return "Every subsection needs a display picture.";
    ids.add(item.id);
  }
  return "";
}

async function saveCollection() {
  if (savingCollection) return;
  const status = document.getElementById("saveStatus");
  const validationError = validateCollectionItems();
  if (validationError) {
    status.className = "save-status error";
    status.textContent = validationError;
    return;
  }
  const token = localStorage.getItem("adminToken");
  if (!token) {
    status.className = "save-status error";
    status.textContent = "Session expired. Please log in again.";
    return;
  }

  savingCollection = true;
  const button = document.getElementById("saveBtn");
  button.disabled = true;
  button.textContent = "Saving…";
  status.className = "save-status";
  status.textContent = "Saving subsection changes…";

  try {
    const response = await fetch("/collections", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({
        newArrivals: collectionKey === "newArrivals" ? collectionItems : allCollections.newArrivals,
        specialPacks: collectionKey === "specialPacks" ? collectionItems : allCollections.specialPacks
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not save collection");
    allCollections = data.collections || allCollections;
    status.textContent = "Changes saved successfully.";
  } catch (error) {
    status.className = "save-status error";
    status.textContent = error.message || "Could not save collection.";
  } finally {
    savingCollection = false;
    button.disabled = false;
    button.textContent = "Save Changes";
  }
}