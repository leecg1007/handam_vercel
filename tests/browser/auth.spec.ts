import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

type AuthModel = {
  createCalls: number;
  resetCalls: number;
  firestoreWrites: Record<string, unknown>[];
  updateProfileDelay: number;
  resetErrorCode: string | null;
};

async function setupLoggedOut(page: Page, theme = "light") {
  const model: AuthModel = {
    createCalls: 0,
    resetCalls: 0,
    firestoreWrites: [],
    updateProfileDelay: 0,
    resetErrorCode: null,
  };
  const modules: Record<string, string> = {
    "firebase-app.js": "export const initializeApp=()=>({});",
    "firebase-analytics.js": "export const isSupported=async()=>false; export const getAnalytics=()=>({});",
    "firebase-auth.js": `
      const listeners=[];
      const auth={currentUser:null,languageCode:'ko'};
      const makeUser=email=>({uid:'auth-user',email,displayName:null,getIdToken:async()=>'mock-token'});
      const emit=user=>queueMicrotask(()=>listeners.forEach(cb=>cb(user)));
      export const getAuth=()=>auth;
      export const onAuthStateChanged=(a,cb)=>{listeners.push(cb);queueMicrotask(()=>cb(a.currentUser));return()=>{}};
      export const signInWithEmailAndPassword=async(a,email)=>{const user=makeUser(email);a.currentUser=user;emit(user);return{user}};
      export const createUserWithEmailAndPassword=async(a,email)=>{await fetch('/__mock/create',{method:'POST'});const user=makeUser(email);a.currentUser=user;emit(user);return{user}};
      export const updateProfile=async(user,patch)=>{await fetch('/__mock/update-profile',{method:'POST'});user.displayName=patch.displayName};
      export const signInWithPopup=async a=>{const user=makeUser('google.reader@example.test');user.displayName='구글 독자';a.currentUser=user;emit(user);return{user}};
      export const signOut=async a=>{a.currentUser=null;emit(null)};
      export const sendPasswordResetEmail=async(a,email)=>{const res=await fetch('/__mock/reset',{method:'POST',body:JSON.stringify({email})});if(!res.ok){const data=await res.json();const error=Error(data.code);error.code=data.code;throw error}};
      export const updatePassword=async()=>{};export const reauthenticateWithCredential=async()=>{};
      export const EmailAuthProvider={credential:()=>({})};export class GoogleAuthProvider{setCustomParameters(){}}
    `,
    "firebase-firestore.js": `
      export const getFirestore=()=>({});export const collection=(...a)=>a;export const doc=(...a)=>a;
      export const getDoc=async()=>({exists:()=>false,data:()=>({})});export const getDocs=async()=>({docs:[]});
      export const orderBy=(...a)=>a;export const query=(...a)=>a;export const serverTimestamp=()=>null;
      export const Timestamp={fromDate:d=>d};
      export const setDoc=async(ref,data)=>{await fetch('/__mock/firestore',{method:'POST',body:JSON.stringify(data)})};
      export const deleteDoc=async()=>{};export const writeBatch=()=>({set(){},commit:async()=>{}});
    `,
  };
  await page.route("https://www.gstatic.com/firebasejs/**", route => route.fulfill({
    contentType: "text/javascript",
    body: modules[new URL(route.request().url()).pathname.split("/").pop()!] || "",
  }));
  await page.route("**/db-worker.js", route => route.fulfill({
    contentType: "text/javascript",
    body: "self.onmessage=e=>self.postMessage({id:e.data.id,data:e.data.type==='list'?[]:{ok:true}});",
  }));
  await page.route("**/__mock/create", async route => {
    model.createCalls += 1;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/__mock/update-profile", async route => {
    if (model.updateProfileDelay) await new Promise(resolve => setTimeout(resolve, model.updateProfileDelay));
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/__mock/reset", async route => {
    model.resetCalls += 1;
    await route.fulfill(model.resetErrorCode
      ? { status: 400, json: { code: model.resetErrorCode } }
      : { json: { ok: true } });
  });
  await page.route("**/__mock/firestore", async route => {
    model.firestoreWrites.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/**", route => route.fulfill({ json: { ok: true } }));
  await page.addInitScript(selectedTheme => {
    localStorage.setItem("handam-theme", selectedTheme);
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("splash-root")?.remove();
      document.body.classList.remove("is-splash-active");
      document.querySelector(".device")?.classList.remove("app-shell--loading");
    }, { once: true });
  }, theme);
  await page.goto("/");
  await expect(page.locator("#page-login")).toHaveClass(/active/);
  await expect(page.locator("#splash-root")).toHaveCount(0, { timeout: 12000 });
  return model;
}

test("auth forms expose labels, keyboard submit, inline errors, focus and a hidden inert sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setupLoggedOut(page);

  const login = page.locator("#page-login");
  await expect(login.getByLabel("이메일 또는 관리자 아이디")).toBeVisible();
  await expect(login.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "회원가입" }).click();
  const signup = page.locator("#page-signup");
  await expect(page.getByRole("heading", { name: "회원가입" })).toBeFocused();
  await expect(signup.getByRole("button", { name: "로그인으로 돌아가기" })).toBeVisible();
  await expect(signup.getByLabel("이름 (표시 이름)")).toBeVisible();
  await expect(signup.getByLabel("이메일", { exact: true })).toBeVisible();
  await expect(signup.getByLabel("비밀번호", { exact: true })).toBeVisible();
  await expect(signup.getByLabel("비밀번호 확인", { exact: true })).toBeVisible();

  await signup.getByLabel("이름 (표시 이름)").press("Enter");
  await expect(signup.getByLabel("이름 (표시 이름)")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#signup-name-error")).toHaveText("이름을 입력해주세요.");
  await expect(signup.getByLabel("이름 (표시 이름)")).toBeFocused();
  expect(await page.locator(".device").evaluate(el => el.scrollTop)).toBe(0);
  await expect(page.locator("#sheet")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#sheet")).toHaveAttribute("inert", "");
  await expect(page.locator("#sheet")).toBeHidden();

  const password = signup.getByLabel("비밀번호", { exact: true });
  await signup.getByRole("button", { name: "비밀번호 표시" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(signup.getByRole("button", { name: "비밀번호 숨기기" })).toBeVisible();
});

test("account recovery tabs are semantic and reset requests are neutral and rate limited", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupLoggedOut(page);
  await page.getByRole("button", { name: "아이디/비밀번호 찾기" }).click();

  const passwordTab = page.getByRole("tab", { name: "비밀번호 찾기" });
  const accountTab = page.getByRole("tab", { name: "아이디 확인" });
  await expect(passwordTab).toHaveAttribute("aria-selected", "true");
  await accountTab.click();
  await expect(accountTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#toast")).not.toContainText("설정을 적용했어요");
  await accountTab.press("ArrowLeft");
  await expect(passwordTab).toBeFocused();
  await expect(passwordTab).toHaveAttribute("aria-selected", "true");

  const email = page.getByLabel("가입 이메일");
  await email.press("Enter");
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await email.fill("reader@example.test");
  await email.press("Enter");
  await expect(page.locator("#find-reset-result")).toContainText("입력한 이메일이 등록되어 있다면");
  await expect(page.locator("#find-reset-result")).not.toContainText("firebaseapp.com");
  await expect(page.locator("#password-reset-submit")).toBeDisabled();
  expect((await page.locator("#password-reset-submit").textContent()) || "").toContain("다시 보내기");
});

test("login stores only masked account hints and lets the user clear them", async ({ page }) => {
  await setupLoggedOut(page);
  const login = page.locator("#page-login");
  await login.getByLabel("이메일 또는 관리자 아이디").fill("reader@example.test");
  await login.getByLabel("비밀번호", { exact: true }).fill("secret1");
  await login.getByLabel("비밀번호", { exact: true }).press("Enter");
  await expect(page.locator("#page-home")).toHaveClass(/active/);

  const storage = await page.evaluate(() => ({
    legacy: localStorage.getItem("handam-auth"),
    hints: localStorage.getItem("handam-last-accounts"),
  }));
  expect(storage.legacy).toBeNull();
  expect(storage.hints).toContain("r***@example.test");
  expect(storage.hints).not.toContain("reader@example.test");
  expect(storage.hints).not.toContain("mock-token");

  await page.evaluate(() => (window as typeof window & { logout: () => Promise<void> }).logout());
  await expect(page.locator("#page-login")).toHaveClass(/active/);
  await page.getByRole("button", { name: "아이디/비밀번호 찾기" }).click();
  await page.getByRole("tab", { name: "아이디 확인" }).click();
  await page.getByRole("button", { name: "최근 계정 보기" }).click();
  await expect(page.locator("#find-id-result")).toContainText("r***@example.test");
  await page.getByRole("button", { name: "이 기기의 계정 기록 지우기" }).click();
  await expect(page.locator("#find-id-result")).toContainText("저장된 계정 기록이 없어요");
  expect(await page.evaluate(() => localStorage.getItem("handam-last-accounts"))).toBeNull();
});

test("signup keeps the chosen display name when auth state fires before profile update", async ({ page }) => {
  const model = await setupLoggedOut(page);
  model.updateProfileDelay = 100;
  await page.getByRole("button", { name: "회원가입" }).click();
  const signup = page.locator("#page-signup");
  await signup.getByLabel("이름 (표시 이름)").fill("한담 독자");
  await signup.getByLabel("이메일", { exact: true }).fill("new.reader@example.test");
  await signup.getByLabel("비밀번호", { exact: true }).fill("secret1");
  await signup.getByLabel("비밀번호 확인", { exact: true }).fill("secret1");
  await signup.getByLabel("비밀번호 확인", { exact: true }).press("Enter");
  await expect(page.locator("#page-home")).toHaveClass(/active/);
  expect(model.createCalls).toBe(1);
  const profileWrites = model.firestoreWrites.filter(write => "displayName" in write);
  expect(profileWrites.length).toBeGreaterThan(0);
  expect(profileWrites.every(write => write.displayName === "한담 독자")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("handam-profile-auth-user"))).toContain("한담 독자");
});

for (const theme of ["light", "dark"]) {
  test(`auth contrast and layout ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupLoggedOut(page, theme);
    await page.getByRole("button", { name: "아이디/비밀번호 찾기" }).click();
    const ratios = await page.locator(".device").evaluate(el => {
      const style = getComputedStyle(el);
      const luminance = (hex: string) => {
        const rgb = hex.replace("#", "").match(/../g)!.map(c => parseInt(c, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const background = luminance(document.documentElement.dataset.theme === "dark" ? "#2A261C" : "#F5EFE4");
      return ["--text-muted", "--accent"].map(token => {
        const foreground = luminance(style.getPropertyValue(token).trim());
        return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
      });
    });
    ratios.forEach(ratio => expect(ratio).toBeGreaterThanOrEqual(4.5));
    expect(await page.locator("#page-find-account").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await page.locator(".device").evaluate(el => el.scrollTop)).toBe(0);
    mkdirSync("output/playwright/captures", { recursive: true });
    await page.screenshot({ path: `output/playwright/captures/auth-recovery-${theme}.png` });
  });
}
