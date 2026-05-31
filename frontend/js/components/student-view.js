import { state } from '../state.js';
import { CONFIG } from '../config.js';

export function getStudentBrowse() {
    const now = Date.now();
    
    const sortedClasses = [...state.classes]
        .filter(c => c.status !== 'completed' && app.parseClassTime(c.schedules[0]?.date, c.schedules[0]?.time) >= now)
        .sort((a, b) => app.parseDateOnly(a.openDate) - app.parseDateOnly(b.openDate));

    const groupedByOpenDate = {};
    sortedClasses.forEach(c => {
        if(!groupedByOpenDate[c.openDate]) groupedByOpenDate[c.openDate] = [];
        groupedByOpenDate[c.openDate].push(c);
    });

    let timelineHtml = '';
    if (state.network.length === 0) {
        timelineHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm animate-fade-in">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="user-plus" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-4">คุณยังไม่ได้ติดตามติวเตอร์ท่านใด</div>
                <p class="text-xs text-neutral/50 mb-6 max-w-[200px] mx-auto">กรุณาติดตามติวเตอร์ด้วยรหัสเชิญ เพื่อดูคอร์สเรียนและกดจอง</p>
                <button onclick="app.switchTab('network')" class="btn btn-outline btn-sm rounded-full text-secondary border-secondary hover:bg-secondary hover:text-white hover:border-secondary px-8">ไปติดตามติวเตอร์</button>
            </div>
        `;
    } else if (Object.keys(groupedByOpenDate).length === 0) {
        timelineHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm animate-fade-in">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="calendar-x" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-1">ยังไม่มีคอร์สที่เปิดรับสมัครในขณะนี้</div>
                <p class="text-xs text-neutral/50">โปรดติดตามข่าวสารใหม่ๆ จากติวเตอร์ของคุณ</p>
            </div>
        `;
    } else {
        timelineHtml = `
            <div class="relative border-l-[3px] border-secondary/30 ml-3 md:ml-6 space-y-10 pb-8 animate-fade-in">
                ${Object.keys(groupedByOpenDate).map(openDate => {
                    const classesInDate = groupedByOpenDate[openDate];
                    const isOpenDatePast = app.parseDateOnly(openDate) <= now;
                    
                    return `
                    <div class="relative">
                        <div class="absolute w-5 h-5 bg-${isOpenDatePast ? 'secondary' : 'brand-200'} rounded-full -left-[11px] top-0 ring-[6px] ring-[#faf7f5] flex items-center justify-center shadow-sm">
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        
                        <div class="pl-8 font-bold text-neutral text-lg mb-5 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                            <div class="flex items-center gap-2">
                                <div class="p-1.5 rounded-lg ${isOpenDatePast ? 'bg-secondary/10 text-secondary' : 'bg-brand-100 text-neutral/50'}">
                                    <i data-lucide="megaphone" class="w-5 h-5"></i>
                                </div>
                                <span class="${isOpenDatePast ? 'text-secondary' : 'text-neutral/50'}">เปิดรับ: ${app.displayDate(openDate)}</span>
                            </div>
                            ${!isOpenDatePast ? `<span class="badge badge-sm badge-outline text-neutral/40 border-neutral/20 ml-9 md:ml-0 text-[10px]">เร็วๆ นี้</span>` : ''}
                        </div>
                        
                        <div class="pl-8 space-y-5">
                            ${classesInDate.map(cls => {
                                const myActiveBooking = state.bookings.find(b =>
                                    b.classId === cls.id &&
                                    b.studentId === state.currentStudentId &&
                                    ['pending', 'checking', 'approved'].includes(b.status)
                                );
                                const isFull = cls.bookedSeats >= cls.maxSeats;
                                const remainingSeats = cls.maxSeats - cls.bookedSeats;
                                
                                const timeToOpen = app.parseDateOnly(cls.openDate) > now;
                                const timeClosed = app.parseDateOnly(cls.closeDate) > 0 && (app.parseDateOnly(cls.closeDate) + 86399999) < now;
                                const totalHours = app.calculateTotalHours(cls.schedules);

                                const closeDateTime = app.parseDateOnly(cls.closeDate) + 86399999;
                                const timeLeftMs = closeDateTime - now;
                                let timeLeftStr = '';
                                if (timeLeftMs > 0 && !timeClosed && !timeToOpen) {
                                    const daysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
                                    if (daysLeft > 0) {
                                        timeLeftStr = `เหลืออีก ${daysLeft} วัน`;
                                    } else {
                                        const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
                                        if (hoursLeft > 0) {
                                            timeLeftStr = `เหลืออีก ${hoursLeft} ชม.`;
                                        } else {
                                            timeLeftStr = `เหลือไม่ถึง 1 ชม.`;
                                        }
                                    }
                                }

                                let buttonHtml = '';
                                let cardOpacity = '';

                                if (myActiveBooking) {
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-brand-100 text-neutral/50 font-medium h-10 border-none"><i data-lucide="check-circle" class="w-4 h-4 mr-1"></i> คุณจองคอร์สนี้แล้ว</button>`;
                                } else if (timeClosed) {
                                    cardOpacity = 'opacity-60 grayscale-[50%]';
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-base-200 text-neutral/50 font-bold h-10 border-none">ปิดรับสมัครแล้ว</button>`;
                                } else if (timeToOpen) {
                                    cardOpacity = 'opacity-80';
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-secondary/10 text-secondary font-bold h-10 border-none"><i data-lucide="lock" class="w-4 h-4 mr-1"></i> รอกดจองวันที่ ${app.displayDate(cls.openDate)}</button>`;
                                } else if (isFull) {
                                    cardOpacity = 'opacity-80';
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-error/10 text-error font-bold h-10 border-none">ที่นั่งเต็มแล้ว</button>`;
                                } else {
                                    buttonHtml = `<button onclick="app.requestBookClass('${cls.id}')" class="btn btn-secondary btn-block btn-sm rounded-full text-white shadow-soft font-medium h-10">จองคอร์สนี้ <span class="bg-white/20 px-2 py-0.5 rounded-md text-[10px] ml-1">ว่าง ${remainingSeats}</span></button>`;
                                }

                                return `
                                <div class="bg-white rounded-[2rem] p-5 border border-brand-100 shadow-card relative overflow-hidden transition-transform active:scale-[0.98] ${cardOpacity}">
                                    ${isFull && !timeToOpen && !timeClosed && !myActiveBooking ? '<div class="absolute top-0 right-0 bg-error text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold shadow-sm">ที่นั่งเต็ม</div>' : ''}
                                    
                                    <div class="text-xs text-primary font-bold mb-3 flex items-center gap-1">
                                        <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>
                                        <span>${cls.instituteName || 'TutorBooking'}</span>
                                        ${cls.tutorName ? `<span class="text-neutral/40 font-normal">(${cls.tutorName})</span>` : ''}
                                    </div>

                                    <div class="flex justify-between items-start mb-1.5">
                                        <div class="flex flex-row flex-wrap items-center gap-2">
                                            <div class="bg-secondary/10 text-secondary font-bold text-[10px] px-2.5 py-1 rounded-lg border border-secondary/20 flex items-center gap-1">
                                                <i data-lucide="users" class="w-3 h-3"></i> รับ ${cls.bookedSeats || 0}/${cls.maxSeats} คน
                                            </div>
                                            <div class="bg-brand-50 text-neutral/50 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-brand-100 flex items-center gap-1">
                                                <i data-lucide="calendar-off" class="w-3 h-3"></i> ปิดรับ: ${app.displayDate(cls.closeDate)}
                                            </div>
                                            ${totalHours ? `
                                            <div class="bg-primary/10 text-primary font-bold text-[10px] px-2.5 py-1 rounded-lg border border-primary/20 flex items-center gap-1">
                                                <i data-lucide="clock" class="w-3 h-3"></i> ${totalHours} ชม.
                                            </div>
                                            ` : ''}
                                            ${timeLeftStr ? `
                                            <div class="bg-error/10 text-error font-extrabold text-[10px] px-2.5 py-1 rounded-lg border border-error/20 flex items-center gap-1 animate-pulse">
                                                <i data-lucide="hourglass" class="w-3 h-3"></i> ${timeLeftStr}
                                            </div>
                                            ` : ''}
                                        </div>
                                        <div class="text-xl font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-xl">฿${cls.price}</div>
                                    </div>
                                    
                                    <h3 class="font-bold text-lg text-neutral mb-3 leading-tight pr-4">${cls.title}</h3>
                                    
                                    <div class="bg-brand-50 rounded-xl p-3 mb-4 border border-brand-100 text-xs text-neutral/70">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="font-bold text-neutral">เรียนทั้งหมด ${cls.schedules.length} ครั้ง ${totalHours ? `(${totalHours} ชั่วโมง)` : ''}</span>
                                            <span class="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md">เริ่ม ${app.displayDate(cls.schedules[0]?.date)}</span>
                                        </div>
                                        <div class="space-y-1.5 pt-2 border-t border-brand-200/50 max-h-24 overflow-y-auto pr-1">
                                            ${cls.schedules.map((sch, idx) => `
                                                <div class="flex justify-between items-center text-[11px]">
                                                    <span><span class="text-neutral/40 w-4 inline-block">${idx+1}.</span> ${app.displayDate(sch.date)}</span>
                                                    <span class="font-medium text-neutral/60">${sch.time}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                    
                                    <div class="pt-2 border-t border-dashed border-brand-200">
                                        ${buttonHtml}
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    `
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="space-y-6">
            <div class="mb-2">
                <h1 class="text-2xl font-bold text-neutral">หาคอร์สเรียน</h1>
                <p class="text-sm text-neutral/60">ดูคอร์สที่กำลังเปิด และที่จะเปิดเร็วๆ นี้</p>
            </div>

            <div class="pt-2">
                ${timelineHtml}
            </div>
        </div>
    `;
}

export function renderStudentBrowseList() {
    const now = Date.now();

    const sortedClasses = [...state.classes]
        .filter(c => c.status !== 'completed' && app.parseClassTime(c.schedules[0]?.date, c.schedules[0]?.time) >= now)
        .sort((a, b) => app.parseDateOnly(a.openDate) - app.parseDateOnly(b.openDate));

    const groupedByOpenDate = {};
    sortedClasses.forEach(c => {
        if(!groupedByOpenDate[c.openDate]) groupedByOpenDate[c.openDate] = [];
        groupedByOpenDate[c.openDate].push(c);
    });

    let timelineHtml = '';
    if (state.network.length === 0) {
        timelineHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm animate-fade-in">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="user-plus" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-4">คุณยังไม่ได้ติดตามติวเตอร์ท่านใด</div>
                <p class="text-xs text-neutral/50 mb-6 max-w-[200px] mx-auto">กรุณาติดตามติวเตอร์ด้วยรหัสเชิญ เพื่อดูคอร์สเรียนและกดจอง</p>
                <button onclick="app.switchTab('network')" class="btn btn-outline btn-sm rounded-full text-secondary border-secondary hover:bg-secondary hover:text-white hover:border-secondary px-8">ไปติดตามติวเตอร์</button>
            </div>
        `;
    } else if (Object.keys(groupedByOpenDate).length === 0) {
        timelineHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm animate-fade-in">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="calendar-x" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-1">ยังไม่มีคอร์สที่เปิดรับสมัครในขณะนี้</div>
                <p class="text-xs text-neutral/50">โปรดติดตามข่าวสารใหม่ๆ จากติวเตอร์ของคุณ</p>
            </div>
        `;
    } else {
        timelineHtml = `
            <div class="relative border-l-[3px] border-secondary/30 ml-3 md:ml-6 space-y-10 pb-8 animate-fade-in">
                ${Object.keys(groupedByOpenDate).map(openDate => {
                    const classesInDate = groupedByOpenDate[openDate];
                    const isOpenDatePast = app.parseDateOnly(openDate) <= now;

                    return `
                    <div class="relative">
                        <div class="absolute w-5 h-5 bg-${isOpenDatePast ? 'secondary' : 'brand-200'} rounded-full -left-[11px] top-0 ring-[6px] ring-[#faf7f5] flex items-center justify-center shadow-sm">
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                        </div>

                        <div class="pl-8 font-bold text-neutral text-lg mb-5 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                            <div class="flex items-center gap-2">
                                <div class="p-1.5 rounded-lg ${isOpenDatePast ? 'bg-secondary/10 text-secondary' : 'bg-brand-100 text-neutral/50'}">
                                    <i data-lucide="megaphone" class="w-5 h-5"></i>
                                </div>
                                <span class="${isOpenDatePast ? 'text-secondary' : 'text-neutral/50'}">เปิดรับ: ${app.displayDate(openDate)}</span>
                            </div>
                            ${!isOpenDatePast ? `<span class="badge badge-sm badge-outline text-neutral/40 border-neutral/20 ml-9 md:ml-0 text-[10px]">เร็วๆ นี้</span>` : ''}
                        </div>

                        <div class="pl-8 space-y-5">
                            ${classesInDate.map(cls => {
                                const myActiveBooking = state.bookings.find(b =>
                                    b.classId === cls.id &&
                                    b.studentId === state.currentStudentId &&
                                    ['pending', 'checking', 'approved'].includes(b.status)
                                );
                                const isFull = cls.bookedSeats >= cls.maxSeats;
                                const remainingSeats = cls.maxSeats - cls.bookedSeats;

                                const timeToOpen = app.parseDateOnly(cls.openDate) > now;
                                const timeClosed = app.parseDateOnly(cls.closeDate) > 0 && (app.parseDateOnly(cls.closeDate) + 86399999) < now;
                                const totalHours = app.calculateTotalHours(cls.schedules);

                                let buttonHtml = '';
                                let cardOpacity = '';

                                if (myActiveBooking) {
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-brand-100 text-neutral/50 font-medium h-10 border-none"><i data-lucide="check-circle" class="w-4 h-4 mr-1"></i> คุณจองคอร์สนี้แล้ว</button>`;
                                } else if (timeClosed) {
                                    cardOpacity = 'opacity-60 grayscale-[50%]';
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-base-200 text-neutral/50 font-bold h-10 border-none">ปิดรับสมัครแล้ว</button>`;
                                } else if (timeToOpen) {
                                    cardOpacity = 'opacity-80';
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-secondary/10 text-secondary font-bold h-10 border-none"><i data-lucide="lock" class="w-4 h-4 mr-1"></i> รอกดจองวันที่ ${app.displayDate(cls.openDate)}</button>`;
                                } else if (isFull) {
                                    cardOpacity = 'opacity-80';
                                    buttonHtml = `<button class="btn btn-block btn-sm rounded-full btn-disabled bg-error/10 text-error font-bold h-10 border-none">ที่นั่งเต็มแล้ว</button>`;
                                } else {
                                    buttonHtml = `<button onclick="app.requestBookClass('${cls.id}')" class="btn btn-secondary btn-block btn-sm rounded-full text-white shadow-soft font-medium h-10">จองคอร์สนี้ <span class="bg-white/20 px-2 py-0.5 rounded-md text-[10px] ml-1">ว่าง ${remainingSeats}</span></button>`;
                                }

                                return `
                                <div class="bg-white rounded-[2rem] p-5 border border-brand-100 shadow-card relative overflow-hidden transition-transform active:scale-[0.98] ${cardOpacity}">
                                    ${isFull && !timeToOpen && !timeClosed && !myActiveBooking ? '<div class="absolute top-0 right-0 bg-error text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold shadow-sm">ที่นั่งเต็ม</div>' : ''}

                                    <div class="flex justify-between items-start mb-3">
                                        <div class="flex flex-row flex-wrap items-center gap-2">
                                             <div class="bg-secondary/10 text-secondary font-bold text-[10px] px-2.5 py-1 rounded-lg border border-secondary/20 flex items-center gap-1">
                                                 <i data-lucide="users" class="w-3 h-3"></i> รับ ${cls.bookedSeats || 0}/${cls.maxSeats} คน
                                             </div>
                                             <div class="bg-brand-50 text-neutral/50 font-bold text-[10px] px-2.5 py-1 rounded-lg border border-brand-100 flex items-center gap-1">
                                                 <i data-lucide="calendar-off" class="w-3 h-3"></i> ปิดรับ: ${app.displayDate(cls.closeDate)}
                                             </div>
                                             ${totalHours ? `
                                             <div class="bg-primary/10 text-primary font-bold text-[10px] px-2.5 py-1 rounded-lg border border-primary/20 flex items-center gap-1">
                                                 <i data-lucide="clock" class="w-3 h-3"></i> ${totalHours} ชม.
                                             </div>
                                             ` : ''}
                                         </div>
                                        <div class="text-xl font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-xl">฿${cls.price}</div>
                                    </div>

                                    <div class="text-xs text-primary font-bold mb-1 flex items-center gap-1">
                                        <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>
                                        <span>${cls.instituteName || 'TutorBooking'}</span>
                                        ${cls.tutorName ? `<span class="text-neutral/40 font-normal">(${cls.tutorName})</span>` : ''}
                                    </div>
                                    <h3 class="font-bold text-lg text-neutral mb-3 leading-tight pr-4">${cls.title}</h3>

                                    <div class="bg-brand-50 rounded-xl p-3 mb-4 border border-brand-100 text-xs text-neutral/70">
                                        <div class="flex items-center justify-between mb-2">
                                            <span class="font-bold text-neutral">เรียนทั้งหมด ${cls.schedules.length} ครั้ง ${totalHours ? `(${totalHours} ชั่วโมง)` : ''}</span>
                                            <span class="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-md">เริ่ม ${app.displayDate(cls.schedules[0]?.date)}</span>
                                        </div>
                                        <div class="space-y-1.5 pt-2 border-t border-brand-200/50 max-h-24 overflow-y-auto pr-1">
                                            ${cls.schedules.map((sch, idx) => `
                                                <div class="flex justify-between items-center text-[11px]">
                                                    <span><span class="text-neutral/40 w-4 inline-block">${idx+1}.</span> ${app.displayDate(sch.date)}</span>
                                                    <span class="font-medium text-neutral/60">${sch.time}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <div class="pt-2 border-t border-dashed border-brand-200">
                                        ${buttonHtml}
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    `
                }).join('')}
            </div>
        `;
    }

    return timelineHtml;
}

export function updateStudentBrowseList() {
    const browseList = document.getElementById('browse-course-list');
    if (!browseList || state.currentRole !== 'student' || state.currentTab !== 'browse') return false;

    browseList.innerHTML = app.renderStudentBrowseList();
    if (window.lucide) lucide.createIcons({ root: browseList });
    return true;
}


export function getStudentSchedule() {
    const isPastTab = state.studentScheduleTab === 'past';
    const now = Date.now();
    let mySchedules = [];

    const activeBookings = state.bookings.filter(b => b.studentId === state.currentStudentId && ['pending', 'checking', 'approved'].includes(b.status));
    
    activeBookings.forEach(b => {
        const cls = state.classes.find(c => c.id === b.classId);
        if(cls) {
            cls.schedules.forEach((sch, idx) => {
                mySchedules.push({ ...cls, schDate: sch.date, schTime: sch.time, schIndex: idx });
            });
        }
    });

    const todayStart = new Date().setHours(0,0,0,0);
    
    mySchedules = mySchedules.filter(s => {
        const schTime = app.parseClassTime(s.schDate, s.schTime);
        return isPastTab ? (schTime < now) : (schTime >= now);
    });

    mySchedules.sort((a,b) => {
        const timeA = app.parseClassTime(a.schDate, a.schTime);
        const timeB = app.parseClassTime(b.schDate, b.schTime);
        return isPastTab ? timeB - timeA : timeA - timeB;
    });

    const groupedSchedule = {};
    mySchedules.forEach(s => {
        if(!groupedSchedule[s.schDate]) groupedSchedule[s.schDate] = [];
        groupedSchedule[s.schDate].push(s);
    });

    let scheduleHtml = '';
    
    if (Object.keys(groupedSchedule).length === 0) {
        scheduleHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="calendar-x" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-1">ไม่มีคลาสเรียน</div>
                <p class="text-xs text-neutral/50">คุณยังไม่มีคลาสเรียน${isPastTab ? 'ที่จบไปแล้ว' : 'ในเร็วๆ นี้'}</p>
            </div>
        `;
    } else {
        scheduleHtml = `
            <div class="relative border-l-[3px] border-secondary/30 ml-3 md:ml-6 space-y-8 pb-8 animate-fade-in">
                ${Object.keys(groupedSchedule).map(date => {
                    const schedulesInDate = groupedSchedule[date];
                    const isPast = app.parseDateOnly(date) < todayStart;
                    
                    return `
                    <div class="relative ${isPast ? 'opacity-60 grayscale-[30%]' : ''}">
                        <div class="absolute w-5 h-5 bg-${isPast ? 'brand-200' : 'secondary'} rounded-full -left-[11px] top-0 ring-[6px] ring-[#faf7f5] flex items-center justify-center shadow-sm">
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        
                        <div class="pl-8 font-bold text-neutral text-lg mb-4 flex items-center gap-2">
                            <div class="p-1.5 rounded-lg ${isPast ? 'bg-brand-100 text-neutral/50' : 'bg-secondary/10 text-secondary'}">
                                <i data-lucide="calendar-days" class="w-5 h-5"></i>
                            </div>
                            <span class="${isPast ? 'text-neutral/50' : ''}">${app.displayDate(date)}</span>
                        </div>
                        
                        <div class="pl-8 space-y-4">
                            ${schedulesInDate.map(sch => {
                                const attKey = `${sch.id}_${sch.schIndex}_${state.currentStudentId}`;
                                const isPresent = state.attendance.includes(attKey);
                                
                                return `
                                <div class="bg-white rounded-[1.5rem] p-4 border ${isPast ? 'border-brand-100' : 'border-secondary/20'} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-md">
                                    <div class="flex items-center gap-4">
                                        <div class="text-center w-14 shrink-0 bg-${isPast ? 'brand-50 text-neutral/50' : 'secondary/10 text-secondary'} rounded-2xl py-2 flex flex-col justify-center items-center">
                                            <div class="text-[10px] uppercase font-bold opacity-70">${app.displayDate(sch.schDate).split('/')[1] || ''}</div>
                                            <div class="text-xl font-black leading-none my-0.5">${app.displayDate(sch.schDate).split('/')[0] || ''}</div>
                                        </div>
                                        <div>
                                            <div class="text-[10px] font-bold text-neutral/40 mb-0.5">ครั้งที่ ${sch.schIndex + 1}/${sch.schedules.length} • เวลา ${sch.schTime} น.</div>
                                            <div class="font-bold text-neutral text-sm leading-tight">${sch.title}</div>
                                        </div>
                                    </div>
                                    ${isPastTab ? `
                                        <div class="md:text-right shrink-0">
                                            ${isPresent 
                                                ? `<div class="badge badge-success text-white font-bold badge-sm border-none shadow-sm gap-1 pl-1 pr-2 py-3 rounded-full"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> เข้าเรียนแล้ว</div>` 
                                                : `<div class="badge bg-neutral/10 text-neutral/50 font-bold badge-sm border-none gap-1 pl-1 pr-2 py-3 rounded-full"><i data-lucide="minus-circle" class="w-3.5 h-3.5"></i> ขาดเรียน</div>`
                                            }
                                        </div>
                                    ` : ''}
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="mb-8 text-center mt-4">
            <h1 class="text-2xl font-black text-neutral mb-1">ตารางเรียนของฉัน</h1>
            <p class="text-sm text-neutral/60">ตรวจสอบวันและเวลาเรียนของคอร์สทั้งหมด</p>
        </div>
        
        <div class="flex bg-white p-1.5 rounded-full w-full max-w-sm mx-auto shadow-sm border border-brand-100 relative z-10 mb-6">
            <button onclick="app.switchStudentScheduleTab('upcoming')" class="flex-1 text-sm font-bold rounded-full py-2 transition-all ${!isPastTab ? 'bg-primary text-white shadow-soft' : 'text-neutral/50 hover:bg-brand-50'}">กำลังจะถึง</button>
            <button onclick="app.switchStudentScheduleTab('past')" class="flex-1 text-sm font-bold rounded-full py-2 transition-all ${isPastTab ? 'bg-primary text-white shadow-soft' : 'text-neutral/50 hover:bg-brand-50'}">จบไปแล้ว</button>
        </div>
        ${scheduleHtml}
    `;
}

export function getStudentPayments() {
    const myBookings = state.bookings.filter(b => b.studentId === state.currentStudentId);
    
    // Sort bookings by status priority: pending > checking > approved > timeout > rejected
    const sortedBookings = [...myBookings].sort((a, b) => {
        const order = { 'pending': 1, 'checking': 2, 'approved': 3, 'timeout': 4, 'rejected': 5 };
        return order[a.status] - order[b.status];
    });

    let contentHtml = '';
    
    if (sortedBookings.length === 0) {
        contentHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="receipt" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-1">ยังไม่มีประวัติการชำระเงิน</div>
                <p class="text-xs text-neutral/50">คุณสามารถค้นหาคอร์สเรียนและทำการจองได้</p>
                <button onclick="app.switchTab('browse')" class="btn btn-sm btn-secondary mt-4 rounded-full">หาคอร์สเรียนเลย</button>
            </div>
        `;
    } else {
        contentHtml = `
            <div class="space-y-4 animate-fade-in">
                ${sortedBookings.map(booking => {
                    const cls = state.classes.find(c => c.id === booking.classId);
                    if (!cls) return '';
                    const isExpiredPending = app.isBookingExpired(booking, cls);
                                    const totalHours = app.calculateTotalHours(cls.schedules);

                                    let borderClass = 'border-warning shadow-soft';
                                    let timerBadgeHtml = '';
                                    let statusInfoHtml = '';
                                    let actionHtml = '';

                                    if (booking.status === 'pending') {
                                        const tSettings = state.tutorSettings[cls.tutorId] || null;
                                        if(!tSettings) app.fetchTutorSettings(cls.tutorId);

                                        if (isExpiredPending) {
                                            timerBadgeHtml = `
                                                <div class="absolute top-0 right-0 bg-neutral/60 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl shadow-sm flex items-center gap-1">
                                                    <i data-lucide="clock-x" class="w-3 h-3"></i>
                                                    หมดเวลาแล้ว
                                                </div>
                                            `;
                                            borderClass = 'border-brand-200 bg-brand-50 opacity-70 grayscale-[20%] shadow-sm';
                                            statusInfoHtml = `
                                               <div class="space-y-3">
                                                   <span class="text-xs font-bold text-neutral/60 flex items-center gap-1 mt-1"><i data-lucide="clock-x" class="w-3.5 h-3.5"></i> หมดเวลาแล้ว ไม่สามารถอัปโหลดสลิปได้</span>
                                                   <div class="bg-white/70 rounded-[1.25rem] p-3.5 border border-brand-100 shadow-sm space-y-2 relative overflow-hidden">
                                                       <div class="absolute right-0 top-0 w-16 h-16 bg-brand-100 rounded-full translate-x-6 -translate-y-6 pointer-events-none"></div>
                                                       <div class="relative z-10 space-y-1.5">
                                                           <div class="text-[8px] font-bold text-neutral/40 uppercase tracking-[0.22em]">โอนเงินไปที่</div>
                                                           ${tSettings ? `
                                                               <div class="space-y-0.5">
                                                                   <div class="text-[11px] sm:text-[12px] font-semibold text-neutral/60 leading-tight">${tSettings.bankName}</div>
                                                                   <div class="text-[12px] sm:text-[13px] font-bold text-neutral/70 leading-tight">${tSettings.accountName}</div>
                                                               </div>
                                                               <div class="flex items-end justify-between gap-2 pt-0.5">
                                                                   <div class="font-mono text-[16px] sm:text-[18px] font-black tracking-[0.16em] text-neutral/50 leading-none select-all">${tSettings.accountNumber}</div>
                                                                   <button disabled class="shrink-0 inline-flex items-center gap-1 rounded-lg border border-brand-100 bg-white px-2 py-1 text-[10px] font-semibold text-neutral/40 shadow-sm cursor-not-allowed opacity-60">
                                                                       <i data-lucide="copy" class="w-3 h-3"></i>
                                                                       คัดลอก
                                                                   </button>
                                                               </div>
                                                           ` : '<div class="text-xs text-neutral/40 italic animate-pulse">กำลังโหลดข้อมูลบัญชี...</div>'}
                                                       </div>
                                                   </div>
                                               </div>
                                            `;
                                            actionHtml = `
                                                <div class="mt-4 pt-4 border-t border-brand-100">
                                                    <button disabled class="btn btn-block rounded-full bg-brand-200 text-neutral/50 font-bold h-12 border-none cursor-not-allowed opacity-80">
                                                        <i data-lucide="clock-x" class="w-5 h-5 mr-1"></i> หมดเวลาแล้ว
                                                    </button>
                                                </div>
                                            `;
                                        } else {
                                            timerBadgeHtml = `
                                                <div class="absolute top-0 right-0 bg-error text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl shadow-sm flex items-center gap-1">
                                                    <i data-lucide="timer" class="w-3 h-3"></i>
                                                    หมดเวลาใน <span class="payment-timer tracking-wider font-mono text-xs ml-0.5" data-created="${booking.created_date}">--:--</span>
                                                </div>
                                            `;
                                            borderClass = 'border-error shadow-soft';
                                            statusInfoHtml = `
                                               <div class="space-y-3">
                                                   <span class="text-xs font-bold text-error flex items-center gap-1 mt-1"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> รอโอนเงิน (ด่วน)</span>
                                                   <div class="bg-white rounded-[1.25rem] p-3.5 border border-brand-100 shadow-sm space-y-2 relative overflow-hidden">
                                                       <div class="absolute right-0 top-0 w-16 h-16 bg-primary/5 rounded-full translate-x-6 -translate-y-6 pointer-events-none"></div>
                                                       <div class="relative z-10 space-y-1.5">
                                                           <div class="text-[8px] font-bold text-neutral/40 uppercase tracking-[0.22em]">โอนเงินไปที่</div>
                                                           ${tSettings ? `
                                                               <div class="space-y-0.5">
                                                                   <div class="text-[11px] sm:text-[12px] font-semibold text-primary leading-tight">${tSettings.bankName}</div>
                                                                   <div class="text-[12px] sm:text-[13px] font-bold text-neutral leading-tight">${tSettings.accountName}</div>
                                                               </div>
                                                               <div class="flex items-end justify-between gap-2 pt-0.5">
                                                                   <div class="font-mono text-[16px] sm:text-[18px] font-black tracking-[0.16em] text-neutral leading-none select-all">${tSettings.accountNumber}</div>
                                                                   <button onclick="app.copyToClipboard('${tSettings.accountNumber}', 'คัดลอกเลขบัญชีแล้ว')" class="shrink-0 inline-flex items-center gap-1 rounded-lg border border-brand-100 bg-white px-2 py-1 text-[10px] font-semibold text-primary shadow-sm active:scale-95">
                                                                       <i data-lucide="copy" class="w-3 h-3"></i>
                                                                       คัดลอก
                                                                   </button>
                                                               </div>
                                                           ` : '<div class="text-xs text-neutral/40 italic animate-pulse">กำลังโหลดข้อมูลบัญชี...</div>'}
                                                       </div>
                                                   </div>
                                               </div>
                                            `;
                                            actionHtml = `
                                                <div class="mt-4 pt-4 border-t border-brand-100 grid grid-cols-2 gap-2">
                                                    <button onclick="app.showConfirm('ยกเลิกการจอง', 'คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการจองคอร์สนี้?', 'ยกเลิกจอง', 'btn-error', 'reject', '${booking.id}')" class="btn rounded-full btn-outline border-brand-200 text-neutral/50 font-bold h-12 hover:bg-error/10 hover:text-error hover:border-error">
                                                        <i data-lucide="x" class="w-5 h-5 mr-1"></i> ยกเลิก
                                                    </button>
                                                    <button onclick="app.requestQuickUpload('${booking.id}')" class="btn btn-error rounded-full text-white shadow-soft font-bold h-12" data-booking-upload-btn="1">
                                                        <i data-lucide="upload-cloud" class="w-5 h-5 mr-1"></i> แนบสลิป
                                                    </button>
                                                </div>
                                            `;
                                        }
                                    } else if (booking.status === 'checking') {
                                        borderClass = 'border-primary shadow-sm';
                                        timerBadgeHtml = `<div class="absolute top-0 right-0 bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl flex items-center gap-1"><i data-lucide="loader" class="w-3 h-3 animate-spin"></i> รอตรวจสลิป</div>`;
                                        statusInfoHtml = '<span class="text-xs font-bold text-primary flex items-center gap-1 mt-1"><i data-lucide="file-search" class="w-3.5 h-3.5"></i> คุณแนบสลิปแล้ว กำลังรอแอดมินยืนยัน</span>';
                                    } else if (booking.status === 'approved') {
                                        borderClass = 'border-success/30 bg-success/5 shadow-sm';
                                        timerBadgeHtml = `<div class="absolute top-0 right-0 bg-success text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl shadow-sm flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> ยืนยันแล้ว</div>`;
                                        statusInfoHtml = '<span class="text-xs font-bold text-success flex items-center gap-1 mt-1"><i data-lucide="party-popper" class="w-3.5 h-3.5"></i> ลงทะเบียนสมบูรณ์ ตรวจสอบตารางเรียนได้เลย</span>';
                                    } else if (booking.status === 'rejected') {
                                        borderClass = 'border-brand-200 bg-brand-50 opacity-75';
                                        timerBadgeHtml = `<div class="absolute top-0 right-0 bg-neutral/40 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl flex items-center gap-1"><i data-lucide="x-circle" class="w-3 h-3"></i> ยกเลิก</div>`;
                                        statusInfoHtml = '<span class="text-xs font-bold text-neutral/50 flex items-center gap-1 mt-1"><i data-lucide="info" class="w-3.5 h-3.5"></i> ถูกยกเลิก หรือ หมดเวลาโอนเงิน</span>';
                                    } else if (booking.status === 'timeout') {
                                        borderClass = 'border-brand-200 bg-brand-50 opacity-75 grayscale-[20%]';
                                        timerBadgeHtml = `<div class="absolute top-0 right-0 bg-neutral/50 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl flex items-center gap-1"><i data-lucide="clock-x" class="w-3 h-3"></i> หมดเวลา</div>`;
                                        statusInfoHtml = '<span class="text-xs font-bold text-neutral/60 flex items-center gap-1 mt-1"><i data-lucide="clock-x" class="w-3.5 h-3.5"></i> หมดเวลาโอนเงิน ระบบปล่อยที่นั่งแล้ว</span>';
                                    }

                                    return `
                                    <div class="bg-white rounded-[2rem] p-5 border-2 ${borderClass} relative overflow-hidden transition-all duration-300" data-booking-id="${booking.id}">
                                        ${timerBadgeHtml}
                                        
                                        <div class="text-xs text-primary font-bold mb-3 flex items-center gap-1">
                                            <i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>
                                            <span>${cls.instituteName || 'TutorBooking'}</span>
                                            ${cls.tutorName ? `<span class="text-neutral/40 font-normal">(${cls.tutorName})</span>` : ''}
                                        </div>
                                        <h3 class="font-bold text-neutral text-lg pr-24 leading-tight">${cls.title}</h3>
                                        ${statusInfoHtml}
                                        
                                        <div class="bg-brand-50 rounded-xl p-3 mt-4 border border-brand-100 text-xs text-neutral/70">
                                            <div class="font-bold text-neutral mb-1">คอร์สเรียน ${cls.schedules.length} ครั้ง ${totalHours ? `(${totalHours} ชั่วโมง)` : ''}</div>
                                            <div class="text-[10px]">เริ่มคลาสแรก: ${app.displayDate(cls.schedules[0]?.date)} (${cls.schedules[0]?.time})</div>
                                        </div>
                                        
                                        ${actionHtml}
                                    </div>
                                    `;
                                }).join('')}
            </div>
        `;
    }

    return `
        <div class="flex items-center justify-between mb-6">
            <h1 class="text-2xl font-black text-neutral">รายการชำระเงิน</h1>
        </div>
        ${contentHtml}
    `;
}
export function switchStudentClassTab(tab) {
    state.studentClassTab = tab;
    app.render();
}

export function switchStudentScheduleTab(tab) {
    state.studentScheduleTab = tab;
    app.render();
}
