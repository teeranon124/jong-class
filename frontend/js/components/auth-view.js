import { state } from '../state.js';
import { CONFIG } from '../config.js';

export function getLoginView() {
    const isStudent = state.authRole === 'student';
    const cTheme = isStudent ? 'secondary' : 'primary';
    const cBgLight = isStudent ? 'bg-secondary/10' : 'bg-primary/10';
    const cText = isStudent ? 'text-secondary' : 'text-primary';

    return `
        <div class="max-w-md w-full mx-auto bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-card border border-brand-100 mt-4 sm:mt-10 relative overflow-hidden transition-all duration-300">
            <div class="absolute -top-20 -right-20 w-40 h-40 ${cBgLight} rounded-full opacity-70 pointer-events-none transition-colors duration-500"></div>
            <div class="absolute top-40 -left-10 w-20 h-20 ${cBgLight} rounded-full opacity-70 pointer-events-none transition-colors duration-500"></div>
            
            <div class="relative z-10">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 ${cBgLight} ${cText} rounded-full flex items-center justify-center mx-auto mb-4 shadow-soft transition-colors duration-500">
                        <i data-lucide="lock" class="w-8 h-8"></i>
                    </div>
                    <h1 class="text-3xl font-bold text-neutral">เข้าสู่ระบบ</h1>
                    <p class="text-sm text-neutral/50 mt-2 font-medium">ยินดีต้อนรับกลับสู่ TutorBooking</p>
                </div>
                
                <!-- Role Selection Toggle -->
                <div class="flex bg-brand-50 p-1.5 rounded-2xl w-full mb-6 relative">
                    <label class="flex-1 text-center cursor-pointer">
                        <input type="radio" name="auth-role" value="student" class="peer sr-only" ${isStudent ? 'checked' : ''} onchange="app.switchAuthRole(this.value)" />
                        <div class="py-2.5 rounded-xl text-sm font-bold text-neutral/50 peer-checked:bg-white peer-checked:text-secondary peer-checked:shadow-sm transition-all flex items-center justify-center gap-2">
                            <i data-lucide="user" class="w-4 h-4"></i> นักเรียน
                        </div>
                    </label>
                    <label class="flex-1 text-center cursor-pointer">
                        <input type="radio" name="auth-role" value="admin" class="peer sr-only" ${!isStudent ? 'checked' : ''} onchange="app.switchAuthRole(this.value)" />
                        <div class="py-2.5 rounded-xl text-sm font-bold text-neutral/50 peer-checked:bg-white peer-checked:text-primary peer-checked:shadow-sm transition-all flex items-center justify-center gap-2">
                            <i data-lucide="graduation-cap" class="w-4 h-4"></i> ติวเตอร์
                        </div>
                    </label>
                </div>
                
                <div class="space-y-4 bg-brand-50/50 p-5 rounded-2xl border border-brand-100 text-center text-xs sm:text-sm text-neutral/70">
                    <div class="w-10 h-10 bg-${cTheme}/10 ${cText} rounded-full flex items-center justify-center mx-auto mb-1 animate-pulse">
                        <i data-lucide="shield-check" class="w-5 h-5"></i>
                    </div>
                    <p class="leading-relaxed">เพื่อความปลอดภัยและสิทธิ์การเข้าใช้งานที่ถูกต้อง กรุณาเข้าสู่ระบบผ่าน <b>บัญชี Google ยืนยันตัวตนจริง</b></p>
                </div>
                
                <div class="google-signin-btn-container mt-6 flex justify-center w-full min-h-[44px]"></div>
                
                <div class="text-center mt-8 pt-6 border-t border-brand-100">
                    <p class="text-sm text-neutral/60 font-medium">ยังไม่มีบัญชี? <button onclick="app.switchAuthView('register')" class="text-${cTheme} font-bold hover:underline ml-1 transition-colors">สมัครสมาชิก</button></p>
                </div>
            </div>
        </div>
    `;
}

export function getRegisterView() {
    const isStudent = state.authRole === 'student';
    const cTheme = isStudent ? 'secondary' : 'primary';
    const cBgLight = isStudent ? 'bg-secondary/10' : 'bg-primary/10';
    const cText = isStudent ? 'text-secondary' : 'text-primary';
    
    const emailVal = state.tempEmail !== undefined ? state.tempEmail : '';
    const passVal = state.tempPass !== undefined ? state.tempPass : '';
    const nameVal = state.tempName !== undefined ? state.tempName : '';

    return `
        <div class="max-w-md w-full mx-auto bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-card border border-brand-100 mt-4 sm:mt-10 relative overflow-hidden transition-all duration-300">
            <div class="absolute -top-20 -left-20 w-40 h-40 ${cBgLight} rounded-full opacity-70 pointer-events-none transition-colors duration-500"></div>
            <div class="absolute top-40 -right-10 w-20 h-20 ${cBgLight} rounded-full opacity-70 pointer-events-none transition-colors duration-500"></div>
            
            <div class="relative z-10">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 ${cBgLight} ${cText} rounded-full flex items-center justify-center mx-auto mb-4 shadow-soft transition-colors duration-500">
                        <i data-lucide="user-plus" class="w-8 h-8"></i>
                    </div>
                    <h1 class="text-3xl font-bold text-neutral">สร้างบัญชีใหม่</h1>
                    <p class="text-sm text-neutral/50 mt-2 font-medium">เข้าร่วม TutorBooking ได้ฟรีวันนี้</p>
                </div>

                <!-- Role Selection Toggle -->
                <div class="flex bg-brand-50 p-1.5 rounded-2xl w-full mb-6 relative">
                    <label class="flex-1 text-center cursor-pointer">
                        <input type="radio" name="auth-role" value="student" class="peer sr-only" ${isStudent ? 'checked' : ''} onchange="app.switchAuthRole(this.value)" />
                        <div class="py-2.5 rounded-xl text-sm font-bold text-neutral/50 peer-checked:bg-white peer-checked:text-secondary peer-checked:shadow-sm transition-all flex items-center justify-center gap-2">
                            <i data-lucide="user" class="w-4 h-4"></i> เป็นนักเรียน
                        </div>
                    </label>
                    <label class="flex-1 text-center cursor-pointer">
                        <input type="radio" name="auth-role" value="admin" class="peer sr-only" ${!isStudent ? 'checked' : ''} onchange="app.switchAuthRole(this.value)" />
                        <div class="py-2.5 rounded-xl text-sm font-bold text-neutral/50 peer-checked:bg-white peer-checked:text-primary peer-checked:shadow-sm transition-all flex items-center justify-center gap-2">
                            <i data-lucide="graduation-cap" class="w-4 h-4"></i> เป็นติวเตอร์
                        </div>
                    </label>
                </div>
                
                <div class="space-y-4 bg-brand-50/50 p-5 rounded-2xl border border-brand-100 text-center text-xs sm:text-sm text-neutral/70">
                    <div class="w-10 h-10 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-1 animate-pulse">
                        <i data-lucide="shield-check" class="w-5 h-5"></i>
                    </div>
                    <p class="leading-relaxed">เพื่อความปลอดภัยและป้องกันบัญชีปลอม ระบบเปิดรับการลงทะเบียนผ่าน <b>บัญชี Google ยืนยันตัวตนจริง เท่านั้น</b></p>
                </div>
                
                <div class="google-signin-btn-container mt-6 flex justify-center w-full min-h-[44px]"></div>
                
                <div class="text-center mt-8 pt-6 border-t border-brand-100">
                    <p class="text-sm text-neutral/60 font-medium">มีบัญชีอยู่แล้ว? <button onclick="app.switchAuthView('login')" class="text-${cTheme} font-bold hover:underline ml-1 transition-colors">เข้าสู่ระบบ</button></p>
                </div>
            </div>
        </div>
    `;
}

export function switchAuthView(view) {
    state.authView = view;
    app.render();
}

export function switchAuthRole(role) {
    state.authRole = role;
    state.currentRole = role;
    app.updateAvatar(role);
    app.render();
}

export function initializeGoogleSignIn() {
    if (!window.google || !state.googleClientId) {
        console.log("Google SDK not loaded or client ID missing");
        return;
    }
    
    try {
        window.google.accounts.id.initialize({
            client_id: state.googleClientId,
            use_fedcm_for_prompt: true,
            callback: async (response) => {
                await app.handleGoogleSignIn(response.credential);
            }
        });
        
        const containers = document.querySelectorAll(".google-signin-btn-container");
        containers.forEach(container => {
            const screenWidth = window.innerWidth;
            let btnWidth = 360; // Default width for larger screens
            if (screenWidth < 480) {
                // Scale down button width dynamically, ensuring it fits inside the card padding
                btnWidth = Math.min(360, Math.max(200, screenWidth - 80));
            }
            window.google.accounts.id.renderButton(
                container,
                { theme: "outline", size: "large", width: btnWidth.toString(), shape: "pill" }
            );
        });
    } catch (err) {
        console.error("Google Sign-In initialization failed:", err);
    }
}

export async function handleGoogleSignIn(idToken) {
    try {
        const response = await fetch("http://127.0.0.1:8000/api/users/login/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id_token: idToken,
                role: state.currentRole
            })
        });

        if (!response.ok) {
            const err = await response.json();
            app.showToast(err.detail || 'การยืนยันตัวตนผ่าน Google ล้มเหลว', 'error');
            return;
        }

        const data = await response.json();
        localStorage.setItem("access_token", data.access_token);

        const meResponse = await fetch("http://127.0.0.1:8000/api/users/me", {
            headers: { "Authorization": `Bearer ${data.access_token}` }
        });

        if (meResponse.ok) {
            const user = await meResponse.json();
            state.isAuthenticated = true;
            state.userRole = user.role || state.currentRole;
            state.currentRole = user.role || state.currentRole;
            state.currentStudentName = user.name || user.email;
            state.currentStudentId = user.id || user._id;
            state.currentEmail = user.email;
            state.avatarUrl = user.avatar_url;
            state.currentUserInviteCode = user.invite_code;
            state.linkedTutorId = user.linked_tutor_id;
            state.subscription = {
                plan: user.subscription_plan || 'ทดลองใช้ฟรี',
                daysLeft: user.subscription_days_left !== undefined ? user.subscription_days_left : 14
            };
            state.currentTab = state.currentRole === 'admin' ? 'overview' : 'browse';

            await Promise.all([
                app.fetchClasses(),
                app.fetchMyBookings(),
                app.fetchSettings(),
                app.fetchAttendance(),
                app.fetchNetwork()
            ]);

            app.render();
            const roleSelector = document.getElementById('role-selector');
            if (roleSelector) roleSelector.value = state.currentRole;
            app.updateAvatar(state.currentRole);
            app.showToast(`เข้าสู่ระบบผ่าน Google สำเร็จ ยินดีต้อนรับ!`, 'success');
        } else {
            localStorage.removeItem("access_token");
            app.showToast('ดึงข้อมูลโปรไฟล์ Google ล้มเหลว', 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์หลังบ้านล้มเหลว', 'error');
    }
}

export function logout() {
    localStorage.removeItem("access_token");
    state.isAuthenticated = false;
    state.userRole = 'student';
    state.currentRole = 'student';
    state.authRole = 'student';
    state.currentStudentId = null;
    state.currentStudentName = '';
    state.currentEmail = '';
    state.avatarUrl = null;
    state.currentUserInviteCode = '';
    state.linkedTutorId = null;
    app.resetSessionData();
    state.authView = 'login';
    const profileModal = document.getElementById('profile_modal');
    if (profileModal?.open) profileModal.close();
    app.showToast('ออกจากระบบเรียบร้อย', 'info');
    app.render();
}

