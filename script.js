const users = {
  admin: { username: "admin", password: "admin@123", name: "Admin", role: "admin" },
  staff1: { username: "staff1", password: "staff1@123", name: "Staff 1", role: "staff1" },
  staff2: { username: "staff2", password: "staff2@123", name: "Staff 2", role: "staff2" },
  staff3: { username: "staff3", password: "staff3@123", name: "Staff 3", role: "staff3" }
};

const DASHBOARD_API_URL = "http://127.0.0.1:5000/api/dashboard";
const ENQUIRY_API_URL = "http://127.0.0.1:5000/api/enquiries";
let dashboardApplications = [];

const loginForm = document.getElementById("loginForm");
const messageElement = document.getElementById("message");
const welcomeHeading = document.getElementById("welcomeHeading");
const logoutBtn = document.getElementById("logoutBtn");
const applicationsBody = document.getElementById("applicationsBody");
const kpiGrid = document.getElementById("kpiGrid");
const advanceCollected = document.getElementById("advanceCollected");
const pendingAmount = document.getElementById("pendingAmount");
const topCategories = document.getElementById("topCategories");
const hostelYes = document.getElementById("hostelYes");
const hostelNo = document.getElementById("hostelNo");
const hostelTotal = document.getElementById("hostelTotal");
const searchInput = document.getElementById("searchInput");
const courseFilter = document.getElementById("courseFilter");
const statusFilter = document.getElementById("statusFilter");
const resetFilters = document.getElementById("resetFilters");
const enquiryForm = document.getElementById("enquiryForm");
const enquiryMessage = document.getElementById("enquiryMessage");

function setMessage(text, type) {
  if (!messageElement) return;
  messageElement.textContent = text;
  messageElement.className = `form-message ${type}`;
}

function setEnquiryMessage(text, type) {
  if (!enquiryMessage) return;
  enquiryMessage.textContent = text;
  enquiryMessage.className = `form-message ${type} wide`;
}

function getCurrentUser() {
  const savedUser = localStorage.getItem("ambitCurrentUser");
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser);
  } catch (error) {
    localStorage.removeItem("ambitCurrentUser");
    return null;
  }
}

function ensureAuthenticated() {
  const isProtectedPage = Boolean(
    applicationsBody || enquiryForm || document.querySelector(".dashboard-page")
  );
  if (!isProtectedPage) return null;

  const currentUser = getCurrentUser();
  if (!currentUser || !currentUser.name) {
    window.location.href = "index.html";
    return null;
  }
  return currentUser;
}

if (loginForm) {
  loginForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const usernameInput = loginForm.querySelector("#username");
    const passwordInput = loginForm.querySelector("#password");

    if (!usernameInput || !passwordInput) {
      setMessage("Login form is not configured correctly.", "error");
      return;
    }

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
      setMessage("Please fill all fields.", "error");
      return;
    }

    // Find user by username and password
    let selectedUser = null;
    let userRole = null;
    for (const [role, user] of Object.entries(users)) {
      if (user.username === username && user.password === password) {
        selectedUser = user;
        userRole = role;
        break;
      }
    }

    if (!selectedUser) {
      setMessage("Invalid username or password. Please try again.", "error");
      return;
    }

    localStorage.setItem(
      "ambitCurrentUser",
      JSON.stringify({ role: userRole, name: selectedUser.name })
    );
    setMessage("Login successful. Redirecting...", "success");

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 700);
  });
}

const currentUser = ensureAuthenticated();
if (welcomeHeading && currentUser) {
  welcomeHeading.textContent = currentUser.name;
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("ambitCurrentUser");
    window.location.href = "index.html";
  });
}

function renderKpis(kpis) {
  if (!kpiGrid) return;
  kpiGrid.innerHTML = kpis
    .map(
      (kpi) => `
      <article class="card kpi-card">
        <div class="kpi-icon ${kpi.accent}"></div>
        <div>
          <p class="kpi-label">${kpi.label}</p>
          <h3>${kpi.value}</h3>
          <p class="kpi-sub">${kpi.subLabel}</p>
        </div>
      </article>
    `
    )
    .join("");
}

function renderTableRows(rows) {
  if (!applicationsBody) return;
  if (!rows.length) {
    applicationsBody.innerHTML = `<tr><td colspan="7">No applications found.</td></tr>`;
    return;
  }
  applicationsBody.innerHTML = rows
    .map(
      (app) => `
      <tr>
        <td>${app.id}</td>
        <td>${app.name}</td>
        <td>${app.contact}</td>
        <td>${app.course}</td>
        <td>${app.exam}</td>
        <td><span class="status ${app.status.toLowerCase()}">${app.status}</span></td>
        <td>
          <div class="action-icons">
            <button type="button" class="payment-btn ${app.paymentStatus === "Paid" ? "paid" : "unpaid"}" data-id="${app.id}">
              ${app.paymentStatus === "Paid" ? "Paid" : "Take Payment"}
            </button>
          </div>
        </td>
      </tr>
    `
    )
    .join("");
}

function applyFilters() {
  const query = (searchInput?.value || "").toLowerCase().trim();
  const selectedCourse = courseFilter?.value || "All Courses";
  const selectedStatus = statusFilter?.value || "All";

  const filtered = dashboardApplications.filter((app) => {
    const queryMatch =
      app.name.toLowerCase().includes(query) || app.contact.includes(query);
    const courseMatch =
      selectedCourse === "All Courses" || app.course === selectedCourse;
    const statusMatch = selectedStatus === "All" || app.status === selectedStatus;
    return queryMatch && courseMatch && statusMatch;
  });

  renderTableRows(filtered);
}

async function submitPayment(enquiryId) {
  const amountValue = window.prompt("Enter payment amount", "5000");
  if (!amountValue) return;
  const amount = Number(amountValue);
  if (Number.isNaN(amount) || amount <= 0) {
    window.alert("Please enter a valid positive amount.");
    return;
  }

  const response = await fetch(`${ENQUIRY_API_URL}/${enquiryId}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount })
  });
  const data = await response.json();
  if (!response.ok) {
    window.alert(data.error || "Unable to record payment.");
    return;
  }
  window.alert("Payment recorded successfully.");
  loadDashboardData();
}

async function loadDashboardData() {
  if (!applicationsBody) return;
  try {
    const response = await fetch(DASHBOARD_API_URL);
    const data = await response.json();

    dashboardApplications = data.applications || [];
    renderKpis(data.kpis || []);
    renderTableRows(dashboardApplications);

    if (advanceCollected) advanceCollected.textContent = data.paymentOverview.advanceCollected;
    if (pendingAmount) pendingAmount.textContent = data.paymentOverview.pendingAmount;
    if (hostelYes) hostelYes.textContent = data.hostelRequirement.yes;
    if (hostelNo) hostelNo.textContent = data.hostelRequirement.no;
    if (hostelTotal) hostelTotal.textContent = data.hostelRequirement.total;

    if (topCategories) {
      topCategories.innerHTML = (data.topCategories || [])
        .map(
          (cat) =>
            `<p class="list-line"><span>${cat.name}</span><span>${cat.value}</span></p>`
        )
        .join("");
    }
  } catch (error) {
    applicationsBody.innerHTML =
      "<tr><td colspan='7'>Unable to load dashboard data. Start Flask backend.</td></tr>";
  }
}

if (applicationsBody) {
  applicationsBody.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("payment-btn")) return;
    const enquiryId = Number(target.dataset.id);
    if (!enquiryId) return;
    await submitPayment(enquiryId);
  });
}

if (enquiryForm) {
  enquiryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(enquiryForm);
    const payload = Object.fromEntries(formData.entries());
    payload.pucPercent = Number(payload.pucPercent || 0);

    try {
      const response = await fetch(ENQUIRY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        setEnquiryMessage(data.error || "Failed to create enquiry.", "error");
        return;
      }

      setEnquiryMessage("Enquiry submitted successfully. Redirecting to dashboard...", "success");
      enquiryForm.reset();
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 900);
    } catch (error) {
      setEnquiryMessage("Backend server is not running. Start Flask and try again.", "error");
    }
  });
}

if (searchInput) searchInput.addEventListener("input", applyFilters);
if (courseFilter) courseFilter.addEventListener("change", applyFilters);
if (statusFilter) statusFilter.addEventListener("change", applyFilters);
if (resetFilters) {
  resetFilters.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (courseFilter) courseFilter.value = "All Courses";
    if (statusFilter) statusFilter.value = "All";
    renderTableRows(dashboardApplications);
  });
}

loadDashboardData();