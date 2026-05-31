import { state } from '../state.js';
import { CONFIG } from '../config.js';

export function parseDateOnly(dateStr) {
    if (!dateStr) return 0;
    try {
        const d = new Date(dateStr);
        if(!isNaN(d.getTime())) {
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }
        return 0;
    } catch(e) { return 0; }
}

export function parseThaiDateTime(dtStr) {
    if(!dtStr) return 0;
    try {
        const isoLikeNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/;
        const normalized = isoLikeNoTz.test(dtStr) ? `${dtStr}Z` : dtStr;
        const d = new Date(normalized);
        const time = d.getTime();
        return isNaN(time) ? 0 : time;
    } catch(e) { return 0; }
}

export function isBookingExpired(booking, cls, now = Date.now()) {
    if (!booking || booking.status !== 'pending' || !cls) return false;
    const timeoutMins = app.getPaymentTimeoutMinutes(cls.tutorId);
    const createdAt = app.parseThaiDateTime(booking.created_date);
    if (!createdAt) return false;
    return now >= createdAt + (timeoutMins * 60 * 1000);
}

export function parseClassTime(dateStr, timeStr) {
    if(!dateStr || !timeStr) return 0;
    try {
        const d = new Date(dateStr);
        if(isNaN(d.getTime())) return 0;
        const [start] = timeStr.split(' - ');
        const [h, min] = start.split(':');
        d.setHours(h, min, 0, 0);
        return d.getTime();
    } catch (e) { return 0; }
}

export function getPaymentTimeoutMinutes(tutorId = null) {
    const tutorSettings = tutorId ? state.tutorSettings[tutorId] : null;
    const rawTimeout = tutorSettings?.payment_timeout_minutes ?? state.institute.payment_timeout_minutes;
    const timeout = Number(rawTimeout);
    if (Number.isFinite(timeout) && timeout > 0) return timeout;
    return 5;
}

export function startGlobalTimer() {
    if(state.timerInterval) clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        if (!state.isAuthenticated) return;
        const now = Date.now();
        const PAYMENT_TIMEOUT_MS = app.getPaymentTimeoutMinutes() * 60 * 1000;

        if (state.currentRole === 'student' && state.currentTab === 'payments') {
            app.updateCountdownUI(now, PAYMENT_TIMEOUT_MS);
        }
    }, 1000);
}

export function updateCountdownUI(now, _) {
    const timerElements = document.querySelectorAll('.payment-timer');
    let needsBookingRefresh = false;
    timerElements.forEach(el => {
        const dataCreated = el.getAttribute('data-created');
        const bookingId = el.closest('[data-booking-id]')?.getAttribute('data-booking-id');

        const booking = state.bookings.find(b => b.id === bookingId);
        const cls = booking ? state.classes.find(c => c.id === booking.classId) : null;
        const timeoutMins = app.getPaymentTimeoutMinutes(cls?.tutorId);
        const timeoutMs = timeoutMins * 60 * 1000;

        const createdAt = app.parseThaiDateTime(dataCreated);
        if (!createdAt) {
            el.innerText = 'กำลังโหลด...';
            return;
        }

        const expiresAt = createdAt + timeoutMs;
        const diff = expiresAt - now;
        const cardEl = el.closest('[data-booking-id]');
        const uploadBtn = cardEl?.querySelector('[data-booking-upload-btn="1"]');

        if(diff <= 0) {
            el.innerText = '00:00';
            if (booking && booking.status === 'pending' && !state.expiredBookingRefreshState[booking.id]) {
                state.expiredBookingRefreshState[booking.id] = Date.now();
                needsBookingRefresh = true;
                app.processExpiredBooking(booking.id).catch((e) => console.error('Expired booking timeout failed', e));
            }
            if (cardEl) {
                cardEl.classList.add('opacity-70', 'grayscale-[20%]');
                cardEl.classList.remove('border-error', 'shadow-soft');
                cardEl.classList.add('border-brand-200', 'bg-brand-50');
            }
            if (uploadBtn) {
                uploadBtn.disabled = true;
                uploadBtn.classList.remove('btn-error', 'text-white');
                uploadBtn.classList.add('bg-brand-200', 'text-neutral/50', 'border-none', 'cursor-not-allowed', 'opacity-80');
                uploadBtn.innerHTML = '<i data-lucide="clock-x" class="w-5 h-5 mr-1"></i> หมดเวลาแล้ว';
            }
        } else {
            if (booking && state.expiredBookingRefreshState[booking.id]) {
                delete state.expiredBookingRefreshState[booking.id];
            }
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            el.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if(diff < 60000) el.classList.add('timer-danger');
            if (cardEl) {
                cardEl.classList.remove('opacity-70', 'grayscale-[20%]', 'border-brand-200', 'bg-brand-50');
                cardEl.classList.add('border-error', 'shadow-soft');
            }
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.classList.remove('bg-brand-200', 'text-neutral/50', 'border-none', 'cursor-not-allowed', 'opacity-80');
                uploadBtn.classList.add('btn-error', 'text-white');
                uploadBtn.innerHTML = '<i data-lucide="upload-cloud" class="w-5 h-5 mr-1"></i> แนบสลิปและยืนยัน';
            }
        }
    });

    if (needsBookingRefresh && !state.bookingExpiryRefreshPending) {
        state.bookingExpiryRefreshPending = true;
        Promise.all([app.fetchMyBookings(), app.fetchClasses()])
            .then(() => {
                const shouldPatchBrowse = state.currentRole === 'student' && state.currentTab === 'browse' && app.updateStudentBrowseList();
                if (shouldPatchBrowse) return;
                const shouldRender = !document.querySelector('dialog[open]') && !['create', 'settings'].includes(state.currentTab);
                if (shouldRender) app.render();
            })
            .catch((e) => console.error('Expired booking refresh failed', e))
            .finally(() => {
                state.bookingExpiryRefreshPending = false;
            });
    }
}

export function updateAvatar(role) {
    const avatarBg = document.getElementById('user-avatar-bg');
    const avatarText = document.getElementById('user-avatar-text');
    const avatarImg = document.getElementById('user-avatar-img');
    const modalImg = document.getElementById('modal-avatar-img');
    const modalIcon = document.getElementById('modal-avatar-icon');
    if (!avatarBg || !avatarText) return;

    if (state.avatarUrl) {
        if (avatarImg) {
            avatarImg.src = state.avatarUrl;
            avatarImg.classList.remove('hidden');
        }
        avatarText.classList.add('hidden');
        if (modalImg) {
            modalImg.src = state.avatarUrl;
            modalImg.classList.remove('hidden');
        }
        if (modalIcon) modalIcon.classList.add('hidden');
    } else {
        if (avatarImg) {
            avatarImg.classList.add('hidden');
        }
        avatarText.classList.remove('hidden');
        if (role === 'admin') {
            avatarBg.className = 'bg-primary text-primary-content rounded-full w-8 h-8 sm:w-9 sm:h-9 shadow-soft flex items-center justify-center';
            avatarText.innerText = 'ครู';
        } else {
            avatarBg.className = 'bg-secondary text-secondary-content rounded-full w-8 h-8 sm:w-9 sm:h-9 shadow-soft flex items-center justify-center';
            avatarText.innerText = 'นร';
        }
        if (modalImg) modalImg.classList.add('hidden');
        if (modalIcon) modalIcon.classList.remove('hidden');
    }
}

export function switchTab(tab) {
    state.currentTab = tab;
    app.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

export async function switchRole(role) {
    // If role hasn't actually changed or not authenticated, just change the view role
    if (role === state.userRole || !state.isAuthenticated) {
        state.currentRole = role;
        app.updateAvatar(role);
        app.render();
        return;
    }

    // If authenticated and trying to switch to a different role, use the backend identity switch
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/switch-identity", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem("access_token", data.access_token);

            // Update state with new user identity
            const user = data.user;
            console.log("Switched identity to:", user);
            state.userRole = user.role;
            state.currentRole = user.role;
            state.currentStudentName = user.name;
            state.currentStudentId = user.id || user._id;
            state.currentEmail = user.email;
            state.avatarUrl = user.avatar_url;
            state.linkedTutorId = user.linked_tutor_id;
            state.currentUserInviteCode = user.invite_code;
            app.resetSessionData();
            state.subscription = {
                plan: user.subscription_plan || 'ทดลองใช้ฟรี',
                daysLeft: user.subscription_days_left !== undefined ? user.subscription_days_left : 14
            };

            app.showToast(`สลับเป็นมุมมอง ${user.role === 'admin' ? 'ครู' : 'นักเรียน'} เรียบร้อยแล้ว`, 'success');

            // Re-fetch everything for the new identity
            await Promise.all([
                app.fetchClasses(),
                app.fetchMyBookings(),
                app.fetchSettings(),
                app.fetchAttendance(),
                app.fetchNetwork()
            ]);

            state.currentTab = user.role === 'admin' ? 'overview' : 'browse';
            app.updateAvatar(user.role);
            app.render();
        } else {
            const err = await response.json();
            app.showToast(err.detail || 'ไม่สามารถสลับตัวตนได้', 'error');
        }
    } catch (e) {
        console.error("Switch identity failed", e);
        app.showToast('เชื่อมต่อเซิร์ฟเวอร์ล้มเหลว', 'error');
    }
}            

export function render() {
    try {
        app.renderNav();
        
        let html = '';
        
        if (app.contentDiv) {
            if (!state.isAuthenticated) {
                app.contentDiv.classList.add('justify-center');
                if (state.authView === 'login') html = app.getLoginView();
                else html = app.getRegisterView();
            } else {
                app.contentDiv.classList.remove('justify-center');
                if (state.currentRole === 'admin') {
                    if (state.currentTab === 'overview') {
                        html = app.getAdminOverview();
                        setTimeout(() => app.renderChart(), 0);
                    }
                    else if (state.currentTab === 'classes') html = app.getAdminClasses();
                    else if (state.currentTab === 'create') html = app.getAdminCreate();
                    else if (state.currentTab === 'approvals') html = app.getAdminApprovals();
                    else if (state.currentTab === 'settings') html = app.getAdminSettings();
                    else if (state.currentTab === 'subscription') html = app.getAdminSubscription();
                    else if (state.currentTab === 'network') html = app.getNetworkView();
                    else html = app.getAdminOverview(); // Fallback
                } else {
                    if (state.currentTab === 'browse') html = app.getStudentBrowse();
                    else if (state.currentTab === 'schedule') html = app.getStudentSchedule();
                    else if (state.currentTab === 'payments') html = app.getStudentPayments();
                    else if (state.currentTab === 'network') html = app.getNetworkView();
                    else html = app.getStudentBrowse(); // Fallback
                }
            }

            app.contentDiv.innerHTML = `<div class="animate-fade-in w-full">${html || ''}</div>`;
            if (window.lucide) lucide.createIcons({ root: app.contentDiv });
            if (!state.isAuthenticated) {
                setTimeout(() => app.initializeGoogleSignIn(), 50);
            }
        }
    } catch (e) {
        console.error("Render Error:", e);
        if(app.contentDiv) {
            app.contentDiv.innerHTML = `
                <div class="p-8 text-center bg-white rounded-[2rem] border border-error/20 shadow-sm mx-auto max-w-md mt-10">
                    <div class="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="alert-triangle" class="w-8 h-8"></i>
                    </div>
                    <h2 class="text-lg font-bold text-neutral mb-2">การแสดงผลผิดพลาด</h2>
                    <p class="text-sm text-neutral/50 mb-6">${e.message}</p>
                    <button onclick="location.reload()" class="btn btn-sm btn-outline rounded-full px-6">ลองใหม่อีกครั้ง</button>
                </div>
            `;
            if (window.lucide) lucide.createIcons({ root: app.contentDiv });
        }
    }
}

export function renderNav() {
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const planBtn = document.getElementById('plan-btn');
    const brandNameEl = document.getElementById('brand-name');
    const roleSelector = document.getElementById('role-selector');
    
    if (brandNameEl) {
        brandNameEl.innerText = state.institute.name || 'TutorBooking';
    }
    
    if (!state.isAuthenticated) {
        if (app.mobileNav) {
            app.mobileNav.innerHTML = '';
            app.mobileNav.classList.add('hidden');
        }
        if (app.desktopNav) {
            app.desktopNav.innerHTML = '';
        }
        if(logoutBtn) logoutBtn.classList.add('hidden');
        if(settingsBtn) settingsBtn.classList.add('hidden');
        if(planBtn) planBtn.classList.add('hidden');
        const profileTrigger = document.getElementById('profile-trigger');
        if(profileTrigger) profileTrigger.classList.add('hidden');
        if(roleSelector) roleSelector.style.display = 'none';
        return;
    }
    
    if (app.mobileNav) app.mobileNav.classList.remove('hidden');
    if(logoutBtn) logoutBtn.classList.remove('hidden');
    const profileTrigger = document.getElementById('profile-trigger');
    if(profileTrigger) profileTrigger.classList.remove('hidden');
    
    if (roleSelector) {
        if (state.userRole === 'admin' || state.linkedTutorId) {
            roleSelector.style.display = 'inline-block';
            roleSelector.value = state.currentRole;
        } else {
            roleSelector.style.display = 'none';
        }
    }
    
    if(settingsBtn) {
        if(state.currentRole === 'admin') {
            settingsBtn.classList.remove('hidden');
            if(planBtn) planBtn.classList.remove('hidden');
        } else {
            settingsBtn.classList.add('hidden');
            if(planBtn) planBtn.classList.add('hidden');
        }
    }

    const adminTabs = [
        { id: 'overview', icon: 'pie-chart', label: 'ภาพรวม' },
        { id: 'classes', icon: 'calendar-days', label: 'ตารางสอน' },
        { id: 'create', icon: 'plus-square', label: 'สร้างคอร์ส' },
        { id: 'approvals', icon: 'check-square', label: 'อนุมัติจอง' },
        { id: 'network', icon: 'users', label: 'ลูกศิษย์' },
        { id: 'settings', icon: 'settings', label: 'ตั้งค่า' }
    ];
    const studentTabs = [
        { id: 'browse', icon: 'search', label: 'หาคอร์สเรียน' },
        { id: 'schedule', icon: 'calendar-days', label: 'ตารางเรียน' },
        { id: 'payments', icon: 'receipt', label: 'ชำระเงิน' },
        { id: 'network', icon: 'user-check', label: 'ติวเตอร์' }
    ];

    const tabs = state.currentRole === 'admin' ? adminTabs : studentTabs;
    const cColor = state.currentRole === 'admin' ? 'primary' : 'secondary';

    if (app.mobileNav) {
        app.mobileNav.innerHTML = tabs.map(tab => {
            const activeClass = state.currentTab === tab.id ? `active text-${cColor} bg-${cColor}/10 border-t-2 border-${cColor}` : 'text-neutral/50';
            return `
            <button onclick="app.switchTab('${tab.id}')" class="transition-all duration-300 ${activeClass}">
                <i data-lucide="${tab.icon}" class="w-5 h-5"></i>
                <span class="btm-nav-label text-[10px] font-medium mt-1">${tab.label}</span>
            </button>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons({ root: app.mobileNav });
    }

    if (app.desktopNav) {
        app.desktopNav.innerHTML = tabs.map(tab => {
            const activeClass = state.currentTab === tab.id ? `btn-${cColor} text-white shadow-soft` : 'btn-ghost text-neutral/70';
            return `
            <button onclick="app.switchTab('${tab.id}')" class="btn btn-sm ${activeClass} rounded-full px-6 transition-all">
                <i data-lucide="${tab.icon}" class="w-4 h-4 mr-1"></i> ${tab.label}
            </button>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons({ root: app.desktopNav });
    }
}

export function copyToClipboard(text, message = 'คัดลอกลงคลิปบอร์ดแล้ว') {
    try {
        navigator.clipboard.writeText(text);
        app.showToast(message, 'success');
    } catch(e) {
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        app.showToast(message, 'success');
    }
}

export function showConfirm(title, message, btnText, btnClass, actionType, actionData) {
    document.getElementById('confirm_title').innerText = title;
    document.getElementById('confirm_message').innerHTML = message;
    
    const btn = document.getElementById('confirm_btn');
    btn.innerText = btnText;
    btn.className = `btn flex-1 rounded-full text-white shadow-md border-none font-medium transition-transform active:scale-95 ${btnClass}`;
    
    const iconContainer = document.getElementById('confirm_icon_container');
    iconContainer.className = 'mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-4 transition-colors ';
    
    let iconName = 'alert-circle';
    if (actionType === 'book') {
        iconContainer.className += 'bg-secondary/10 text-secondary';
        iconName = 'calendar-plus';
    } else if (actionType === 'approve') {
        iconContainer.className += 'bg-success/10 text-success';
        iconName = 'check-circle-2';
    } else if (actionType === 'reject') {
        iconContainer.className += 'bg-error/10 text-error';
        iconName = 'x-circle';
    } else if (actionType === 'upgrade') {
        iconContainer.className += 'bg-primary/10 text-primary';
        iconName = 'zap';
    }
    
    document.getElementById('confirm_icon').setAttribute('data-lucide', iconName);
    lucide.createIcons({ root: document.getElementById('confirm_modal') });
    
    app.pendingAction = actionType;
    app.pendingActionData = actionData;
    
    document.getElementById('confirm_modal').showModal();
}

export function executeConfirm() {
    const action = app.pendingAction;
    const data = app.pendingActionData;
    document.getElementById('confirm_modal').close();

    if (action === 'book') app.bookClass(data);
    else if (action === 'approve') app.approveBooking(data);
    else if (action === 'reject') app.rejectBooking(data);
    else if (action === 'upgrade') app.upgradePlan(data);
    else if (action === 'unfollow') app.confirmUnfollow(data);
    else if (action === 'remove_follower') app.confirmRemoveFollower(data);

    app.pendingAction = null;
    app.pendingActionData = null;
}

export async function confirmUnfollow(inviteCode) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/unfollow", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ invite_code: inviteCode })
        });
        if (response.ok) {
            const data = await response.json();
            app.showToast(data.message || 'เลิกติดตามเรียบร้อยแล้ว', 'success');
            state.tutorSearchResults = (state.tutorSearchResults || []).map((tutor) => {
                if (tutor.invite_code !== inviteCode) return tutor;
                return {
                    ...tutor,
                    is_following: false,
                    is_pending: false,
                };
            });
            await app.fetchNetwork();
            await app.fetchClasses();
            app.render();
        } else {
            const data = await response.json();
            app.showToast(data.detail || data.message || 'เลิกติดตามไม่สำเร็จ', 'error');
        }
    } catch (e) {
        app.showToast('เลิกติดตามล้มเหลว', 'error');
    }
}

export async function confirmRemoveFollower(studentId) {
    try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("http://127.0.0.1:8000/api/users/remove-follower", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ student_id: studentId })
        });
        if (response.ok) {
            app.showToast('ลบลูกศิษย์เรียบร้อยแล้ว', 'success');
            await app.fetchNetwork();
            app.render();
        }
    } catch (e) {
        app.showToast('ลบลูกศิษย์ล้มเหลว', 'error');
    }
}

export function openEditClassModal(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;

    const toInputDate = (dStr) => {
        if(!dStr) return '';
        if(dStr.includes('-')) return dStr.split('T')[0]; // ISO format
        const [d, m, y] = dStr.split('/');
        const year = parseInt(y) > 2500 ? parseInt(y) - 543 : y;
        return `${year}-${m}-${d}`;
    };

    app.activeEditClassId = classId;
    document.getElementById('edit-title').value = cls.title;
    document.getElementById('edit-open-date').value = toInputDate(cls.openDate);
    document.getElementById('edit-close-date').value = toInputDate(cls.closeDate);

    const container = document.getElementById('edit-schedule-container');
    container.innerHTML = '';
    cls.schedules.forEach(sch => {
        const row = document.createElement('div');
        row.className = 'grid grid-cols-12 gap-1 mb-2 schedule-row items-center';
        
        const timeParts = sch.time.split(' - ');
        const start = timeParts[0] || '';
        const end = timeParts[1] || '';

        row.innerHTML = `
            <div class="col-span-1 flex items-center justify-center font-bold text-primary text-[9px] sch-badge bg-primary/10 rounded-lg h-full">-</div>
            <div class="col-span-4"><input type="date" class="sch-date input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" value="${toInputDate(sch.date)}" onchange="app.sortAndLabelSchedules('edit-schedule-container')" /></div>
            <div class="col-span-3"><input type="time" class="sch-start input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" value="${start}" onchange="app.sortAndLabelSchedules('edit-schedule-container')" /></div>
            <div class="col-span-3"><input type="time" class="sch-end input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" value="${end}" onchange="app.sortAndLabelSchedules('edit-schedule-container')" /></div>
            <div class="col-span-1 flex items-center justify-center"><button type="button" onclick="this.parentElement.parentElement.remove(); app.sortAndLabelSchedules('edit-schedule-container')" class="text-error/50 hover:text-error"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>
        `;
        container.appendChild(row);
    });

    document.getElementById('edit-seats').value = cls.maxSeats;
    document.getElementById('edit-price').value = cls.price;

    lucide.createIcons({ root: container });
    app.sortAndLabelSchedules('edit-schedule-container');
    document.getElementById('edit_class_modal').showModal();
}

export async function openUploadModal(bookingId) {
    app.activeUploadBookingId = bookingId;
    
    // Clear fields first so student doesn't see old values
    document.getElementById('ubank-name').innerText = 'กำลังโหลด...';
    document.getElementById('ubank-acc-name').innerText = 'กำลังโหลด...';
    document.getElementById('ubank-acc-num').innerText = 'กำลังโหลด...';
    
    document.getElementById('upload_text').innerText = 'คลิกเพื่อเลือกไฟล์สลิปจากอัลบั้ม';
    document.getElementById('upload_modal').showModal();

    try {
        const booking = state.bookings.find(b => b.id === bookingId);
        if (booking) {
            const cls = state.classes.find(c => c.id === booking.classId);
            const tutorId = (cls && cls.tutorId) ? cls.tutorId : 'tutor@example.com';
            
            const response = await fetch(`http://127.0.0.1:8000/api/settings/${tutorId}`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('ubank-name').innerText = data.bankName || '-';
                document.getElementById('ubank-acc-name').innerText = data.accountName || '-';
                document.getElementById('ubank-acc-num').innerText = data.accountNumber || '-';
                return;
            }
        }
        
        document.getElementById('ubank-name').innerText = 'ไม่มีข้อมูล';
        document.getElementById('ubank-acc-name').innerText = 'ไม่มีข้อมูล';
        document.getElementById('ubank-acc-num').innerText = 'ไม่มีข้อมูล';
    } catch (e) {
        console.error("Failed to fetch tutor settings", e);
        document.getElementById('ubank-name').innerText = 'ล้มเหลว';
        document.getElementById('ubank-acc-name').innerText = 'ล้มเหลว';
        document.getElementById('ubank-acc-num').innerText = 'ล้มเหลว';
    }
}

export function viewSlip(url) {
    document.getElementById('slip_image').src = url || 'https://placehold.co/400x600/f2e8e5/65c3c8?text=No+Image';
    document.getElementById('slip_modal').showModal();
}

export function showProfileModal() {
    if (!state.isAuthenticated) return;
    document.getElementById('profile-username').value = state.currentStudentName;
    const modalImg = document.getElementById('modal-avatar-img');
    const modalIcon = document.getElementById('modal-avatar-icon');
    if (state.avatarUrl) {
        if (modalImg) {
            modalImg.src = state.avatarUrl;
            modalImg.classList.remove('hidden');
        }
        if (modalIcon) modalIcon.classList.add('hidden');
    } else {
        if (modalImg) modalImg.classList.add('hidden');
        if (modalIcon) modalIcon.classList.remove('hidden');
    }
    const pEl = document.getElementById('profile-password');
    const cpEl = document.getElementById('profile-confirm-password');
    if (pEl) pEl.value = '';
    if (cpEl) cpEl.value = '';
    document.getElementById('profile_modal').showModal();
}

export function calculateTotalHours(schedules) {
    if (!schedules || schedules.length === 0) return 0;
    let totalMin = 0;
    schedules.forEach(sch => {
        if (!sch.time || !sch.time.includes(' - ')) return;
        const parts = sch.time.split(' - ');
        if (parts.length !== 2) return;
        const startParts = parts[0].split(':');
        const endParts = parts[1].split(':');
        if (startParts.length !== 2 || endParts.length !== 2) return;
        const startMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1], 10);
        const endMinutes = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1], 10);
        if (endMinutes > startMinutes) {
            totalMin += (endMinutes - startMinutes);
        }
    });
    if (totalMin <= 0) return 0;
    const hours = totalMin / 60;
    return Number(hours.toFixed(2));
}

export function displayDate(isoStr) {
    if(!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if(isNaN(d.getTime())) return '';
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear() + 543;
        return `${day}/${month}/${year}`;
    } catch(e) { return ''; }
}

export function displayDateTime(isoStr) {
    if(!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if(isNaN(d.getTime())) return '';
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear() + 543;
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch(e) { return ''; }
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let alertClass = 'bg-neutral text-white';
    let iconName = 'info';
    
    if (type === 'success') {
        alertClass = 'bg-primary text-white shadow-soft';
        iconName = 'check-circle-2';
    } else if (type === 'error') {
        alertClass = 'bg-error text-white shadow-soft';
        iconName = 'alert-circle';
    }

    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `flex items-center gap-3 px-5 py-3.5 rounded-full shadow-lg transform transition-all duration-300 translate-y-[-100%] opacity-0 text-sm font-medium ${alertClass}`;
    toast.innerHTML = `<i data-lucide="${iconName}" class="w-5 h-5"></i><span>${message}</span>`;
    
    container.appendChild(toast);
    lucide.createIcons({ root: toast });

    setTimeout(() => toast.classList.remove('translate-y-[-100%]', 'opacity-0'), 10);

    setTimeout(() => {
        const toastEl = document.getElementById(toastId);
        if (toastEl) {
            toastEl.classList.add('translate-y-[-100%]', 'opacity-0');
            setTimeout(() => toastEl.remove(), 300);
        }
    }, 3000);
}

export function sortAndLabelSchedules(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const rows = Array.from(container.querySelectorAll('.schedule-row'));
    
    rows.sort((a, b) => {
        const ad = a.querySelector('.sch-date').value || '9999-99-99';
        const ast = a.querySelector('.sch-start').value || '23:59';
        const bd = b.querySelector('.sch-date').value || '9999-99-99';
        const bst = b.querySelector('.sch-start').value || '23:59';
        return (ad + 'T' + ast).localeCompare(bd + 'T' + bst);
    });
    
    rows.forEach((row, index) => {
        container.appendChild(row); // Reorders DOM
        const badge = row.querySelector('.sch-badge');
        if(badge) badge.innerText = `${index + 1}/${rows.length}`;
    });
}
