import { state } from './state.js';
import { CONFIG } from './config.js';

export async function login() {
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-pass');
    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
        app.showToast('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email,
                password: password,
                role: state.currentRole
            })
        });

        if (!response.ok) {
            const err = await response.json();
            app.showToast(err.detail || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'error');
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
        } else {
            localStorage.removeItem("access_token");
            app.showToast('เข้าสู่ระบบไม่สำเร็จ', 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ backend ล้มเหลว', 'error');
    }
}

export async function register() {
    const emailEl = document.getElementById('auth-email');
    const passEl = document.getElementById('auth-pass');
    const nameEl = document.getElementById('auth-name');
    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim();
    const password = passEl.value;
    const name = nameEl ? nameEl.value.trim() : '';

    if (!email || !password) {
        app.showToast('กรุณากรอกอีเมลและตั้งรหัสผ่าน', 'error');
        return;
    }

    try {
        const response = await fetch("http://127.0.0.1:8000/api/users/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: email,
                password: password,
                confirm_password: password,
                role: state.authRole,
                name: name || email
            })
        });

        if (response.ok) {
            app.showToast('สมัครสมาชิกสำเร็จ ยินดีต้อนรับ!', 'success');
            app.switchAuthView('login');
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'การสมัครสมาชิกล้มเหลว', 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ backend ล้มเหลว', 'error');
    }
}

export async function fetchClasses() {
    try {
        const token = localStorage.getItem("access_token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        const endpoint = state.currentRole === 'admin' ? "/api/classes/me" : "/api/classes";
        const response = await fetch(`http://127.0.0.1:8000${endpoint}`, { headers });
        if (response.ok) {
            state.classes = await response.json();
        }
    } catch (e) {
        console.error("Failed to fetch classes", e);
    }
}

export async function fetchMyBookings() {
    try {
        const token = localStorage.getItem("access_token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        const response = await fetch("http://127.0.0.1:8000/api/bookings", { headers });
        if (response.ok) {
            state.bookings = await response.json();
            const activeBookingIds = new Set(state.bookings.map(b => b.id));
            Object.keys(state.expiredBookingRefreshState).forEach((bookingId) => {
                const booking = state.bookings.find(b => b.id === bookingId);
                if (!activeBookingIds.has(bookingId) || !booking || booking.status !== 'pending') {
                    delete state.expiredBookingRefreshState[bookingId];
                }
            });
        }
    } catch (e) {
        console.error("Failed to fetch bookings", e);
    }
}

export async function processExpiredBookings() {
    try {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        const response = await fetch("http://127.0.0.1:8000/api/bookings/process-expired", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const err = await response.json();
            console.error("Failed to process expired bookings:", err);
        }
    } catch (e) {
        console.error("Network error processing expired bookings", e);
    }
}

export async function processExpiredBooking(bookingId) {
    try {
        const token = localStorage.getItem("access_token");
        if (!token) return;
        const response = await fetch(`http://127.0.0.1:8000/api/bookings/${bookingId}/timeout`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) {
            const err = await response.json();
            console.error("Failed to timeout booking:", err);
        }
    } catch (e) {
        console.error("Network error timing out booking", e);
    }
}

export async function fetchSettings() {
    try {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const response = await fetch("http://127.0.0.1:8000/api/settings", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            state.institute = {
                name: data.name,
                bankName: data.bankName,
                accountName: data.accountName,
                accountNumber: data.accountNumber,
                payment_timeout_minutes: data.payment_timeout_minutes,
                auto_accept_followers: data.auto_accept_followers
            };
            const brandNameEl = document.getElementById('brand-name');
            if (brandNameEl) brandNameEl.innerText = data.name || 'TutorBooking';
        }
    } catch (e) {
        console.error("Failed to fetch settings", e);
    }
}

export async function fetchTutorSettings(tutorId) {
    if(!tutorId || state.tutorSettings[tutorId]) return;
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/settings/${tutorId}`);
        if (response.ok) {
            state.tutorSettings[tutorId] = await response.json();
            app.render();
        }
    } catch(e) { console.error("Failed to fetch tutor settings", e); }
}

export async function fetchAttendance() {
    try {
        const token = localStorage.getItem("access_token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        const response = await fetch("http://127.0.0.1:8000/api/attendance", { headers });
        if (response.ok) {
            state.attendance = await response.json();
        }
    } catch (e) {
        console.error("Failed to fetch attendance", e);
    }
}

export async function fetchNetwork() {
    try {
        const token = localStorage.getItem("access_token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        const response = await fetch("http://127.0.0.1:8000/api/users/network", { headers });
        if (response.ok) {
            const data = await response.json();
            // Standardize state.network based on role
            if (state.currentRole === 'admin') {
                state.network = {
                    followers: Array.isArray(data.followers) ? data.followers : [],
                    requests: Array.isArray(data.requests) ? data.requests : []
                };
            } else {
                state.network = Array.isArray(data) ? data : [];
            }
        }
    } catch (e) {
        console.error("Failed to fetch network", e);
    }
}

export async function followTutor() {
    const input = document.getElementById('invite-code-input');
    if(!input || !input.value.trim()) return;
    const code = input.value.trim().toUpperCase();
    
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ invite_code: code })
        });
        const data = await response.json();
        if (response.ok) {
            app.showToast(`ติดตาม ${data.tutor_name} เรียบร้อยแล้ว`, 'success');
            input.value = '';
            await app.fetchNetwork();
            await app.fetchClasses();
            app.render();
        } else {
            app.showToast(data.detail || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch(e) {
        console.error("Follow tutor failed", e);
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function searchTutors() {
    const input = document.getElementById('invite-code-input');
    const query = input ? input.value.trim() : '';

    state.tutorSearchQuery = query;
    state.tutorSearchResults = [];

    if (!query) {
        app.showToast('กรอกชื่อ อีเมล หรือรหัสเชิญเพื่อค้นหา', 'info');
        app.render();
        return;
    }

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`http://127.0.0.1:8000/api/users/search?q=${encodeURIComponent(query)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (response.ok) {
            state.tutorSearchResults = await response.json();
            app.showToast(`พบผลลัพธ์ ${state.tutorSearchResults.length} รายการ`, 'success');
            app.render();
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'ค้นหาติวเตอร์ไม่สำเร็จ', 'error');
        }
    } catch (e) {
        console.error('Search tutor failed', e);
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function followTutorByInviteCode(inviteCode) {
    if (!inviteCode) return;
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/follow", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ invite_code: inviteCode })
        });

        const data = await response.json();
        if (response.ok) {
            app.showToast(data.message || `ติดตาม ${data.tutor_name} เรียบร้อยแล้ว`, 'success');
            state.tutorSearchResults = (state.tutorSearchResults || []).map((tutor) => {
                if (tutor.invite_code !== inviteCode) return tutor;
                return {
                    ...tutor,
                    is_following: Boolean(data.auto_accepted),
                    is_pending: !data.auto_accepted,
                };
            });
            await app.fetchNetwork();
            await app.fetchClasses();
            app.render();
        } else {
            app.showToast(data.detail || 'เกิดข้อผิดพลาด', 'error');
        }
    } catch (e) {
        console.error('Follow tutor by code failed', e);
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function toggleAutoAccept(checked) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ 
                ...state.institute,
                auto_accept_followers: checked 
            })
        });
        if (response.ok) {
            state.institute.auto_accept_followers = checked;
            app.showToast(checked ? 'เปิดรับนักเรียนอัตโนมัติแล้ว' : 'ปิดรับอัตโนมัติ (ต้องยืนยันเอง)', 'success');
        }
    } catch (e) {
        app.showToast('อัปเกรดการตั้งค่าล้มเหลว', 'error');
    }
}

export async function approveFollower(id, name) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/approve-follower", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ student_id: id })
        });
        if (response.ok) {
            app.showToast(`รับ ${name} เข้าเป็นลูกศิษย์แล้ว`, 'success');
            await app.fetchNetwork();
            app.render();
        }
    } catch (e) {
        app.showToast('ดำเนินการล้มเหลว', 'error');
    }
}

export async function rejectFollower(id, name) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/reject-follower", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ student_id: id })
        });
        if (response.ok) {
            app.showToast(`ปฏิเสธคำขอจาก ${name} แล้ว`, 'info');
            await app.fetchNetwork();
            app.render();
        }
    } catch (e) {
        app.showToast('ดำเนินการล้มเหลว', 'error');
    }
}

export async function saveInstituteSettings() {
    const name = document.getElementById('setting-inst-name').value;
    const bankName = document.getElementById('setting-bank-name').value;
    const accName = document.getElementById('setting-acc-name').value;
    const accNum = document.getElementById('setting-acc-num').value;
    const timeoutEl = document.getElementById('setting-timeout');
    const timeout = timeoutEl ? parseInt(timeoutEl.value) : 5;

    if (!name || !bankName || !accName || !accNum) {
        app.showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error'); return;
    }

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/settings", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                bankName,
                accountName: accName,
                accountNumber: accNum,
                auto_accept_followers: state.institute.auto_accept_followers,
                payment_timeout_minutes: timeout
            })
        });

        if (response.ok) {
            const data = await response.json();
            state.institute = data;
            app.showToast('บันทึกการตั้งค่าระบบเรียบร้อย', 'success');
            app.renderNav();
            app.render();
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'บันทึกการตั้งค่าล้มเหลว', 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export function requestUpgradePlan(planName) {
    const msg = `คุณต้องการอัปเกรดเป็น <b>${planName}</b> ใช่หรือไม่?<br><span class="text-neutral/50 text-xs mt-2 block font-medium">ระบบจะเริ่มต้นใช้งานแพ็กเกจใหม่ให้คุณทันที</span>`;
    app.showConfirm('อัปเกรดแพ็กเกจ', msg, 'ยืนยันอัปเกรด', 'btn-primary shadow-soft', 'upgrade', planName);
}

export async function upgradePlan(planName) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/me/subscription", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ plan: planName })
        });

        if (response.ok) {
            const user = await response.json();
            state.subscription.plan = user.subscription_plan;
            state.subscription.daysLeft = user.subscription_days_left;
            app.showToast(`อัปเกรดเป็น ${planName} สำเร็จ!`, 'success');
            app.render();
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'อัปเกรดแพ็กเกจล้มเหลว', 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function toggleAttendance(classId, schIndex, studentId, checked, element) {
    const key = `${classId}_${schIndex}_${studentId}`;
    
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/attendance/toggle", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                id: key,
                classId,
                schIndex,
                studentId
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.checked) {
                if (!state.attendance.includes(key)) state.attendance.push(key);
            } else {
                state.attendance = state.attendance.filter(k => k !== key);
            }
            
            app.showToast(data.checked ? 'เช็คมาเรียนแล้ว' : 'ยกเลิกเช็คชื่อ (ขาด)', data.checked ? 'success' : 'info');

            if (element) {
                const container = element.closest('div.bg-white.border'); 
                if (container) {
                    const statusText = container.querySelector('.att-status-text');
                    if (data.checked) {
                        container.classList.add('border-primary/50', 'bg-primary/5');
                        if(statusText) {
                            statusText.className = 'text-xs font-bold att-status-text text-primary';
                            statusText.innerHTML = '<i data-lucide="check-circle" class="w-3 h-3 inline"></i> มาเรียน';
                        }
                    } else {
                        container.classList.remove('border-primary/50', 'bg-primary/5');
                        if(statusText) {
                            statusText.className = 'text-xs font-bold att-status-text text-neutral/40';
                            statusText.innerHTML = '<i data-lucide="x-circle" class="w-3 h-3 inline"></i> ขาดเรียน';
                        }
                    }
                    lucide.createIcons({ root: container });
                }
            }
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'เช็คชื่อล้มเหลว', 'error');
            if (element) element.checked = !checked;
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
        if (element) element.checked = !checked;
    }
}

export async function unfollowTutor(inviteCode, tutorName) {
    const msg = `คุณต้องการเลิกติดตาม <b>${tutorName}</b> ใช่หรือไม่? คอร์สเรียนของติวเตอร์ท่านนี้จะหายไปจากหน้าหาคอร์สเรียนของคุณ`;
    app.showConfirm('เลิกติดตาม', msg, 'ยืนยันเลิกติดตาม', 'btn-error shadow-error/30', 'unfollow', inviteCode);
}

export async function removeFollower(studentId, studentName) {
    const msg = `คุณต้องการลบ <b>${studentName}</b> ออกจากรายชื่อลูกศิษย์ใช่หรือไม่? นักเรียนท่านนี้จะไม่เห็นคอร์สเรียนของคุณอีกต่อไป`;
    app.showConfirm('ลบลูกศิษย์', msg, 'ยืนยันการลบ', 'btn-error shadow-error/30', 'remove_follower', studentId);
}

export function requestBookClass(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;
    const timeoutMins = app.getPaymentTimeoutMinutes(cls.tutorId);
    
    const msg = `คุณต้องการจองคอร์ส <b>"${cls.title}"</b> ใช่หรือไม่?<br><span class="text-error text-xs mt-2 block font-medium">* จองแล้วจะต้องแนบสลิปชำระเงินภายใน ${timeoutMins} นาที หากเกินเวลาที่นั่งจะถูกยกเลิก</span>`;
    app.showConfirm('ยืนยันการจองคอร์ส', msg, 'ยืนยันการจอง', 'btn-secondary shadow-soft', 'book', classId);
}

export function requestApproveBooking(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const msg = `คุณตรวจสอบสลิปและต้องการอนุมัติที่นั่งให้กับ <b>${booking.studentName}</b> ใช่หรือไม่?`;
    app.showConfirm('อนุมัติการจอง', msg, 'อนุมัติการจอง', 'btn-success shadow-success/30', 'approve', bookingId);
}

export function requestRejectBooking(bookingId) {
    const booking = state.bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    const msg = `คุณต้องการปฏิเสธสลิปหรือยกเลิกการจองของ <b>${booking.studentName}</b> ใช่หรือไม่?<br><span class="text-error text-xs mt-2 block font-medium">* ที่นั่งจะถูกคืนเข้าสู่ระบบให้คนอื่นจองได้ต่อ</span>`;
    app.showConfirm('ปฏิเสธ / ยกเลิกการจอง', msg, 'ยืนยันปฏิเสธ', 'btn-error shadow-error/30', 'reject', bookingId);
}

export async function saveEditClass() {
    const cls = state.classes.find(c => c.id === app.activeEditClassId);
    if (!cls) return;

    const title = document.getElementById('edit-title').value;
    const openDateInput = document.getElementById('edit-open-date').value;
    const closeDateInput = document.getElementById('edit-close-date').value;
    const maxSeats = parseInt(document.getElementById('edit-seats').value);
    const price = parseInt(document.getElementById('edit-price').value);

    const scheduleRows = document.querySelectorAll('#edit-schedule-container .schedule-row');
    const schedules = [];
    let hasError = false;

    const formatDate = (dStr) => {
        const d = new Date(dStr);
        return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    scheduleRows.forEach(row => {
        const d = row.querySelector('.sch-date').value;
        const s = row.querySelector('.sch-start').value;
        const e = row.querySelector('.sch-end').value;
        if(d && s && e) {
            if(s >= e) hasError = true;
            schedules.push({ date: d, time: `${s} - ${e}` });
        }
    });

    schedules.sort((a, b) => {
        const aStart = a.time.split(' - ')[0];
        const bStart = b.time.split(' - ')[0];
        return (a.date + 'T' + aStart).localeCompare(b.date + 'T' + bStart);
    });

    if (!title || !openDateInput || !closeDateInput || !maxSeats || !price || schedules.length === 0) {
        app.showToast('กรุณากรอกข้อมูลและวันเรียนให้ครบถ้วน', 'error'); return;
    }
    if (hasError) {
        app.showToast('เวลาเลิกเรียนต้องอยู่หลังเวลาเริ่มเรียน', 'error'); return;
    }
    if (maxSeats < cls.bookedSeats) {
        app.showToast(`ไม่สามารถลดที่นั่งน้อยกว่าผู้จองปัจจุบัน (${cls.bookedSeats} คน) ได้`, 'error'); return;
    }

    const updatedPayload = {
        title: title,
        openDate: openDateInput,
        closeDate: closeDateInput,
        price: price,
        maxSeats: maxSeats,
        bookedSeats: cls.bookedSeats,
        status: cls.bookedSeats < maxSeats ? 'open' : 'full',
        schedules: schedules
    };

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`http://127.0.0.1:8000/api/classes/${cls.id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(updatedPayload)
        });

        if (response.ok) {
            app.showToast('บันทึกการแก้ไขคอร์สเรียบร้อยแล้ว', 'success');
            document.getElementById('edit_class_modal').close();
            await app.fetchClasses();
            app.render();
        } else {
            const err = await response.json();
            app.showToast(`เกิดข้อผิดพลาด: ${err.detail || 'โปรดลองอีกครั้ง'}`, 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function createClass() {
    const title = document.getElementById('create-title').value;
    const openDateInput = document.getElementById('create-open-date').value;
    const closeDateInput = document.getElementById('create-close-date').value;
    const maxSeats = parseInt(document.getElementById('create-seats').value);
    const price = parseInt(document.getElementById('create-price').value);

    const scheduleRows = document.querySelectorAll('#create-schedule-container .schedule-row');
    const schedules = [];
    let hasError = false;

    const formatDate = (dStr) => {
        const d = new Date(dStr);
        return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    scheduleRows.forEach(row => {
        const d = row.querySelector('.sch-date').value;
        const s = row.querySelector('.sch-start').value;
        const e = row.querySelector('.sch-end').value;
        if(d && s && e) {
            if(s >= e) hasError = true;
            schedules.push({ date: d, time: `${s} - ${e}` });
        }
    });

    schedules.sort((a, b) => {
        const aStart = a.time.split(' - ')[0];
        const bStart = b.time.split(' - ')[0];
        return (a.date + 'T' + aStart).localeCompare(b.date + 'T' + bStart);
    });

    if (!title || !openDateInput || !closeDateInput || !maxSeats || !price || schedules.length === 0) {
        app.showToast('กรุณากรอกข้อมูลและวันเรียนให้ครบถ้วน', 'error'); return;
    }
    if (hasError) {
        app.showToast('เวลาเลิกเรียนต้องอยู่หลังเวลาเริ่มเรียน', 'error'); return;
    }

    const newClass = {
        title: title, 
        openDate: openDateInput,
        closeDate: closeDateInput,
        schedules: schedules, 
        price: price,
        maxSeats: maxSeats, 
        bookedSeats: 0, 
        status: 'open'
    };

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/classes", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(newClass)
        });
        if (response.ok) {
            app.showToast('เปิดคอร์สใหม่เรียบร้อยแล้ว', 'success');
            await app.fetchClasses();
            app.switchTab('classes');
        } else {
            const err = await response.json();
            app.showToast(`เกิดข้อผิดพลาด: ${err.detail || 'โปรดลองอีกครั้ง'}`, 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function bookClass(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls || cls.bookedSeats >= cls.maxSeats) return;
    const timeoutMins = app.getPaymentTimeoutMinutes(cls.tutorId);

    // Robust student data check
    const sId = state.currentStudentId;
    const sName = state.currentStudentName || state.currentEmail || 'นักเรียน';

    if (!sId) {
        app.showToast('กรุณาล็อกอินใหม่อีกครั้งเพื่อรีเซ็ตสิทธิ์การจอง', 'error');
        return;
    }

    const newBooking = {
        classId: classId,
        studentId: sId,
        studentName: sName,
        status: 'pending',
        slipUrl: null
    };

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(newBooking)
        });

        if (response.ok) {
            app.showToast(`จองคอร์สสำเร็จ! กรุณาชำระเงินภายใน ${timeoutMins} นาที`, 'success');
            await Promise.all([app.fetchClasses(), app.fetchMyBookings()]);
            app.switchTab('payments');
        } else {
            const err = await response.json();
            console.error("Booking Validation Error:", err);
            app.showToast(`เกิดข้อผิดพลาด: ${err.detail || 'โปรดลองใหม่'}`, 'error');
        }
    } catch (e) {
        console.error("Network error during booking", e);
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function approveBooking(bookingId) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`http://127.0.0.1:8000/api/bookings/${bookingId}/status`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: "approved" })
        });
        if (response.ok) {
            app.showToast(`อนุมัติการจองเรียบร้อย`, 'success');
            await app.fetchClasses();
            await app.fetchMyBookings();
            app.render();
        } else {
            const err = await response.json();
            app.showToast(`เกิดข้อผิดพลาด: ${err.detail}`, 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export async function rejectBooking(bookingId) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`http://127.0.0.1:8000/api/bookings/${bookingId}/status`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: "rejected" })
        });
        if (response.ok) {
            app.showToast(`ปฏิเสธการจองเรียบร้อย`, 'error');
            await app.fetchClasses();
            await app.fetchMyBookings();
            app.render();
        } else {
            const err = await response.json();
            app.showToast(`เกิดข้อผิดพลาด: ${err.detail}`, 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

export function handleFileSelect(event) {
    if (event.target.files && event.target.files.length > 0) {
        document.getElementById('upload_text').innerText = event.target.files[0].name;
    }
}

export async function confirmUpload() {
    if (app.activeUploadBookingId) {
        try {
            const token = localStorage.getItem("access_token");
            const response = await fetch(`http://127.0.0.1:8000/api/bookings/${app.activeUploadBookingId}/slip`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ slipUrl: 'https://placehold.co/400x600/f2e8e5/65c3c8?text=Bank+Transfer+Slip' })
            });
            if (response.ok) {
                app.showToast('ส่งสลิปเรียบร้อย รอคุณครูตรวจสอบ', 'success');
                document.getElementById('upload_modal').close();
                await app.fetchClasses();
                await app.fetchMyBookings();
                app.render();
            } else {
                const err = await response.json();
                app.showToast(`เกิดข้อผิดพลาด: ${err.detail}`, 'error');
            }
        } catch (e) {
            app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
        }
    }
}

export async function saveProfile() {
    const name = document.getElementById('profile-username').value.trim();
    const pEl = document.getElementById('profile-password');
    const cpEl = document.getElementById('profile-confirm-password');
    const password = pEl ? pEl.value : '';
    const confirmPassword = cpEl ? cpEl.value : '';

    if (!name) {
        app.showToast('กรุณากรอกชื่อผู้ใช้งาน', 'error');
        return;
    }

    const payload = { name };
    if (password) {
        if (password.length < 6) {
            app.showToast('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
            return;
        }
        if (password !== confirmPassword) {
            app.showToast('รหัสผ่านใหม่และรหัสยืนยันไม่ตรงกัน', 'error');
            return;
        }
        payload.password = password;
        payload.confirm_password = confirmPassword;
    }

    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/me", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const user = await response.json();
            state.currentStudentName = user.name || user.email;
            state.avatarUrl = user.avatar_url;
            
            app.showToast('บันทึกการแก้ไขโปรไฟล์สำเร็จ', 'success');
            document.getElementById('profile_modal').close();
            app.render();
            app.updateAvatar(state.currentRole);
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'การแก้ไขโปรไฟล์ล้มเหลว', 'error');
        }
    } catch (e) {
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}

