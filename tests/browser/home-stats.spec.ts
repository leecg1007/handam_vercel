import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { getWeekStripDates, shiftWeek } from "../../week-calendar.js";

test.use({ timezoneId: "Asia/Seoul" });

function key(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function shifted(reference: Date, amount: number) {
  const date = new Date(reference);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + amount);
  return date;
}
function buildRecords(reference = new Date()) {
  const samples = [
    [0, "😌 평온", "차분한 시작", "이번 주를 천천히 시작했다."],
    [-1, "😊 행복", "친구와 산책", "친구와 산책하며 웃었다."],
    [-2, "😌 평온", "책 읽는 오후", "좋아하는 책을 읽었다."],
    [-7, "😰 불안", "새로운 계획", "새로운 계획을 정리했다."],
  ] as const;
  return samples.map(([offset, mood, title, body], index) => {
    const date = shifted(reference, offset);
    return { id: `record-${index}`, entryDate: key(date), createdAt: date.toISOString(), mood, title, body, summary: body };
  });
}
function range(reference: Date) {
  const dates = getWeekStripDates(reference);
  return `${dates[0].getMonth() + 1}.${dates[0].getDate()} 월 — ${dates[6].getMonth() + 1}.${dates[6].getDate()} 일`;
}

async function setup(page: Page, fixture = buildRecords()) {
  const modules: Record<string, string> = {
    "firebase-app.js": "export const initializeApp=()=>({});",
    "firebase-analytics.js": "export const isSupported=async()=>false;export const getAnalytics=()=>({});",
    "firebase-auth.js": `
      const user={uid:'stats-test',email:'stats@example.test',displayName:'통계 사용자',getIdToken:async()=>'mock-token'};
      const auth={currentUser:user};
      export const getAuth=()=>auth;export const onAuthStateChanged=(a,cb)=>{queueMicrotask(()=>cb(user));return()=>{}};
      export const signOut=async()=>{};export const signInWithEmailAndPassword=async()=>({user});
      export const signInWithPopup=signInWithEmailAndPassword;export const createUserWithEmailAndPassword=signInWithEmailAndPassword;
      export const updatePassword=async()=>{};export const updateProfile=async()=>{};export const sendPasswordResetEmail=async()=>{};
      export const reauthenticateWithCredential=async()=>{};export const EmailAuthProvider={credential:()=>({})};
      export class GoogleAuthProvider{setCustomParameters(){}}
    `,
    "firebase-firestore.js": `
      const records=${JSON.stringify(fixture)};
      export const getFirestore=()=>({});export const collection=(...a)=>a;export const doc=(...a)=>a;
      export const getDoc=async()=>({exists:()=>true,data:()=>({migrationVersion:1,displayName:'통계 사용자',settings:{}})});
      export const getDocs=async()=>({docs:records.map(record=>({id:record.id,data:()=>record}))});
      export const orderBy=(...a)=>a;export const query=(...a)=>a;export const serverTimestamp=()=>null;
      export const setDoc=async()=>{};export const deleteDoc=async()=>{};export const writeBatch=()=>({set(){},commit:async()=>{}});
      export const Timestamp={fromDate:d=>d};
    `,
  };
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.fulfill({
    contentType: "text/javascript",
    body: modules[new URL(route.request().url()).pathname.split("/").pop()!] || "",
  }));
  await page.route("**/data/animations.json", route => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ loading: { splash: { minMs: 20, maxMs: 40, finishDelayMs: 0, exitMs: 0, revealAppDelayMs: 0 } } }),
  }));
  await page.route("**/db-worker.js", route => route.fulfill({ contentType: "text/javascript", body: "self.onmessage=e=>self.postMessage({id:e.data.id,data:e.data.type==='list'?[]:{ok:true}});" }));
  await page.route("**/api/**", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/");
  await expect(page.locator("#page-home")).toHaveClass(/active/);
  await expect(page.locator("#splash-root")).toHaveCount(0, { timeout: 5000 });
}

test("weekly sheet and all-record statistics preserve the complete home flow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reference = new Date();
  const fixture = buildRecords(reference);
  await setup(page, fixture);
  mkdirSync("output/design-qa", { recursive: true });

  const weekCard = page.locator("#home-week-card");
  await weekCard.click();
  const sheet = page.locator("#week-stats-sheet");
  await expect(sheet).toHaveClass(/show/);
  await expect(page.locator("#week-stats-range-compact")).toHaveText(range(reference));
  const currentWeekKeys = new Set(getWeekStripDates(reference).map(key));
  const currentWeekDays = new Set(fixture.map(record => record.entryDate).filter(dateKey => currentWeekKeys.has(dateKey))).size;
  await expect(page.locator("#week-stats-days-written")).toHaveText(`${currentWeekDays}일`);
  await expect(page.locator("#week-stats-next")).toBeDisabled();
  await expect(page.locator("#week-stats-records")).toBeVisible();
  const actionsBox = await page.locator(".week-stats-actions").boundingBox();
  const navBox = await page.locator(".bottom-nav").boundingBox();
  expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(navBox!.y);
  await page.screenshot({ path: "output/design-qa/week-sheet-390.png" });

  await page.locator("#week-stats-prev").click();
  await expect(page.locator("#week-stats-range-compact")).toHaveText(range(shiftWeek(reference, -1)));
  await page.keyboard.press("Escape");
  await expect(sheet).not.toHaveClass(/show/);
  await expect(weekCard).toBeFocused();

  await page.locator("#home-records-all").click();
  await expect(page.locator("#page-records")).toHaveClass(/active/);
  await expect(sheet).toBeHidden();
  await expect(page.locator("#records-insight-title")).toContainText("평온한 마음");
  await expect(page.locator("#records-days-written")).toHaveText("4일");
  await expect(page.locator("#records-longest-streak")).toHaveText("3일");
  await page.locator("#page-records").evaluate(async element => {
    await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})));
  });
  await page.screenshot({ path: "output/design-qa/records-page-390.png", fullPage: false });

  await page.locator("#filter-mood").selectOption("행복");
  await expect(page.locator("#records-list .diary-row")).toHaveCount(1);
  await page.locator("#filter-mood").selectOption("all");
  await page.locator("#records-list .diary-row").first().click();
  await expect(page.locator("#page-record-detail")).toHaveClass(/active/);
  await page.locator("#page-record-detail .iconbtn").click();
  await expect(page.locator("#page-records")).toHaveClass(/active/);
});

test("statistics render a useful empty state without hiding the write action", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setup(page, []);
  await page.locator("#home-week-card").click();
  await expect(page.locator("#week-stats-empty")).toBeVisible();
  await expect(page.locator("#week-stats-write")).toBeVisible();
  await page.locator("#week-stats-close").click();
  await page.locator("#home-records-all").click();
  await expect(page.locator("#records-empty")).toBeVisible();
  await expect(page.locator("#records-days-written")).toHaveText("0일");
  expect(await page.locator("#page-records").evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
