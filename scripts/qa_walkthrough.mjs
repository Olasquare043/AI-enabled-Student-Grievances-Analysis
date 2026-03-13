import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000";
const adminEmail = process.env.QA_ADMIN_EMAIL ?? "admin@gmail.com";
const adminPassword = process.env.QA_ADMIN_PASSWORD ?? "password123";
const studentEmail = process.env.QA_STUDENT_EMAIL ?? "ola2@gmail.com";
const studentPassword = process.env.QA_STUDENT_PASSWORD ?? "password123";
const runId = Date.now().toString();
const artifactsDir = path.resolve(process.cwd(), "scripts", "qa-artifacts", runId);

const suffix = runId.slice(-6);
const grievanceTitle = `Fee confirmation follow-up ${suffix}`;
const grievanceDescription =
  "My school fee payment has been confirmed by the bank, but the portal still shows pending and blocks course registration.";
const grievanceComment =
  "Follow-up: I uploaded the bank receipt again today and need bursary confirmation so registration can proceed.";

await mkdir(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const report = [];

async function capture(name) {
  const safeName = name.replace(/[^a-zA-Z0-9-_]/g, "_").toLowerCase();
  const filePath = path.join(artifactsDir, `${safeName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
}

async function runStep(pageName, action) {
  try {
    await action();
    await capture(pageName);
    report.push({ page: pageName, status: "pass" });
  } catch (error) {
    await capture(`${pageName}_error`);
    report.push({
      page: pageName,
      status: "fail",
      detail: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

await runStep("landing", async () => {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Transform campus grievance management/i }).waitFor();
});

await runStep("privacy", async () => {
  await page.goto(`${baseUrl}/privacy`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Privacy Policy/i }).waitFor();
});

await runStep("terms", async () => {
  await page.goto(`${baseUrl}/terms`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Terms of Service/i }).waitFor();
});

await runStep("contact", async () => {
  await page.goto(`${baseUrl}/contact`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Contact and Support/i }).waitFor();
});

await runStep("register_page", async () => {
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Register account/i }).waitFor();
});

await runStep("student_login", async () => {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(studentEmail);
  await page.getByLabel("Password").fill(studentPassword);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/app", { timeout: 30000 });
  await page.getByRole("heading", { name: /Student overview/i }).waitFor();
});

await runStep("app_profile_update", async () => {
  await page.goto(`${baseUrl}/app/profile`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Profile and identity/i }).waitFor();
  await page.getByRole("button", { name: /^Edit$/i }).click();
  await page.getByLabel("Phone number").fill("08030796165");
  await page.getByLabel("Faculty").fill("Science");
  await page.getByLabel("Department").fill("Computer Science");
  await page.getByLabel("Level").fill("500");
  await page.getByRole("button", { name: /Save profile/i }).click();
  await page.getByText(/Profile updated/i).waitFor({ timeout: 15000 });
});

await runStep("grievances_list_and_create", async () => {
  await page.goto(`${baseUrl}/app/grievances`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Grievance intake and tracking/i }).waitFor();
  await page.getByLabel("Title").fill(grievanceTitle);
  await page.getByLabel("Category").selectOption("ict");
  await page.getByLabel("Description").fill(grievanceDescription);
  await page.getByRole("button", { name: /Submit grievance/i }).click();
  await page
    .locator("article")
    .filter({ hasText: grievanceTitle })
    .first()
    .waitFor({ timeout: 15000 });
});

await runStep("grievance_detail_and_comment", async () => {
  const grievanceCard = page.locator("article").filter({ hasText: grievanceTitle }).first();
  await grievanceCard.getByRole("link", { name: /Open details/i }).click();
  await page.waitForURL("**/app/grievances/*", { timeout: 20000 });
  await page.getByRole("heading", { name: grievanceTitle }).waitFor();
  await page.getByLabel("Add comment").fill(grievanceComment);
  await page.getByRole("button", { name: /Post comment/i }).click();
  await page.getByText(grievanceComment).waitFor({ timeout: 15000 });
});

await runStep("student_access_operations_redirect", async () => {
  await page.goto(`${baseUrl}/app/operations`, { waitUntil: "networkidle" });
  await page.waitForURL("**/app", { timeout: 20000 });
  await page.getByRole("heading", { name: /Student overview/i }).waitFor();
});

await runStep("student_analysis", async () => {
  await page.goto(`${baseUrl}/app/analysis`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Personal analysis/i }).waitFor();
});

await runStep("student_logout", async () => {
  await page.getByRole("button", { name: /Logout/i }).click();
  await page.waitForURL("**/login", { timeout: 20000 });
});

await runStep("admin_login", async () => {
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL("**/app", { timeout: 30000 });
  await page.getByRole("heading", { name: /Dashboard overview/i }).waitFor();
});

await runStep("operations", async () => {
  await page.goto(`${baseUrl}/app/operations`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Routing and SLA operations/i }).waitFor();
});

await runStep("admin_analysis", async () => {
  await page.goto(`${baseUrl}/app/analysis`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Operational analysis/i }).waitFor();
});

await runStep("analytics_workspace", async () => {
  await page.goto(`${baseUrl}/app/analytics`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Analytics workspace/i }).waitFor();
});

await runStep("user_access", async () => {
  await page.goto(`${baseUrl}/app/users`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /User role management/i }).waitFor();
});

await runStep("admin_logout", async () => {
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Logout/i }).click();
  await page.waitForURL("**/login", { timeout: 20000 });
});

await browser.close();

const summary = {
  run_id: runId,
  base_url: baseUrl,
  artifacts_dir: artifactsDir,
  uses_seeded_accounts: true,
  student_email: studentEmail,
  admin_email: adminEmail,
  results: report,
  passed: report.filter((item) => item.status === "pass").length,
  failed: report.filter((item) => item.status === "fail").length,
};

await writeFile(
  path.join(artifactsDir, "qa-report.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf-8",
);

console.log("QA_REPORT_START");
console.log(JSON.stringify(summary));
console.log("QA_REPORT_END");

if (summary.failed > 0) {
  process.exitCode = 1;
}
