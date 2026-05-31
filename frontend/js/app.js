import { state } from './state.js';
import { CONFIG } from './config.js';
import { login, register, fetchClasses, fetchMyBookings, processExpiredBookings, processExpiredBooking, fetchSettings, fetchTutorSettings, fetchAttendance, fetchNetwork, followTutor, searchTutors, followTutorByInviteCode, toggleAutoAccept, approveFollower, rejectFollower, saveInstituteSettings, requestUpgradePlan, upgradePlan, toggleAttendance, unfollowTutor, removeFollower, requestBookClass, requestApproveBooking, requestRejectBooking, saveEditClass, createClass, bookClass, approveBooking, rejectBooking, handleFileSelect, confirmUpload, saveProfile } from './api.js';
import { getLoginView, getRegisterView, switchAuthView, switchAuthRole, initializeGoogleSignIn, handleGoogleSignIn, logout } from './components/auth-view.js';
import { getStudentBrowse, renderStudentBrowseList, updateStudentBrowseList, getStudentSchedule, getStudentPayments, switchStudentClassTab, switchStudentScheduleTab } from './components/student-view.js';
import { getAdminOverview, getAdminClasses, getAdminCreate, getAdminApprovals, getAdminSettings, getNetworkView, getAdminSubscription, switchAdminClassTab, switchAdminSettingsTab, clearTutorSearch, addScheduleRow, renderChart } from './components/admin-view.js';
import { parseDateOnly, parseThaiDateTime, isBookingExpired, parseClassTime, getPaymentTimeoutMinutes, startGlobalTimer, updateCountdownUI, updateAvatar, switchTab, switchRole, render, renderNav, copyToClipboard, showConfirm, executeConfirm, confirmUnfollow, confirmRemoveFollower, openEditClassModal, openUploadModal, viewSlip, showProfileModal, calculateTotalHours, displayDate, displayDateTime, showToast, sortAndLabelSchedules } from './components/ui-utils.js';

export const app = {
    resetSessionData() {
        state.classes = [];
        state.bookings = [];
        state.network = [];
        state.tutorSettings = {};
        state.attendance = [];
        state.expiredBookingRefreshState = {};
        state.tutorSearchQuery = '';
        state.tutorSearchResults = [];
        state.subscription = {
            plan: 'ทดลองใช้ฟรี',
            daysLeft: 14
        };
        state.institute = {
            name: '',
            bankName: '',
            accountName: '',
            accountNumber: '',
            payment_timeout_minutes: 5,
            auto_accept_followers: true
        };
        state.adminClassTab = 'upcoming';
        state.adminSettingsTab = 'institute';
        state.studentClassTab = 'bookings';
    },

    async init() {
        this.contentDiv = document.getElementById('app-content');
        this.mobileNav = document.getElementById('mobile-nav');
        this.desktopNav = document.getElementById('desktop-nav');
        
        // Fetch Auth Config (Google Client ID) from backend dynamically
        try {
            const configRes = await fetch("http://127.0.0.1:8000/api/users/auth/config");
            if (configRes.ok) {
                const configData = await configRes.json();
                state.googleClientId = configData.google_client_id;
                console.log("Loaded Google Auth Client ID:", state.googleClientId);
            }
        } catch (e) {
            console.error("Failed to load auth config from backend", e);
        }
        
        this.activeUploadBookingId = null;
        this.pendingAction = null;
        this.pendingActionData = null;

        this.todayDate = new Date(2026, 4, 25).getTime(); 

        // Check for saved token to restore session
        const token = localStorage.getItem("access_token");
        if (token) {
            try {
                const res = await fetch("http://127.0.0.1:8000/api/users/me", {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (res.ok) {
                    const user = await res.json();
                    console.log("Logged in user:", user);
                    state.isAuthenticated = true;
                    state.userRole = user.role || 'student';
                    state.currentRole = user.role || 'student';
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
                    this.updateAvatar(state.currentRole);
                } else {
                    localStorage.removeItem("access_token");
                }
            } catch (e) {
                console.error("Auto login failed", e);
            }
        }

        // NOW fetch data after role is correctly identified
        await Promise.all([
            this.fetchClasses(),
            this.fetchMyBookings(),
            this.fetchSettings(),
            this.fetchAttendance(),
            this.fetchNetwork()
        ]);

        this.render();
        this.startGlobalTimer();
        if (window.lucide) lucide.createIcons();
    },

    requestQuickUpload(bookingId) {
        const booking = state.bookings.find(b => b.id === bookingId);
        const cls = booking ? state.classes.find(c => c.id === booking.classId) : null;
        if (this.isBookingExpired(booking, cls)) {
            this.showToast('หมดเวลาแล้ว', 'error');
            return;
        }
        this.activeUploadBookingId = bookingId;
        document.getElementById('quick-upload-input').click();
    },

    async handleQuickUpload(input) {
        if(!input.files || !input.files[0] || !this.activeUploadBookingId) return;
        
        const bookingId = this.activeUploadBookingId;
        const fileName = input.files[0].name;
        const mockUrl = `https://placehold.co/400x600/f2e8e5/65c3c8?text=Slip+${fileName.replace(/ /g, '+')}`;
        
        try {
            const token = localStorage.getItem("access_token");
            const response = await fetch(`http://127.0.0.1:8000/api/bookings/${bookingId}/slip`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ slipUrl: mockUrl })
            });
            if (response.ok) {
                this.showToast('แนบสลิปเรียบร้อย! รอติวเตอร์ตรวจสอบครับ', 'success');
                await Promise.all([this.fetchClasses(), this.fetchMyBookings()]);
                this.render();
            }
        } catch(e) {
            this.showToast('อัปโหลดล้มเหลว', 'error');
        } finally {
            input.value = '';
            this.activeUploadBookingId = null;
        }
    },


    // Bound imported functions
    login,
    register,
    fetchClasses,
    fetchMyBookings,
    processExpiredBookings,
    processExpiredBooking,
    fetchSettings,
    fetchTutorSettings,
    fetchAttendance,
    fetchNetwork,
    followTutor,
    searchTutors,
    followTutorByInviteCode,
    toggleAutoAccept,
    approveFollower,
    rejectFollower,
    saveInstituteSettings,
    requestUpgradePlan,
    upgradePlan,
    toggleAttendance,
    unfollowTutor,
    removeFollower,
    requestBookClass,
    requestApproveBooking,
    requestRejectBooking,
    saveEditClass,
    createClass,
    bookClass,
    approveBooking,
    rejectBooking,
    handleFileSelect,
    confirmUpload,
    saveProfile,
    getLoginView,
    getRegisterView,
    switchAuthView,
    switchAuthRole,
    initializeGoogleSignIn,
    handleGoogleSignIn,
    logout,
    getStudentBrowse,
    renderStudentBrowseList,
    updateStudentBrowseList,
    getStudentSchedule,
    getStudentPayments,
    getAdminOverview,
    getAdminClasses,
    getAdminCreate,
    getAdminApprovals,
    getAdminSettings,
    getNetworkView,
    getAdminSubscription,
    switchAdminClassTab,
    switchAdminSettingsTab,
    addScheduleRow,
    renderChart,
    parseDateOnly,
    parseThaiDateTime,
    isBookingExpired,
    parseClassTime,
    getPaymentTimeoutMinutes,
    startGlobalTimer,
    updateCountdownUI,
    updateAvatar,
    switchTab,
    switchRole,
    render,
    renderNav,
    copyToClipboard,
    showConfirm,
    executeConfirm,
    confirmUnfollow,
    confirmRemoveFollower,
    openEditClassModal,
    openUploadModal,
    viewSlip,
    showProfileModal,
    calculateTotalHours,
    displayDate,
    displayDateTime,
    showToast,
    sortAndLabelSchedules,
    switchStudentClassTab,
    switchStudentScheduleTab,
    switchAdminClassTab,
    switchAdminSettingsTab,
    clearTutorSearch
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
