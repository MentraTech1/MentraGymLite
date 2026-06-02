// ============================================================================
// Module: Workout Tracking & Logging (تسجيل ومتابعة التمارين - النسخة المتطورة)
// ============================================================================

window.Module_WorkoutTracking = function({ gymId, userId, showToast }) {
    const { useState, useEffect } = React;

    // --- 1. حالة الشاشة الأساسية ---
    const [activeTab, setActiveTab] = useState('log'); // 'log' | 'history'
    const [step, setStep] = useState(1); // 1: العضو | 2: اليوم | 3: التسجيل
    const [isLoading, setIsLoading] = useState(false);

    // --- بيانات التبويب الأول (تسجيل التمارين) ---
    const [members, setMembers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [memberPage, setMemberPage] = useState(1);
    const MEMBERS_PER_PAGE = 8;

    const [selectedMember, setSelectedMember] = useState(null);
    const [activePlan, setActivePlan] = useState(null);
    const [allPlans, setAllPlans] = useState([]);
    const [selectedAssignPlan, setSelectedAssignPlan] = useState('');
    const [isChangingPlan, setIsChangingPlan] = useState(false); // حالة جديدة لتغيير الخطة
    
    // فلاتر أيام التدريب (Step 2)
    const [daySearch, setDaySearch] = useState('');
    const [dayPage, setDayPage] = useState(1);
    const DAYS_PER_PAGE = 3; 

    const [selectedDay, setSelectedDay] = useState(null);
    const [exerciseLogs, setExerciseLogs] = useState({});
    const [editingSessionId, setEditingSessionId] = useState(null); // يمثل log_id

    // --- بيانات التبويب الثاني (السجل والإحصائيات) ---
    const [historyLogs, setHistoryLogs] = useState([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [totalHistoryPages, setTotalHistoryPages] = useState(1);
    const HISTORY_PER_PAGE = 3;
    const [stats, setStats] = useState({ totalWorkouts: 0, uniqueMembers: 0, activePlansCount: 0 });

    // فلاتر السجل
    const [historySearch, setHistorySearch] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // --- 2. جلب الأعضاء عند التحميل ---
    useEffect(() => {
        fetchMembers();
    }, []);

    // تحديث السجل عند تغيير الفلاتر أو الصفحة
    useEffect(() => {
        if (activeTab === 'history') {
            loadFilteredHistory();
        }
    }, [activeTab, historyPage, historySearch, fromDate, toDate]);

    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            const allMembers = await window.db.members.toArray();
            const activeMembers = allMembers.filter(m => {
                if (m.status) return m.status === 'active';
                if (m.active_status !== undefined) return m.active_status === 1 || m.active_status === true || m.active_status === '1';
                return true; 
            }).reverse();
            setMembers(activeMembers);
        } catch (error) {
            showToast("خطأ في جلب بيانات الأعضاء", "error");
        } finally {
            setIsLoading(false);
        }
    };

    // الدالة المسؤولة عن جلب وفلترة السجل والإحصائيات
    const loadFilteredHistory = async () => {
        setIsLoading(true);
        try {
            if(!window.db.workout_logs) return;
            
            let sessions = await window.db.workout_logs.orderBy('date').reverse().toArray();

            if (fromDate) sessions = sessions.filter(s => s.date >= fromDate);
            if (toDate) sessions = sessions.filter(s => s.date <= toDate);

            const uniqueMemberIds = new Set(sessions.map(s => s.member_id));
            const allPlanAssignments = await window.db.member_workout_plans?.toArray() || [];
            const activePlansCount = allPlanAssignments.filter(p => p.status === 'active').length;
            
            setStats({
                totalWorkouts: sessions.length, 
                uniqueMembers: uniqueMemberIds.size, 
                activePlansCount: activePlansCount 
            });

            let populated = await Promise.all(sessions.map(async (s) => {
                const member = await window.db.members.get(s.member_id).catch(()=>null);
                const plan = await window.db.workout_plans.get(s.plan_id).catch(()=>null);
                return { 
                    ...s, 
                    member_name: member?.name || 'عضو غير معروف', 
                    plan_name: plan?.name || 'خطة غير معروفة' 
                };
            }));

            if (historySearch.trim() !== '') {
                const query = historySearch.toLowerCase();
                populated = populated.filter(s => 
                    s.member_name.toLowerCase().includes(query) || 
                    s.plan_name.toLowerCase().includes(query)
                );
            }

            const totalPages = Math.ceil(populated.length / HISTORY_PER_PAGE) || 1;
            setTotalHistoryPages(totalPages);
            
            let currentPage = historyPage;
            if (currentPage > totalPages) {
                currentPage = 1;
                setHistoryPage(1);
            }

            const paginatedData = populated.slice((currentPage - 1) * HISTORY_PER_PAGE, currentPage * HISTORY_PER_PAGE);
            setHistoryLogs(paginatedData);

        } catch (error) {
            console.error("Error loading history:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- حساب Pagination الأعضاء ---
    const filteredMembers = members.filter(m => 
        (m.name && m.name.toLowerCase().includes(searchQuery.toLowerCase())) || 
        (m.phone && m.phone.includes(searchQuery))
    );
    const totalMemberPages = Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE) || 1;
    const currentMembers = filteredMembers.slice((memberPage - 1) * MEMBERS_PER_PAGE, memberPage * MEMBERS_PER_PAGE);

    // --- حساب فلاتر و Pagination الأيام ---
    const filteredDays = activePlan?.days?.filter(d => 
        d.day_name.toLowerCase().includes(daySearch.toLowerCase()) || 
        d.day_order.toString().includes(daySearch)
    ) || [];
    const totalDayPages = Math.ceil(filteredDays.length / DAYS_PER_PAGE) || 1;
    const currentDays = filteredDays.slice((dayPage - 1) * DAYS_PER_PAGE, dayPage * DAYS_PER_PAGE);

    // --- الوظائف الأساسية ---
    const handleSelectMember = async (member) => {
        setSelectedMember(member);
        setDaySearch('');
        setDayPage(1);
        setIsChangingPlan(false); // إغلاق نافذة تغيير الخطة لو كانت مفتوحة
        setIsLoading(true);
        try {
            // جلب كل الخطط دائمًا (حتى نتمكن من اختيار خطة للتعيين أو التغيير)
            const plans = await window.db.workout_plans.toArray();
            setAllPlans(plans);

            const activeAssignment = await window.db.member_workout_plans.where('member_id').equals(member.id).and(p => p.status === 'active').first();
            if (activeAssignment) {
                const planDetails = await window.GymQueries.getFullPlanDetails(activeAssignment.plan_id);
                setActivePlan(planDetails);
            } else {
                setActivePlan(null);
            }
            setStep(2);
        } catch (error) {
            showToast("حدث خطأ في جلب الخطة", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAssignPlan = async () => {
        if (!selectedAssignPlan) { showToast("اختر الخطة أولاً", "error"); return; }
        setIsLoading(true);
        try {
            await window.GymQueries.assignPlanToMember(selectedMember.id, selectedAssignPlan);
            showToast(activePlan ? "تم تغيير الخطة بنجاح" : "تم تعيين الخطة بنجاح", "success");
            setSelectedAssignPlan('');
            handleSelectMember(selectedMember); 
        } catch (error) {
            showToast("حدث خطأ أثناء التعيين", "error");
            setIsLoading(false);
        }
    };

    const handleSelectDay = (day) => {
        if (!day.exercises || day.exercises.length === 0) { showToast("هذا اليوم لا يحتوي على تمارين", "error"); return; }
        const initialLogs = {};
        day.exercises.forEach(dex => {
            initialLogs[dex.id] = {
                exercise_id: dex.exercise_id,
                actual_sets: dex.sets || 3, 
                actual_reps: parseInt(dex.reps) || 10,
                weight_used: 0 
            };
        });
        setExerciseLogs(initialLogs);
        setSelectedDay(day);
        setEditingSessionId(null);
        setStep(3);
    };

    const handleLogChange = (dexId, field, value) => {
        setExerciseLogs(prev => ({ ...prev, [dexId]: { ...prev[dexId], [field]: value } }));
    };

    const handleFinishWorkout = async () => {
        setIsLoading(true);
        try {
            const exercisesLogData = Object.values(exerciseLogs);
            if (editingSessionId) {
                await window.db.workout_log_details.where('log_id').equals(editingSessionId).delete();
                const newDetails = exercisesLogData.map(ex => ({
                    log_id: editingSessionId,
                    exercise_id: parseInt(ex.exercise_id),
                    actual_sets: parseInt(ex.actual_sets) || 0,
                    actual_reps: parseInt(ex.actual_reps) || 0,
                    weight_used: parseFloat(ex.weight_used) || 0,
                    notes: ""
                }));
                await window.db.workout_log_details.bulkAdd(newDetails);
                showToast("تم تعديل بيانات التمرينة بنجاح", "success");
            } else {
                await window.GymQueries.logWorkoutSession(selectedMember.id, activePlan.id, selectedDay.id, exercisesLogData);
                showToast("عاش يا وحش! تم التسجيل", "success");
            }
            
            resetState();
            fetchMembers();
            if(activeTab === 'history') loadFilteredHistory();
            
        } catch (error) {
            console.error(error);
            showToast("حدث خطأ أثناء الحفظ", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditSession = async (session) => {
        setIsLoading(true);
        try {
            const member = await window.db.members.get(session.member_id);
            const planDetails = await window.GymQueries.getFullPlanDetails(session.plan_id);
            const day = planDetails.days.find(d => d.id === session.day_id);
            const details = await window.db.workout_log_details.where('log_id').equals(session.id).toArray();

            if(!day) throw new Error("يوم التمرين محذوف من الخطة");

            const initialLogs = {};
            day.exercises.forEach(dex => {
                const existingDetail = details.find(l => l.exercise_id === dex.exercise_id);
                initialLogs[dex.id] = {
                    exercise_id: dex.exercise_id,
                    actual_sets: existingDetail ? existingDetail.actual_sets : (dex.sets || 3),
                    actual_reps: existingDetail ? existingDetail.actual_reps : (parseInt(dex.reps) || 10),
                    weight_used: existingDetail ? existingDetail.weight_used : 0
                };
            });

            setSelectedMember(member);
            setActivePlan(planDetails);
            setSelectedDay(day);
            setExerciseLogs(initialLogs);
            setEditingSessionId(session.id);
            setActiveTab('log');
            setStep(3);
        } catch(err) {
            showToast(err.message || "لا يمكن التعديل", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSession = async (sessionId) => {
        if(!confirm("هل أنت متأكد من حذف هذا السجل بشكل نهائي؟")) return;
        try {
            await window.db.workout_logs.delete(sessionId);
            await window.db.workout_log_details.where('log_id').equals(sessionId).delete();
            showToast("تم الحذف بنجاح", "success");
            loadFilteredHistory();
        } catch (error) {
            showToast("خطأ أثناء الحذف", "error");
        }
    };

    const resetState = () => {
        setSelectedMember(null); setActivePlan(null); setSelectedDay(null); 
        setSearchQuery(''); setDaySearch(''); setStep(1); setEditingSessionId(null); setIsChangingPlan(false);
    };

    // ==============================================================================================
    // واجهة المستخدم (UI)
    // ==============================================================================================
    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-6 animate-view">
            
            {/* التابّات (Tabs) */}
            <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex max-w-sm mx-auto">
                <button onClick={() => {setActiveTab('log'); resetState();}} className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 ${activeTab === 'log' ? 'bg-[#06B6D4] text-white shadow-md transform scale-[1.02]' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fas fa-plus-circle"></i> تسجيل تمرينة
                </button>
                <button onClick={() => {setActiveTab('history'); setHistoryPage(1);}} className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-all duration-300 flex justify-center items-center gap-2 ${activeTab === 'history' ? 'bg-[#06B6D4] text-white shadow-md transform scale-[1.02]' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fas fa-history"></i> السجل والإحصائيات
                </button>
            </div>

            {/* ================= تبويب: تسجيل تمرينة ================= */}
            {activeTab === 'log' && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden relative">
                    
                    {/* شريط العنوان وزر الرجوع */}
                    <div className="bg-slate-50 border-b border-slate-100 p-4 sm:p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg"><i className="fas fa-stopwatch"></i></div>
                            <div>
                                <h2 className="font-black text-slate-800 text-lg">
                                    {step === 1 ? 'اختر المتدرب' : step === 2 ? 'اختر يوم التدريب' : editingSessionId ? 'تعديل التمرينة' : 'الأداء الفعلي'}
                                </h2>
                                <p className="text-xs font-bold text-slate-400 mt-0.5">خطوة {step} من 3</p>
                            </div>
                        </div>
                        {step > 1 && (
                            <button onClick={() => setStep(step - 1)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors flex items-center gap-2 shadow-sm">
                                <i className="fas fa-arrow-right"></i> <span className="hidden sm:inline">رجوع</span>
                            </button>
                        )}
                    </div>

                    <div className="p-4 sm:p-6">
                        {/* ---------------- الخطوة 1: اختيار العضو ---------------- */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <div className="relative max-w-lg mx-auto mb-6">
                                    <input type="text" placeholder="ابحث باسم المتدرب أو رقم الهاتف..." value={searchQuery} onChange={(e) => {setSearchQuery(e.target.value); setMemberPage(1);}} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl pl-4 pr-12 py-3.5 outline-none focus:border-[#06B6D4] focus:bg-white shadow-inner transition-all" />
                                    <i className="fas fa-search absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 text-lg"></i>
                                </div>

                                {isLoading ? (
                                    <div className="flex justify-center py-12"><i className="fas fa-circle-notch fa-spin text-3xl text-[#06B6D4]"></i></div>
                                ) : currentMembers.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentMembers.map(member => (
                                            <div key={member.id} onClick={() => handleSelectMember(member)} className="bg-white border-2 border-slate-100 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-[#06B6D4] hover:shadow-md transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-black text-lg group-hover:bg-[#06B6D4] group-hover:text-white transition-colors">{member.name.charAt(0)}</div>
                                                    <div>
                                                        <h3 className="font-black text-slate-800 text-sm sm:text-base">{member.name}</h3>
                                                        <p className="text-xs font-bold text-slate-400 mt-1"><i className="fas fa-phone mr-1"></i> {member.phone || 'بدون رقم'}</p>
                                                    </div>
                                                </div>
                                                <i className="fas fa-chevron-left text-slate-300 group-hover:text-[#06B6D4] transition-colors"></i>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm"><i className="fas fa-users-slash text-2xl text-slate-400"></i></div>
                                        <h3 className="font-black text-slate-700">لا يوجد متدربين</h3>
                                    </div>
                                )}

                                {/* Pagination */}
                                {totalMemberPages > 1 && (
                                    <div className="flex justify-center items-center gap-3 mt-6 pt-6 border-t border-slate-100">
                                        <button onClick={() => setMemberPage(p => Math.max(1, p - 1))} disabled={memberPage === 1} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200 flex items-center justify-center transition-colors"><i className="fas fa-chevron-right"></i></button>
                                        <span className="text-sm font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">{memberPage} / {totalMemberPages}</span>
                                        <button onClick={() => setMemberPage(p => Math.min(totalMemberPages, p + 1))} disabled={memberPage === totalMemberPages} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200 flex items-center justify-center transition-colors"><i className="fas fa-chevron-left"></i></button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ---------------- الخطوة 2: اختيار اليوم أو تعيين/تغيير الخطة ---------------- */}
                        {step === 2 && selectedMember && (
                            <div className="space-y-6 animate-view">
                                {/* كارت بيانات العضو وزر تغيير الخطة */}
                                <div className="bg-slate-800 rounded-2xl p-5 flex items-center justify-between text-white shadow-lg">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-[#06B6D4] rounded-xl flex items-center justify-center text-2xl font-black shadow-inner">{selectedMember.name.charAt(0)}</div>
                                        <div>
                                            <h3 className="font-black text-lg">{selectedMember.name}</h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                <p className="text-sm font-bold text-slate-300">الخطة: <span className="text-[#06B6D4]">{activePlan?.name || 'غير محددة'}</span></p>
                                                {activePlan && (
                                                    <button onClick={() => setIsChangingPlan(!isChangingPlan)} className={`text-[10px] px-2 py-1 rounded transition-colors border ${isChangingPlan ? 'bg-amber-500 text-white border-amber-600' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}>
                                                        {isChangingPlan ? 'إلغاء التغيير' : 'تغيير الخطة'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isLoading ? (
                                    <div className="flex justify-center py-10"><i className="fas fa-circle-notch fa-spin text-3xl text-[#06B6D4]"></i></div>
                                ) : activePlan && activePlan.days && !isChangingPlan ? (
                                    <div className="space-y-4 animate-view">
                                        {/* شريط البحث عن اليوم */}
                                        <div className="relative max-w-sm mx-auto mb-4">
                                            <input type="text" placeholder="ابحث باسم أو رقم اليوم..." value={daySearch} onChange={(e) => {setDaySearch(e.target.value); setDayPage(1);}} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-[#06B6D4] transition-all" />
                                            <i className="fas fa-search absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"></i>
                                        </div>

                                        {/* عرض الأيام */}
                                        {currentDays.length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                {currentDays.map(day => (
                                                    <div key={day.id} onClick={() => handleSelectDay(day)} className="border-2 border-slate-200 bg-white p-5 rounded-2xl cursor-pointer hover:border-[#06B6D4] hover:bg-cyan-50/30 transition-all flex flex-col items-center text-center group">
                                                        <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center text-lg mb-3 group-hover:bg-[#06B6D4] group-hover:text-white transition-colors"><i className="fas fa-calendar-day"></i></div>
                                                        <span className="text-[10px] font-black text-[#06B6D4] bg-cyan-50 px-2 py-1 rounded mb-1">اليوم {day.day_order}</span>
                                                        <h4 className="font-black text-slate-800 text-base">{day.day_name}</h4>
                                                        <p className="text-xs font-bold text-slate-400 mt-2">{day.exercises?.length || 0} تمارين</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-400 font-bold py-6">لا يوجد يوم يطابق بحثك</p>
                                        )}

                                        {/* Pagination الأيام */}
                                        {totalDayPages > 1 && (
                                            <div className="flex justify-center items-center gap-3 mt-4 pt-4">
                                                <button onClick={() => setDayPage(p => Math.max(1, p - 1))} disabled={dayPage === 1} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200 flex items-center justify-center"><i className="fas fa-chevron-right"></i></button>
                                                <span className="text-xs font-bold text-slate-600">{dayPage} / {totalDayPages}</span>
                                                <button onClick={() => setDayPage(p => Math.min(totalDayPages, p + 1))} disabled={dayPage === totalDayPages} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-50 hover:bg-slate-200 flex items-center justify-center"><i className="fas fa-chevron-left"></i></button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-amber-50 rounded-2xl border border-amber-200 animate-view">
                                        <i className={`fas ${activePlan ? 'fa-exchange-alt' : 'fa-exclamation-circle'} text-3xl text-amber-500 mb-3`}></i>
                                        <h4 className="font-black text-slate-800 text-lg">
                                            {activePlan ? 'اختر الخطة التدريبية الجديدة' : 'المتدرب ليس لديه خطة نشطة'}
                                        </h4>
                                        <div className="max-w-sm mx-auto mt-4 flex gap-2">
                                            <select value={selectedAssignPlan} onChange={(e) => setSelectedAssignPlan(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-amber-400">
                                                <option value="" disabled>-- اختر خطة من المكتبة --</option>
                                                {allPlans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </select>
                                            <button onClick={handleAssignPlan} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold transition-colors shadow-sm">
                                                {activePlan ? 'تغيير' : 'تعيين'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ---------------- الخطوة 3: التسجيل ---------------- */}
                        {step === 3 && selectedDay && (
                            <div className="space-y-5">
                                {selectedDay.exercises.map((dex, index) => (
                                    <div key={dex.id} className="border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-4 md:items-center bg-white shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-[#06B6D4] text-white text-[10px] font-black px-3 py-1 rounded-bl-xl">{index + 1}</div>
                                        <div className="flex-1 pr-6 md:pr-0">
                                            <h4 className="font-black text-slate-800 text-base">{dex.exercise_details?.name || 'تمرين'}</h4>
                                            <p className="text-xs font-bold text-slate-500 mt-1"><i className="fas fa-bullseye text-[#06B6D4]"></i> الهدف: {dex.sets} مجموعات × {dex.reps} عدات</p>
                                        </div>
                                        <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                            <div className="flex-1 md:w-20">
                                                <label className="block text-[9px] font-black text-slate-400 text-center mb-1">المجموعات</label>
                                                <input type="number" min="1" value={exerciseLogs[dex.id]?.actual_sets || ''} onChange={e => handleLogChange(dex.id, 'actual_sets', e.target.value)} className="w-full text-center border border-slate-200 rounded-lg py-1.5 text-sm font-black focus:border-[#06B6D4] outline-none" />
                                            </div>
                                            <div className="flex-1 md:w-20">
                                                <label className="block text-[9px] font-black text-slate-400 text-center mb-1">العدات</label>
                                                <input type="number" min="0" value={exerciseLogs[dex.id]?.actual_reps || ''} onChange={e => handleLogChange(dex.id, 'actual_reps', e.target.value)} className="w-full text-center border border-slate-200 rounded-lg py-1.5 text-sm font-black focus:border-[#06B6D4] outline-none" />
                                            </div>
                                            <div className="flex-1 md:w-24 relative">
                                                <label className="block text-[9px] font-black text-[#06B6D4] text-center mb-1">الوزن</label>
                                                <input type="number" step="1" min="0" value={exerciseLogs[dex.id]?.weight_used || ''} onChange={e => handleLogChange(dex.id, 'weight_used', e.target.value)} className="w-full text-center border border-cyan-200 bg-cyan-50 rounded-lg py-1.5 text-sm font-black text-slate-800 focus:border-[#06B6D4] focus:bg-white outline-none pr-5" />
                                                <span className="absolute bottom-2 left-1.5 text-[9px] font-bold text-slate-400">KG</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button onClick={handleFinishWorkout} disabled={isLoading} className={`w-full py-4 rounded-xl text-white font-black text-lg flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-70 mt-6 ${editingSessionId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                                    {isLoading ? <i className="fas fa-circle-notch fa-spin"></i> : <><i className={`fas ${editingSessionId ? 'fa-save' : 'fa-check-circle'}`}></i> {editingSessionId ? 'حفظ التعديلات' : 'إنهاء التمرينة'}</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================= تبويب: السجل والإحصائيات ================= */}
            {activeTab === 'history' && (
                <div className="space-y-6">
                    
                    {/* شريط الفلاتر المتقدم */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:flex-1 relative">
                            <label className="block text-xs font-bold text-slate-500 mb-1">بحث نصي</label>
                            <input type="text" placeholder="اسم المتدرب أو الخطة..." value={historySearch} onChange={(e) => {setHistorySearch(e.target.value); setHistoryPage(1);}} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-[#06B6D4]" />
                            <i className="fas fa-search absolute bottom-3.5 left-4 text-slate-400"></i>
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
                            <input type="date" value={fromDate} onChange={(e) => {setFromDate(e.target.value); setHistoryPage(1);}} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-[#06B6D4]" />
                        </div>
                        <div className="w-full md:w-48">
                            <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
                            <input type="date" value={toDate} onChange={(e) => {setToDate(e.target.value); setHistoryPage(1);}} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:border-[#06B6D4]" />
                        </div>
                    </div>

                    {/* الإحصائيات (تتحدث مع الفلاتر) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl shrink-0"><i className="fas fa-dumbbell"></i></div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800 leading-none">{stats.totalWorkouts}</h4>
                                <p className="text-xs font-bold text-slate-500 mt-1">إجمالي التمارين بالفترة</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center text-xl shrink-0"><i className="fas fa-users"></i></div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800 leading-none">{stats.uniqueMembers}</h4>
                                <p className="text-xs font-bold text-slate-500 mt-1">متدربين تمرنوا بالفترة</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center text-xl shrink-0"><i className="fas fa-clipboard-list"></i></div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-800 leading-none">{stats.activePlansCount}</h4>
                                <p className="text-xs font-bold text-slate-500 mt-1">إجمالي الخطط النشطة</p>
                            </div>
                        </div>
                    </div>

                    {/* قائمة السجل */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-5 bg-slate-50 border-b border-slate-100">
                            <h3 className="font-black text-slate-800"><i className="fas fa-history text-[#06B6D4] ml-2"></i> سجل الأداء للمتدربين</h3>
                        </div>
                        
                        <div className="divide-y divide-slate-100 relative min-h-[200px]">
                            {isLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10"><i className="fas fa-circle-notch fa-spin text-3xl text-[#06B6D4]"></i></div>
                            ) : historyLogs.length > 0 ? historyLogs.map(session => (
                                <div key={session.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black text-lg shrink-0">
                                            {session.member_name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">{session.member_name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded">{session.plan_name}</span>
                                                <span className="text-[10px] font-black text-[#06B6D4]"><i className="far fa-clock"></i> {session.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                                        <button onClick={() => handleEditSession(session)} className="flex-1 sm:flex-none px-4 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-xs font-bold hover:bg-amber-100 transition-colors"><i className="fas fa-edit mr-1"></i> تعديل</button>
                                        <button onClick={() => handleDeleteSession(session.id)} className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3"><i className="fas fa-search text-2xl text-slate-300"></i></div>
                                    <p className="text-slate-500 font-bold text-sm">لا توجد تمارين تطابق خيارات الفلترة</p>
                                </div>
                            )}
                        </div>

                        {/* Pagination السجل */}
                        {totalHistoryPages > 1 && (
                            <div className="p-4 border-t border-slate-100 flex justify-center items-center gap-3 bg-white">
                                <button onClick={() => setHistoryPage(p => p - 1)} disabled={historyPage === 1} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 flex items-center justify-center hover:bg-slate-100"><i className="fas fa-chevron-right"></i></button>
                                <span className="text-sm font-bold text-slate-600 px-4">صفحة {historyPage} من {totalHistoryPages}</span>
                                <button onClick={() => setHistoryPage(p => p + 1)} disabled={historyPage === totalHistoryPages} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 flex items-center justify-center hover:bg-slate-100"><i className="fas fa-chevron-left"></i></button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* إعلان النسخة المدفوعة */}
            <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl border border-[#06B6D4]/30">
                <div className="text-center md:text-right text-white">
                    <span className="bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block shadow-lg">PRO Version</span>
                    <h3 className="text-xl sm:text-2xl font-black mb-2 tracking-tight">تحليلات الأداء والرسوم البيانية</h3>
                    <p className="text-slate-400 font-bold text-xs sm:text-sm max-w-lg leading-relaxed">النسخة المدفوعة تقوم بتحويل هذه الأرقام إلى رسوم بيانية (Charts) تعرض تطور أوزان المتدرب وقياسات جسمه تلقائياً لرفع قيمة تدريبك.</p>
                </div>
                <a href="https://wa.me/201211934816" target="_blank" className="w-full md:w-auto bg-white hover:bg-slate-50 text-slate-900 font-black px-6 py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm">
                    <i className="fab fa-whatsapp text-[#25D366] text-lg"></i> الترقية الآن
                </a>
            </div>

        </div>
    );
};