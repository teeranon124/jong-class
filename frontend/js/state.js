export const state = {
    isAuthenticated: false,
    authView: 'login', 
    authRole: 'student', // ค่าเริ่มต้นในหน้า Login/Register
    googleClientId: null,
    userRole: 'student', // บทบาทจริงจาก DB
    tempEmail: undefined, // สำหรับเก็บข้อมูลพิมพ์ค้างไว้ตอนสลับโหมด
    tempPass: undefined,
    tempName: undefined,
    
    currentRole: 'student', 
    currentTab: 'browse',
    adminClassTab: 'upcoming', 
    adminSettingsTab: 'institute',
    studentClassTab: 'overview',
    studentScheduleTab: 'upcoming',
    currentAdminClassId: null,
    currentStudentId: null,
    currentStudentName: '',
    currentEmail: '',
    avatarUrl: null,
    linkedTutorId: null,
    tutorSearchQuery: '',
    tutorSearchResults: [],
    
    institute: {
        name: '',
        bankName: '',
        accountName: '',
        accountNumber: '',
        payment_timeout_minutes: 5,
        auto_accept_followers: true
    },

    subscription: {
        plan: 'ทดลองใช้ฟรี',
        daysLeft: 14
    },
    
    classes: [], 
    bookings: [], 
    network: [],
    tutorSettings: {}, // {tutorId: {name, bankName, etc}}
    
    attendance: [],
    expiredBookingRefreshState: {},
    bookingExpiryRefreshPending: false,
    timerInterval: null
};
