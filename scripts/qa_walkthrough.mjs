import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3000";
const adminEmail = process.env.QA_ADMIN_EMAIL ?? "qa.admin@example.com";
const adminPassword = process.env.QA_ADMIN_PASSWORD ?? "AdminPass123!";
const runId = Date.now().toString();
const artifactsDir = path.resolve(process.cwd(), "scripts", "qa-artifacts", runId);

const suffix = runId.slice(-6);
const studentEmail = `qa.student.${suffix}@example.com`;
const studentPassword = "StudentPass123!";
const studentMatric = `MAT${suffix}`;
const grievanceTitle = `QA Grievance ${suffix}`;
const grievanceDescription =
  "Tuition payment update was delayed after submission and portal still shows pending.";
const grievanceComment =
  "Follow-up: payment confirmation has been uploaded and registrar review is requested.";

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

await runStep("register", async () => {
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" });
  await page.getByLabel("First name").fill("QA");
  await page.getByLabel("Last name").fill("Student");
  await page.getByLabel("Matric number").fill(studentMatric);
  await page.getByLabel("Email").fill(studentEmail);
  await page.getByLabel("Password", { exact: true }).fill(studentPassword);
  await page.getByLabel("Confirm password").fill(studentPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/app", { timeout: 30000 });
  await page.getByRole("heading", { name: /Student Grievances Dashboard/i }).waitFor();
});

await runStep("app_profile_update", async () => {
  await page.getByLabel("Phone number").fill("+2348000000000");
  await page.getByLabel("Faculty").fill("Engineering");
  await page.getByLabel("Department").fill("Computer Engineering");
  await page.getByLabel("Level").fill("400");
  await page.getByRole("button", { name: /Save profile/i }).click();
  await page.getByText(/Profile updated successfully/i).waitFor({ timeout: 15000 });
});

await runStep("grievances_list_and_create", async () => {
  await page.goto(`${baseUrl}/grievances`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Grievance Intake and Tracking/i }).waitFor();
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
  await page.waitForURL("**/grievances/*", { timeout: 20000 });
  await page.getByRole("heading", { name: grievanceTitle }).waitFor();
  await page.getByLabel("Add comment").fill(grievanceComment);
  await page.getByRole("button", { name: /Post comment/i }).click();
  await page.getByText(grievanceComment).waitFor({ timeout: 15000 });
});

await runStep("student_access_operations_redirect", async () => {
  await page.goto(`${baseUrl}/operations`, { waitUntil: "networkidle" });
  await page.waitForURL("**/app", { timeout: 20000 });
});

await runStep("student_access_analytics_redirect", async () => {
  await page.goto(`${baseUrl}/analytics`, { waitUntil: "networkidle" });
  await page.waitForURL("**/app", { timeout: 20000 });
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
  await page.getByRole("heading", { name: /Student Grievances Dashboard/i }).waitFor();
});

await runStep("operations", async () => {
  await page.goto(`${baseUrl}/operations`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Routing, SLA and Escalation Board/i }).waitFor();
});

await runStep("analytics", async () => {
  await page.goto(`${baseUrl}/analytics`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Analytics Dashboard/i }).waitFor();
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
