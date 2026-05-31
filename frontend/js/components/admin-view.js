import { state } from '../state.js';
import { CONFIG } from '../config.js';

export function getAdminOverview() {
    let totalRevenue = 0;
    (state.bookings || []).forEach(b => {
        if (b.status === 'approved') {
            const cls = (state.classes || []).find(c => c.id === b.classId);
            if (cls) totalRevenue += cls.price;
        }
    });

    const pendingCount = (state.bookings || []).filter(b => b.status === 'checking').length;
    const uniqueStudentsCount = new Set((state.bookings || []).map(b => b.studentId)).size;
    
    let upcomingSchedules = [];
    (state.classes || []).forEach(cls => {
        if (Array.isArray(cls.schedules)) {
            cls.schedules.forEach((sch, i) => {
                if (sch && sch.date && app.parseClassTime(sch.date, sch.time) >= Date.now()) {
                    upcomingSchedules.push({ ...cls, schDate: sch.date, schTime: sch.time, schIndex: i+1 });
                }
            });
        }
    });
    upcomingSchedules = upcomingSchedules.sort((a,b) => app.parseClassTime(a.schDate, a.schTime) - app.parseClassTime(b.schDate, b.schTime)).slice(0, 2);

    return `
        <div class="space-y-6">
            <div class="mb-4">
                <h1 class="text-2xl font-bold text-neutral">ภาพรวมธุรกิจ</h1>
                <p class="text-sm text-neutral/60">สรุปข้อมูลการสอนและการจองคลาสของคุณ</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl p-5 border border-primary/10 shadow-card col-span-2 relative overflow-hidden">
                    <i data-lucide="wallet" class="absolute -right-4 -bottom-4 w-32 h-32 text-primary/10"></i>
                    <div class="relative z-10">
                        <div class="flex items-center gap-2 text-primary mb-1">
                            <div class="bg-primary text-white p-1.5 rounded-full shadow-soft">
                                <i data-lucide="trending-up" class="w-4 h-4"></i>
                            </div>
                            <span class="text-sm font-medium">รายได้ประมาณการ (จากคลาสปัจจุบัน)</span>
                        </div>
                        <div class="text-4xl font-bold text-primary mt-2">฿${totalRevenue.toLocaleString()}</div>
                    </div>
                </div>

                <div class="bg-white rounded-3xl p-4 border border-brand-100 shadow-card hover-card">
                    <div class="text-secondary mb-2 bg-secondary/10 w-max p-2 rounded-xl">
                        <i data-lucide="users" class="w-6 h-6"></i>
                    </div>
                    <div class="text-2xl font-bold text-neutral">${uniqueStudentsCount} <span class="text-sm font-normal text-neutral/60">คน</span></div>
                    <div class="text-xs text-neutral/60 mt-1 font-medium">นักเรียนของคุณ</div>
                </div>

                <div class="bg-warning/10 rounded-3xl p-4 border border-warning/20 cursor-pointer hover:bg-warning/20 transition-colors shadow-card" onclick="app.switchTab('approvals')">
                    <div class="text-warning mb-2 flex justify-between items-start">
                        <div class="bg-warning/20 w-max p-2 rounded-xl text-warning"><i data-lucide="file-check-2" class="w-6 h-6"></i></div>
                        ${pendingCount > 0 ? '<span class="flex h-3 w-3 relative"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-warning"></span></span>' : ''}
                    </div>
                    <div class="text-2xl font-bold text-warning">${pendingCount} <span class="text-sm font-normal text-warning/70">รายการ</span></div>
                    <div class="text-xs text-warning/80 mt-1 font-medium flex items-center gap-1">รอตรวจสอบสลิป <i data-lucide="arrow-right" class="w-3 h-3"></i></div>
                </div>
            </div>

            <div class="mt-6 bg-white rounded-3xl p-5 border border-brand-100 shadow-card">
                <h2 class="text-base font-bold mb-4 text-neutral flex items-center gap-2"><i data-lucide="bar-chart-3" class="w-5 h-5 text-primary"></i> สถิติรายได้ 6 เดือนย้อนหลัง</h2>
                <div class="relative h-48 w-full">
                    <canvas id="revenueChart"></canvas>
                </div>
            </div>

            <div class="mt-8">
                <div class="flex justify-between items-end mb-3">
                    <h2 class="text-lg font-bold text-neutral">คลาสเรียนใกล้จะถึง</h2>
                    <button onclick="app.switchTab('classes')" class="text-xs text-primary font-medium hover:underline flex items-center gap-1">ดูทั้งหมด <i data-lucide="chevron-right" class="w-3 h-3"></i></button>
                </div>
                <div class="space-y-3">
                    ${upcomingSchedules.map(sch => `
                        <div class="bg-white rounded-[2rem] p-3 border border-brand-100 shadow-sm flex items-center justify-between hover-card">
                            <div class="flex items-center gap-3">
                                <div class="bg-brand-50 text-primary p-2 rounded-2xl text-center min-w-[55px] border border-brand-100">
                                    <div class="text-[10px] uppercase font-bold text-neutral/60">${(sch.schDate ? app.displayDate(sch.schDate) : ' / ').split('/')[1] || ''}</div>
                                    <div class="text-xl font-black leading-none">${(sch.schDate ? app.displayDate(sch.schDate) : ' / ').split('/')[0] || ''}</div>
                                </div>
                                <div>
                                    <div class="font-bold text-sm text-neutral line-clamp-1">${sch.title} <span class="text-primary text-xs ml-1">(ครั้งที่ ${sch.schIndex}/${sch.schedules.length})</span></div>
                                    <div class="text-[11px] text-neutral/60 mt-1 flex items-center gap-2">
                                        <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${sch.schTime}</span>
                                        <span class="flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i> ${sch.bookedSeats}/${sch.maxSeats}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

export function getAdminClasses() {
    const now = Date.now();
    const isPastTab = state.adminClassTab === 'past';
    
    const allSchedules = [];
    state.classes.forEach(cls => {
        cls.schedules.forEach((sch, index) => {
            allSchedules.push({ ...cls, schDate: sch.date, schTime: sch.time, schIndex: index });
        });
    });

    const sortedSchedules = allSchedules.sort((a, b) => app.parseClassTime(a.schDate, a.schTime) - app.parseClassTime(b.schDate, b.schTime));
    
    const filteredSchedules = sortedSchedules.filter(s => {
        const isPast = app.parseClassTime(s.schDate, s.schTime) < now;
        return isPastTab ? isPast : !isPast;
    });

    const groupedByDate = {};
    filteredSchedules.forEach(s => {
        if(!groupedByDate[s.schDate]) groupedByDate[s.schDate] = [];
        groupedByDate[s.schDate].push(s);
    });

    let timelineHtml = '';
    if (Object.keys(groupedByDate).length === 0) {
        timelineHtml = `
            <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm animate-fade-in">
                <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-neutral/30">
                    <i data-lucide="${isPastTab ? 'history' : 'calendar-x'}" class="w-8 h-8"></i>
                </div>
                <div class="text-sm font-bold text-neutral mb-1">ไม่มีตารางสอน</div>
                <div class="text-xs text-neutral/50">ยังไม่มีข้อมูลในหมวดหมู่นี้</div>
            </div>
        `;
    } else {
        timelineHtml = `
            <div class="relative border-l-[3px] ${isPastTab ? 'border-brand-200' : 'border-primary/30'} ml-3 md:ml-6 space-y-10 pb-8 animate-fade-in">
                ${Object.keys(groupedByDate).map(date => {
                    const schedulesInDate = groupedByDate[date];
                    return `
                    <div class="relative">
                        <div class="absolute w-5 h-5 bg-${isPastTab ? 'brand-200' : 'primary'} rounded-full -left-[11px] top-0 ring-[6px] ring-[#faf7f5] flex items-center justify-center shadow-sm">
                            <div class="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        
                        <div class="pl-8 font-bold text-neutral text-lg mb-5 flex items-center gap-2">
                            <div class="p-1.5 rounded-lg ${isPastTab ? 'bg-brand-100 text-neutral/50' : 'bg-primary/10 text-primary'}">
                                <i data-lucide="calendar-days" class="w-5 h-5"></i>
                            </div>
                            <span class="${isPastTab ? 'text-neutral/50' : ''}">${app.displayDate(date)}</span>
                        </div>
                        
                        <div class="pl-8 space-y-5">
                            ${schedulesInDate.map(sch => {
                                const classBookings = state.bookings.filter(b => b.classId === sch.id && b.status === 'approved');
                                const opacityClass = isPastTab ? 'opacity-80 grayscale-[20%]' : '';
                                const uniqueId = `sch-${sch.id}-${sch.schIndex}`;

                                return `
                                <div class="bg-white rounded-[2rem] p-5 border border-brand-100 shadow-card relative overflow-hidden ${opacityClass}">
                                    
                                    <div class="flex gap-3 items-start mb-2">
                                        <div class="w-10 h-10 rounded-2xl ${isPastTab ? 'bg-brand-100 text-neutral/50' : 'bg-primary/10 text-primary'} flex items-center justify-center flex-none">
                                            <i data-lucide="book-open" class="w-5 h-5"></i>
                                        </div>
                                        <div class="flex-1 pr-12">
                                            <div class="text-[10px] font-bold text-primary mb-1">ครั้งที่ ${sch.schIndex + 1} / ${sch.schedules.length}</div>
                                            <h3 class="font-bold text-lg ${isPastTab ? 'text-neutral/70' : 'text-neutral'} leading-tight mb-2">${sch.title}</h3>
                                            <div class="flex items-center gap-3 text-xs text-neutral/60">
                                                <div class="flex items-center gap-1 bg-brand-50 px-2 py-1 rounded-md"><i data-lucide="clock" class="w-3.5 h-3.5 ${isPastTab ? 'text-neutral/40' : 'text-primary'}"></i> ${sch.schTime}</div>
                                                <div class="flex items-center gap-1 bg-brand-50 px-2 py-1 rounded-md"><i data-lucide="users" class="w-3.5 h-3.5 ${isPastTab ? 'text-neutral/40' : 'text-primary'}"></i> นร. ${classBookings.length} คน</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mt-4 pt-4 border-t border-brand-100">
                                        <div class="flex gap-2">
                                            ${!isPastTab ? `
                                            <button onclick="app.openEditClassModal('${sch.id}')" class="btn btn-sm btn-outline btn-primary rounded-full px-4 font-medium flex-none" title="แก้ไขคอร์ส">
                                                <i data-lucide="edit-3" class="w-4 h-4"></i> แก้ไข
                                            </button>
                                            ` : ''}
                                            <button onclick="document.getElementById('${uniqueId}').classList.toggle('hidden')" class="btn btn-sm btn-ghost w-full rounded-full text-xs bg-brand-50 font-medium text-neutral border border-brand-100 flex-1">
                                                <i data-lucide="check-square" class="w-4 h-4 text-primary"></i> เช็คชื่อเข้าเรียน
                                                <i data-lucide="chevron-down" class="w-3 h-3 ml-1"></i>
                                            </button>
                                        </div>
                                        
                                        <div id="${uniqueId}" class="hidden mt-3 space-y-2">
                                            ${classBookings.length === 0 ? '<p class="text-center text-xs text-neutral/50 py-3 bg-brand-50 rounded-xl">ไม่มีนักเรียนในคลาสนี้</p>' : ''}
                                            ${classBookings.map(b => {
                                                const attKey = `${sch.id}_${sch.schIndex}_${b.studentId}`;
                                                const isPresent = state.attendance.includes(attKey);
                                                
                                                return `
                                                <div class="flex items-center justify-between bg-white border border-brand-100 p-2.5 rounded-xl shadow-sm gap-2 transition-colors ${isPresent ? 'border-primary/50 bg-primary/5' : ''}">
                                                    <div class="flex items-center gap-2">
                                                        <div class="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-neutral/50"><i data-lucide="user" class="w-3 h-3"></i></div>
                                                        <span class="font-bold text-neutral text-sm">${b.studentName}</span>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-bold att-status-text ${isPresent ? 'text-primary' : 'text-neutral/40'}">${isPresent ? '<i data-lucide=\"check-circle\" class=\"w-3 h-3 inline\"></i> มาเรียน' : '<i data-lucide=\"x-circle\" class=\"w-3 h-3 inline\"></i> ขาดเรียน'}</span>
                                                        <input type="checkbox" class="toggle toggle-primary toggle-sm" onchange="app.toggleAttendance('${sch.id}', ${sch.schIndex}, '${b.studentId}', this.checked, this)" ${isPresent ? 'checked' : ''} />
                                                    </div>
                                                </div>
                                                `
                                            }).join('')}
                                        </div>
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
        <div class="space-y-4">
            <div class="mb-2">
                <h1 class="text-2xl font-bold text-neutral">ตารางสอนของฉัน</h1>
                <p class="text-sm text-neutral/60">ตรวจสอบตารางสอนและเช็คชื่อนักเรียน</p>
            </div>
            
            <div class="flex bg-white p-1.5 rounded-full w-full max-w-sm mx-auto shadow-sm border border-brand-100 relative z-10">
                <button onclick="app.switchAdminClassTab('upcoming')" class="flex-1 text-sm font-bold rounded-full py-2 transition-all ${!isPastTab ? 'bg-primary text-white shadow-soft' : 'text-neutral/50 hover:bg-brand-50'}">กำลังจะมาถึง</button>
                <button onclick="app.switchAdminClassTab('past')" class="flex-1 text-sm font-bold rounded-full py-2 transition-all ${isPastTab ? 'bg-neutral text-white shadow-soft' : 'text-neutral/50 hover:bg-brand-50'}">จบไปแล้ว</button>
            </div>

            <div class="pt-4">
                ${timelineHtml}
            </div>
        </div>
    `;
}

export function getAdminCreate() {
    const initialSchedule = `
        <div class="grid grid-cols-12 gap-1 mb-2 schedule-row items-center">
            <div class="col-span-1 flex items-center justify-center font-bold text-primary text-[9px] sch-badge bg-primary/10 rounded-lg h-full">1/1</div>
            <div class="col-span-4"><input type="date" class="sch-date input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" onchange="app.sortAndLabelSchedules('create-schedule-container')" /></div>
            <div class="col-span-3"><input type="time" class="sch-start input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" onchange="app.sortAndLabelSchedules('create-schedule-container')" /></div>
            <div class="col-span-3"><input type="time" class="sch-end input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" onchange="app.sortAndLabelSchedules('create-schedule-container')" /></div>
            <div class="col-span-1 flex items-center justify-center"></div>
        </div>
    `;

    return `
        <div class="space-y-6 max-w-md mx-auto">
            <div class="mb-4">
                <h1 class="text-2xl font-bold text-neutral">เปิดคอร์สใหม่</h1>
                <p class="text-sm text-neutral/60">สร้างคอร์สเรียนและระบุวันที่จะทำการสอน</p>
            </div>

            <div class="bg-white rounded-[2rem] p-6 border border-brand-100 shadow-card">
                <div class="form-control w-full mb-3">
                    <label class="label pt-0"><span class="label-text text-xs font-bold text-neutral/70">ชื่อคอร์สเรียน / หัวข้อ</span></label>
                    <input type="text" id="create-title" class="input input-bordered input-sm w-full bg-brand-50 rounded-xl h-10" placeholder="เช่น ติวเข้มก่อนสอบมิดเทอม" />
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-3 border-t border-brand-100 pt-4">
                    <div class="form-control w-full">
                        <label class="label pt-0"><span class="label-text text-xs font-bold text-primary">วันเปิดรับสมัคร</span></label>
                        <input type="date" id="create-open-date" class="input input-bordered input-sm w-full bg-brand-50 rounded-xl h-10" />
                    </div>
                    <div class="form-control w-full">
                        <label class="label pt-0"><span class="label-text text-xs font-bold text-error">วันปิดรับสมัคร</span></label>
                        <input type="date" id="create-close-date" class="input input-bordered input-sm w-full bg-brand-50 rounded-xl h-10" />
                    </div>
                </div>

                <div class="mb-3 pt-4 border-t border-brand-100">
                    <label class="label pt-0"><span class="label-text text-xs font-bold text-secondary">วันที่ทำการสอน (ระบุได้หลายวัน)</span></label>
                    <div class="grid grid-cols-12 gap-1 mb-1 px-1 text-[10px] font-bold text-neutral/50">
                        <div class="col-span-1 text-center">ครั้ง</div><div class="col-span-4">วันที่</div><div class="col-span-3">เริ่ม</div><div class="col-span-3">สิ้นสุด</div>
                    </div>
                    <div id="create-schedule-container">
                        ${initialSchedule}
                    </div>
                    <button type="button" onclick="app.addScheduleRow('create-schedule-container')" class="btn btn-xs btn-outline btn-primary rounded-full mt-2 w-full border-dashed"><i data-lucide="plus" class="w-3 h-3"></i> เพิ่มวันเรียน</button>
                </div>

                <div class="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-brand-100">
                    <div class="form-control w-full">
                        <label class="label pt-0"><span class="label-text text-xs font-bold text-neutral/70">จำนวนที่รับ (คน)</span></label>
                        <input type="number" id="create-seats" class="input input-bordered input-sm w-full bg-brand-50 rounded-xl h-10" placeholder="เช่น 10" />
                    </div>
                    <div class="form-control w-full">
                        <label class="label pt-0"><span class="label-text text-xs font-bold text-neutral/70">ราคาคอร์ส (บาท)</span></label>
                        <input type="number" id="create-price" class="input input-bordered input-sm w-full bg-brand-50 rounded-xl h-10 font-bold text-primary" placeholder="เช่น 1500" />
                    </div>
                </div>

                <button onclick="app.createClass()" class="btn btn-primary w-full rounded-full text-white shadow-soft h-12 font-medium">เปิดรับสมัคร</button>
            </div>
        </div>
    `;
}

export function getAdminApprovals() {
    const pendingBookings = state.bookings.filter(b => b.status === 'checking' || b.status === 'pending');

    return `
        <div class="space-y-6">
            <div class="mb-4">
                <h1 class="text-2xl font-bold text-neutral">ตรวจสอบการจอง</h1>
                <p class="text-sm text-neutral/60">รายการจองที่รอโอนเงิน และ รอตรวจสอบสลิป</p>
            </div>

            ${pendingBookings.length === 0 ? `
                <div class="text-center py-12 bg-white rounded-[2rem] border border-brand-100 shadow-sm">
                    <div class="bg-brand-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 text-primary/40"><i data-lucide="check-circle-2" class="w-8 h-8"></i></div>
                    <div class="text-sm font-bold text-neutral">ไม่มีรายการรอตรวจสอบ</div>
                    <div class="text-xs text-neutral/50 mt-1">คุณจัดการรายการทั้งหมดเรียบร้อยแล้ว</div>
                </div>
            ` : ''}

            <div class="space-y-4">
                ${pendingBookings.map(booking => {
                    const cls = state.classes.find(c => c.id === booking.classId);
                    const timeoutMins = app.getPaymentTimeoutMinutes(cls?.tutorId);
                    
                    let statusBadge = booking.status === 'checking' 
                        ? '<span class="badge bg-primary/10 text-primary border-none badge-sm text-[10px] font-bold px-2 py-3 rounded-lg"><i data-lucide="file-check-2" class="w-3 h-3 mr-1"></i> แนบสลิปแล้ว</span>'
                        : `<span class="badge bg-warning/10 text-warning border-none badge-sm text-[10px] font-bold px-2 py-3 rounded-lg"><i data-lucide="clock" class="w-3 h-3 mr-1"></i> รอโอนเงิน (${timeoutMins} นาที)</span>`;
                        
                    let actionButtons = booking.status === 'checking'
                        ? `
                            <button onclick="app.viewSlip('${booking.slipUrl}')" class="btn btn-outline btn-primary btn-sm rounded-full bg-white flex-1 md:flex-none">ดูสลิป</button>
                            <button onclick="app.requestRejectBooking('${booking.id}')" class="btn btn-error btn-outline btn-sm rounded-full flex-1 md:flex-none">ปฏิเสธ</button>
                            <button onclick="app.requestApproveBooking('${booking.id}')" class="btn btn-success btn-sm text-white rounded-full px-6 shadow-md shadow-success/30 flex-1 md:flex-none">อนุมัติ</button>
                        `
                        : `
                            <button onclick="app.requestRejectBooking('${booking.id}')" class="btn btn-ghost text-error btn-sm rounded-full flex-1 md:flex-none bg-error/10 font-medium">ยกเลิกคิว</button>
                        `;

                    return `
                    <div class="bg-white rounded-[2rem] p-5 border border-brand-100 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div class="flex items-center gap-3 mb-2">
                                <div class="w-8 h-8 bg-brand-50 rounded-full flex items-center justify-center text-neutral/50"><i data-lucide="user" class="w-4 h-4"></i></div>
                                <span class="font-bold text-neutral text-lg">${booking.studentName}</span>
                                ${statusBadge}
                            </div>
                            <div class="text-sm font-bold text-neutral/80 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-100 inline-block w-full md:w-auto mb-1">${cls.title}</div>
                            <div class="text-xs font-bold text-secondary mt-1 flex items-center gap-1">ยอดโอน: ฿${cls.price}</div>
                        </div>
                        <div class="flex gap-2 w-full md:w-auto mt-2 md:mt-0 justify-end">
                            ${actionButtons}
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

export function getAdminSettings() {
    const s = state.institute;
    const autoAccept = s.auto_accept_followers !== false;

    return `
        <div class="space-y-6">
            <div class="mb-4">
                <h1 class="text-2xl font-bold text-neutral">ตั้งค่าบัญชี</h1>
                <p class="text-sm text-neutral/60">จัดการข้อมูลสถาบันและระบบติดตาม</p>
            </div>

            <div class="bg-white rounded-[2rem] p-6 border border-brand-100 shadow-sm animate-fade-in">
                <h3 class="font-bold text-neutral mb-4 flex items-center gap-2">
                    <i data-lucide="shield-check" class="w-5 h-5 text-primary"></i> ระบบติดตามนักเรียน
                </h3>
                <div class="flex items-center justify-between p-4 bg-brand-50 rounded-2xl border border-brand-100">
                    <div>
                        <div class="font-bold text-sm text-neutral">รับนักเรียนอัตโนมัติ</div>
                        <div class="text-[10px] text-neutral/50">เปิดเพื่อให้นักเรียนที่ใช้รหัสเชิญเริ่มเรียนได้ทันที</div>
                    </div>
                    <input type="checkbox" class="toggle toggle-primary" ${autoAccept ? 'checked' : ''} onchange="app.toggleAutoAccept(this.checked)" />
                </div>

                <div class="mt-4 p-4 bg-brand-50 rounded-2xl border border-brand-100">
                    <label class="label pt-0"><span class="label-text font-bold text-sm text-neutral">เวลาโอนเงิน (นาที)</span></label>
                    <div class="flex items-center gap-3">
                        <input type="number" id="setting-timeout" value="${app.getPaymentTimeoutMinutes()}" class="input input-bordered w-24 bg-white rounded-xl h-10 text-center font-bold" min="1" max="60" />
                        <span class="text-xs text-neutral/50">นาที (นับจากเวลาที่จอง)</span>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-[2rem] p-6 border border-brand-100 shadow-sm space-y-4 animate-fade-in">
                <h3 class="font-bold text-neutral mb-2 flex items-center gap-2">
                    <i data-lucide="building-2" class="w-5 h-5 text-primary"></i> ข้อมูลสถาบันและการเงิน
                </h3>
                <div class="form-control w-full">
                    <label class="label pt-0"><span class="label-text font-bold text-xs">ชื่อสถาบัน / ชื่อติวเตอร์</span></label>
                    <input type="text" id="setting-inst-name" value="${s.name}" class="input input-bordered w-full bg-brand-50 rounded-xl h-12" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="form-control w-full">
                        <label class="label pt-0"><span class="label-text font-bold text-xs">ธนาคาร</span></label>
                        <input type="text" id="setting-bank-name" value="${s.bankName}" class="input input-bordered w-full bg-brand-50 rounded-xl h-12" />
                    </div>
                    <div class="form-control w-full">
                        <label class="label pt-0"><span class="label-text font-bold text-xs">เลขบัญชี</span></label>
                        <input type="text" id="setting-acc-num" value="${s.accountNumber}" class="input input-bordered w-full bg-brand-50 rounded-xl h-12 font-mono text-lg font-bold text-primary" />
                    </div>
                </div>
                <div class="form-control w-full">
                    <label class="label pt-0"><span class="label-text font-bold text-xs">ชื่อบัญชี</span></label>
                    <input type="text" id="setting-acc-name" value="${s.accountName}" class="input input-bordered w-full bg-brand-50 rounded-xl h-12" />
                </div>
                <button onclick="app.saveInstituteSettings()" class="btn btn-primary w-full rounded-full text-white shadow-soft font-medium h-12">บันทึกการตั้งค่า</button>
            </div>
        </div>
    `;
}

export function getNetworkView() {
    const isTutor = state.currentRole === 'admin';
    if (isTutor) {
        const requests = state.network.requests || [];
        const followers = state.network.followers || [];

        return `
            <div class="space-y-6">
                <div class="mb-4">
                    <h1 class="text-2xl font-bold text-neutral">นักเรียนของฉัน</h1>
                    <p class="text-sm text-neutral/60">จัดการคำขอติดตามและรายชื่อลูกศิษย์</p>
                </div>
                
                <div class="bg-brand-50 rounded-2xl p-5 border border-brand-100 flex flex-col items-center justify-center mb-6 text-center shadow-inner">
                    <div class="text-xs font-bold text-neutral/50 uppercase tracking-wider mb-2">รหัสเชิญนักเรียน (Invite Code)</div>
                    <div class="flex items-center gap-3">
                        <div id="invite-code-display" class="text-3xl font-black text-primary tracking-[0.2em] bg-white px-6 py-2 rounded-xl shadow-sm border border-primary/20">${state.currentUserInviteCode || '------'}</div>
                        <button onclick="app.copyToClipboard('${state.currentUserInviteCode}', 'คัดลอกรหัสเชิญแล้ว')" class="btn btn-circle btn-primary btn-sm text-white shadow-soft">
                            <i data-lucide="copy" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <p class="text-[10px] text-neutral/50 mt-3">ส่งรหัสนี้ให้นักเรียนเพื่อเข้าถึงคอร์สเรียนของคุณ</p>
                </div>

                ${requests.length > 0 ? `
                    <div>
                        <h3 class="font-bold text-error mb-3 flex items-center gap-2 text-sm">
                            <i data-lucide="user-plus" class="w-4 h-4"></i> คำขอติดตามใหม่ (${requests.length})
                        </h3>
                        <div class="space-y-3 mb-8">
                            ${requests.map(r => `
                                <div class="bg-error/5 rounded-[2rem] p-4 border border-error/20 flex items-center gap-4">
                                    <div class="w-12 h-12 rounded-full bg-error/10 text-error flex items-center justify-center flex-none">
                                        <i data-lucide="user-check" class="w-6 h-6"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="font-bold text-neutral">${r.name}</div>
                                        <div class="text-xs text-neutral/50">${r.email}</div>
                                    </div>
                                    <div class="flex gap-2">
                                        <button onclick="app.approveFollower('${r.id}', '${r.name}')" class="btn btn-circle btn-sm btn-success text-white shadow-sm"><i data-lucide="check" class="w-4 h-4"></i></button>
                                        <button onclick="app.rejectFollower('${r.id}', '${r.name}')" class="btn btn-circle btn-sm btn-ghost text-error border-error/20"><i data-lucide="x" class="w-4 h-4"></i></button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div>
                    <h3 class="font-bold text-neutral/50 mb-3 text-sm flex items-center gap-2">
                        <i data-lucide="users" class="w-4 h-4"></i> ลูกศิษย์ทั้งหมด (${followers.length})
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        ${followers.length === 0 ? '<div class="col-span-full text-center py-12 text-neutral/30 bg-white rounded-3xl border border-brand-100">ยังไม่มีนักเรียนติดตาม</div>' : ''}
                        ${followers.map(n => `
                            <div class="bg-white rounded-[2rem] p-4 border border-brand-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                                <div class="w-10 h-10 rounded-full bg-secondary/10 text-secondary flex items-center justify-center flex-none">
                                    <i data-lucide="user" class="w-5 h-5"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <div class="font-bold text-neutral text-sm truncate">${n.name}</div>
                                    <div class="text-[10px] text-neutral/40 truncate">${n.email}</div>
                                </div>
                                <button onclick="app.removeFollower('${n.id}', '${n.name}')" class="btn btn-ghost btn-circle btn-xs text-error" title="ลบลูกศิษย์">
                                    <i data-lucide="user-minus" class="w-4 h-4"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    } else {
        const following = Array.isArray(state.network) ? state.network : [];
        const approvedTutors = following.filter(t => t.status === 'approved');
        const pendingTutors = following.filter(t => t.status === 'pending');
        const searchResults = Array.isArray(state.tutorSearchResults) ? state.tutorSearchResults : [];
        return `
            <div class="space-y-4">
                <div class="mb-4">
                    <h1 class="text-2xl font-bold text-neutral">ติวเตอร์ของฉัน</h1>
                    <p class="text-sm text-neutral/60">ค้นหาติวเตอร์ก่อน แล้วค่อยกดติดตามจากผลลัพธ์</p>
                </div>
                <div class="flex gap-2 mb-3">
                    <input type="text" id="invite-code-input" value="${state.tutorSearchQuery || ''}" placeholder="ค้นหาชื่อ อีเมล หรือรหัสเชิญ" class="input input-bordered w-full bg-white border-brand-100 rounded-2xl h-12" />
                    <button onclick="app.searchTutors()" class="btn btn-secondary rounded-2xl text-white shadow-soft h-12 px-6">ค้นหา</button>
                </div>
                ${searchResults.length > 0 ? `
                    <div class="bg-white rounded-[2rem] p-4 border border-brand-100 shadow-sm space-y-3 mb-6">
                        <div class="flex items-center justify-between gap-3">
                            <div class="text-sm font-bold text-neutral">ผลการค้นหา (${searchResults.length})</div>
                            <button onclick="app.clearTutorSearch()" class="text-xs font-semibold text-neutral/40 hover:text-neutral">ล้างผล</button>
                        </div>
                        <div class="space-y-3">
                            ${searchResults.map(tutor => {
                                const statusLabel = tutor.is_following ? 'ติดตามแล้ว' : tutor.is_pending ? 'รอการยืนยัน' : 'ยังไม่ได้ติดตาม';
                                const statusClass = tutor.is_following ? 'bg-primary/10 text-primary' : tutor.is_pending ? 'bg-warning/10 text-warning' : 'bg-brand-100 text-neutral/50';
                                const actionLabel = tutor.is_following ? 'เลิกติดตาม' : tutor.is_pending ? '' : 'ติดตาม';
                                const actionHandler = tutor.is_following
                                    ? `onclick="app.unfollowTutor('${tutor.invite_code}', '${tutor.name || ''}')"`
                                    : tutor.is_pending
                                        ? ''
                                        : `onclick="app.followTutorByInviteCode('${tutor.invite_code}')"`;
                                const actionClass = tutor.is_following ? 'btn-ghost text-error' : 'btn-primary text-white';
                                return `
                                    <div class="bg-brand-50 rounded-[1.5rem] p-4 border border-brand-100 flex items-center gap-4">
                                        <div class="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-none">
                                            <i data-lucide="graduation-cap" class="w-5 h-5"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-bold text-neutral truncate">${tutor.name || '-'}</div>
                                            <div class="text-xs text-neutral/50 truncate">${tutor.email || ''}</div>
                                            <div class="flex items-center gap-2 mt-1 flex-wrap">
                                                <div class="text-[10px] text-primary font-bold">รหัสเชิญ: ${tutor.invite_code || '------'}</div>
                                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${statusClass}">${statusLabel}</span>
                                            </div>
                                        </div>
                                        ${actionLabel ? `<button ${actionHandler} class="btn btn-sm rounded-full px-4 ${actionClass}">${actionLabel}</button>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
                <div class="space-y-4">
                    ${following.length === 0 ? '<div class="text-center py-8 text-neutral/50 text-sm bg-white rounded-3xl border border-brand-100">คุณยังไม่ได้ติดตามติวเตอร์คนใด</div>' : ''}

                    ${pendingTutors.length > 0 ? `
                        <div class="bg-white rounded-[1.75rem] p-4 border border-brand-100 shadow-sm space-y-3">
                            <div class="flex items-center justify-between gap-3">
                                <div class="text-sm font-bold text-warning">รอการยืนยัน (${pendingTutors.length})</div>
                            </div>
                            <div class="space-y-3">
                                ${pendingTutors.map(n => `
                                    <div class="bg-warning/5 rounded-[1.5rem] p-4 border border-warning/20 flex items-center gap-4 relative overflow-hidden group opacity-90">
                                        <div class="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center flex-none">
                                            <i data-lucide="clock" class="w-6 h-6"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-bold text-neutral truncate">${n.name}</div>
                                            <div class="text-xs text-neutral/50 flex items-center gap-1">
                                                รหัสเชิญ: ${n.invite_code || '------'}
                                            </div>
                                            <div class="mt-1">
                                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning/10 text-warning">รอการยืนยัน</span>
                                            </div>
                                        </div>
                                        <button onclick="app.unfollowTutor('${n.invite_code}', '${n.name}')" class="btn btn-ghost btn-xs text-error rounded-full px-3 h-8 min-h-8" title="ยกเลิกรอการยืนยัน">
                                            เลิกติดตาม
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${approvedTutors.length > 0 ? `
                        <div class="bg-white rounded-[1.75rem] p-4 border border-brand-100 shadow-sm space-y-3">
                            <div class="flex items-center justify-between gap-3">
                                <div class="text-sm font-bold text-primary">ติดตามแล้ว (${approvedTutors.length})</div>
                            </div>
                            <div class="space-y-3">
                                ${approvedTutors.map(n => `
                                    <div class="bg-white rounded-[2rem] p-4 border border-brand-100 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                                        <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-none">
                                            <i data-lucide="graduation-cap" class="w-6 h-6"></i>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="font-bold text-neutral truncate">${n.name}</div>
                                            <div class="text-xs text-neutral/50 flex items-center gap-1">
                                                รหัสเชิญ: ${n.invite_code || '------'}
                                                <button onclick="app.copyToClipboard('${n.invite_code}', 'คัดลอกรหัสเชิญแล้ว')" class="btn btn-ghost btn-xs text-primary px-2 ml-1 h-6 min-h-6 rounded-full">
                                                    คัดลอก
                                                </button>
                                            </div>
                                            <div class="mt-1">
                                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">ติดตามแล้ว</span>
                                            </div>
                                        </div>
                                        <button onclick="app.unfollowTutor('${n.invite_code}', '${n.name}')" class="btn btn-ghost btn-xs text-error rounded-full px-3 h-8 min-h-8" title="เลิกติดตาม">
                                            เลิกติดตาม
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
}

export function getAdminSubscription() {
    return `
        <div class="space-y-4">
            <div class="mb-4">
                <h1 class="text-2xl font-bold text-neutral">จัดการแพ็กเกจ</h1>
                <p class="text-sm text-neutral/60">อัปเกรดเพื่อปลดล็อกฟีเจอร์และขยายขีดจำกัด</p>
            </div>

            <div class="space-y-4 animate-fade-in">
                <div class="bg-neutral rounded-[2rem] p-6 text-white shadow-card relative overflow-hidden">
                    <i data-lucide="zap" class="absolute -right-4 -bottom-4 w-32 h-32 text-white/5"></i>
                    <div class="relative z-10">
                        <div class="text-[10px] text-white/60 font-bold mb-1 uppercase tracking-wider">แพ็กเกจปัจจุบันของคุณ</div>
                        <div class="text-2xl font-bold flex items-center gap-2 mb-2">
                            <span class="bg-white/20 px-3 py-1 rounded-xl text-white text-lg border border-white/10">${state.subscription.plan}</span>
                        </div>
                        ${state.subscription.plan === 'ทดลองใช้ฟรี' ? `<div class="text-sm text-white/80 mt-3">เหลือเวลาใช้งานอีก <span class="text-secondary font-bold text-lg px-1">${state.subscription.daysLeft}</span> วัน</div>` : ''}
                    </div>
                </div>
                
                <h3 class="font-bold text-neutral px-2 pt-2 text-sm flex items-center gap-2"><i data-lucide="rocket" class="w-4 h-4 text-primary"></i> เลือกแพ็กเกจที่เหมาะกับคุณ</h3>
                
                <div class="grid gap-4 sm:grid-cols-2 mt-4">
                    <div class="bg-white rounded-[2rem] p-6 border border-brand-100 shadow-sm relative transition-transform active:scale-[0.98]">
                        <div class="font-bold text-lg text-neutral mb-1">แพ็กเกจ Basic</div>
                        <div class="text-3xl font-black text-primary mb-4">฿390 <span class="text-sm font-normal text-neutral/50">/ เดือน</span></div>
                        <ul class="space-y-2 mb-6 text-sm text-neutral/70 font-medium">
                            <li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-success"></i> สร้างได้สูงสุด 10 คอร์ส</li>
                            <li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-success"></i> รับนักเรียนได้สูงสุด 100 คน</li>
                            <li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-success"></i> ระบบเช็คชื่อเข้าเรียน</li>
                        </ul>
                        <button onclick="app.requestUpgradePlan('แพ็กเกจ Basic')" class="btn btn-outline btn-primary w-full rounded-full">อัปเกรดเป็น Basic</button>
                    </div>
                    
                    <div class="bg-white rounded-[2rem] p-6 border-2 border-secondary/50 shadow-soft relative transition-transform active:scale-[0.98] overflow-hidden">
                        <div class="absolute top-0 right-0 bg-secondary text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-2xl shadow-sm">ยอดนิยม</div>
                        <div class="font-bold text-lg text-neutral mb-1">แพ็กเกจ Pro</div>
                        <div class="text-3xl font-black text-secondary mb-4">฿890 <span class="text-sm font-normal text-neutral/50">/ เดือน</span></div>
                        <ul class="space-y-2 mb-6 text-sm text-neutral/70 font-medium">
                            <li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-success"></i> สร้างคอร์สไม่จำกัด</li>
                            <li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-success"></i> รับนักเรียนไม่จำกัด</li>
                            <li class="flex items-center gap-2"><i data-lucide="check" class="w-4 h-4 text-success"></i> ฟรีโดเมนเนมของตัวเอง</li>
                        </ul>
                        <button onclick="app.requestUpgradePlan('แพ็กเกจ Pro')" class="btn btn-secondary text-white w-full rounded-full shadow-soft border-none">อัปเกรดเป็น Pro</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export function addScheduleRow(containerId) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'grid grid-cols-12 gap-1 mb-2 schedule-row items-center';
    row.innerHTML = `
        <div class="col-span-1 flex items-center justify-center font-bold text-primary text-[9px] sch-badge bg-primary/10 rounded-lg h-full">-</div>
        <div class="col-span-4"><input type="date" class="sch-date input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" onchange="app.sortAndLabelSchedules('${containerId}')" /></div>
        <div class="col-span-3"><input type="time" class="sch-start input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" onchange="app.sortAndLabelSchedules('${containerId}')" /></div>
        <div class="col-span-3"><input type="time" class="sch-end input input-sm w-full bg-brand-50 border-brand-100 rounded-xl px-1" onchange="app.sortAndLabelSchedules('${containerId}')" /></div>
        <div class="col-span-1 flex items-center justify-center"><button type="button" onclick="this.parentElement.parentElement.remove(); app.sortAndLabelSchedules('${containerId}')" class="text-error/50 hover:text-error"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div>
    `;
    container.appendChild(row);
    lucide.createIcons({ root: row });
    app.sortAndLabelSchedules(containerId);
}

export function renderChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;
    if (app.chartInstance) app.chartInstance.destroy();

    const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const referenceDate = new Date(2026, 4, 25); // May 2026
    
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
        last6Months.push({
            year: d.getFullYear(),
            monthIndex: d.getMonth(),
            monthLabel: monthNames[d.getMonth()],
            amount: 0
        });
    }

    const classPriceMap = {};
    (state.classes || []).forEach(c => {
        classPriceMap[c.id] = c.price || 0;
    });

    (state.bookings || []).forEach(b => {
        if (b.status === 'approved' && b.created_date) {
            const bDate = new Date(app.parseThaiDateTime(b.created_date));
            const bYear = bDate.getFullYear();
            const bMonth = bDate.getMonth();
            
            const slot = last6Months.find(m => m.year === bYear && m.monthIndex === bMonth);
            if (slot) {
                slot.amount += classPriceMap[b.classId] || 0;
            }
        }
    });

    const labels = last6Months.map(d => d.monthLabel);
    const data = last6Months.map(d => d.amount);

    app.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'รายได้ (บาท)',
                data: data,
                borderColor: '#65c3c8',
                backgroundColor: 'rgba(101, 195, 200, 0.2)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ef9fbc',
                pointBorderColor: '#fff',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { callback: function(value) { return '฿' + value.toLocaleString(); } }
                },
                x: { grid: { display: false } }
            }
        }
    });
}


export function switchAdminClassTab(tab) { state.adminClassTab = tab; app.render(); }
export function switchAdminSettingsTab(tab) { state.adminSettingsTab = tab; app.render(); }
export function clearTutorSearch() { state.tutorSearchQuery = ''; state.tutorSearchResults = []; app.render(); }

