// ============================================================================
// Module: Workout Plans Engine (بناء وإدارة الخطط التدريبية - النسخة المحدثة)
// ============================================================================

window.Module_WorkoutPlans = function({ gymId, userId, showToast }) {
    const { useState, useEffect } = React;

    // --- 1. حالة النظام الأساسية ---
    const [view, setView] = useState('list'); // 'list' أو 'builder'
    const [isLoading, setIsLoading] = useState(true);
    
    // بيانات الخطط في واجهة (List)
    const [plans, setPlans] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 4;

    // بيانات بناء الخطة في واجهة (Builder)
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [library, setLibrary] = useState({ categories: [], exercises: [] });
    
    // --- فلاتر و Pagination لأيام التدريب (الميزة الجديدة) ---
    const [daySearchQuery, setDaySearchQuery] = useState('');
    const [dayCurrentPage, setDayCurrentPage] = useState(1);
    const DAYS_PER_PAGE = 3; // ليمت 3 أيام في الصفحة كما طلبت

    // النوافذ المنبثقة (Modals)
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [isDayModalOpen, setIsDayModalOpen] = useState(false);
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);

    // بيانات النماذج
    const [planForm, setPlanForm] = useState({ name: '', level: 'beginner', goal: 'fitness', duration: 4 });
    const [dayForm, setDayForm] = useState({ name: '' });
    const [exerciseForm, setExerciseForm] = useState({ 
        day_id: null, category_id: '', exercise_id: '', sets: 3, reps: '10-12', rest: 60 
    });

    // --- 2. جلب البيانات ---
    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const allPlans = await window.db.workout_plans.reverse().toArray();
            setPlans(allPlans);
        } catch (error) {
            showToast("حدث خطأ أثناء تحميل الخطط", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLibrary = async () => {
        try {
            const cats = await window.db.exercise_categories.toArray();
            const exers = await window.db.exercises.toArray();
            setLibrary({ categories: cats, exercises: exers });
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchPlans();
        fetchLibrary();
    }, []);

    useEffect(() => { setCurrentPage(1); }, [searchQuery]);

    // --- 3. حساب Pagination الخطط (واجهة List) ---
    const filteredPlans = plans.filter(p => p.name.includes(searchQuery));
    const totalPages = Math.ceil(filteredPlans.length / itemsPerPage) || 1;
    const currentPlans = filteredPlans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const levelColors = {
        'beginner': 'bg-emerald-50 text-emerald-600 border-emerald-100',
        'intermediate': 'bg-yellow-50 text-yellow-600 border-yellow-100',
        'advanced': 'bg-rose-50 text-rose-600 border-rose-100'
    };
    const levelNames = { 'beginner': 'مبتدئ', 'intermediate': 'متوسط', 'advanced': 'متقدم' };
    const goalNames = { 'fitness': 'لياقة عامة', 'bulking': 'تضخيم عضلي', 'cutting': 'تنشيف وحرق' };

    // --- 4. معالجة الخطة (إضافة وحذف) ---
    const handlePlanSubmit = async (e) => {
        e.preventDefault();
        try {
            const planId = await window.GymQueries.createWorkoutPlan(
                planForm.name, planForm.level, planForm.goal, planForm.duration
            );
            showToast("تم إنشاء الخطة بنجاح، يمكنك الآن بناء أيام التدريب");
            setIsPlanModalOpen(false);
            setPlanForm({ name: '', level: 'beginner', goal: 'fitness', duration: 4 });
            fetchPlans();
            openBuilder(planId); 
        } catch (error) {
            showToast("حدث خطأ أثناء حفظ الخطة", "error");
        }
    };

    const deletePlan = async (id, e) => {
        e.stopPropagation();
        if(confirm("هل أنت متأكد من حذف هذه الخطة بالكامل؟")) {
            await window.db.workout_plans.delete(id);
            showToast("تم حذف الخطة");
            fetchPlans();
        }
    };

    // --- 5. منطق واجهة بناء الخطة (The Engine Builder) ---
    const openBuilder = async (planId) => {
        setIsLoading(true);
        try {
            const planDetails = await window.GymQueries.getFullPlanDetails(planId);
            setSelectedPlan(planDetails);
            setDaySearchQuery(''); // تصفير بحث الأيام عند فتح خطة جديدة
            setDayCurrentPage(1);  // العودة للصفحة الأولى للأيام
            setView('builder');
        } catch (error) {
            showToast("حدث خطأ أثناء فتح الخطة", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const closeBuilder = () => {
        setSelectedPlan(null);
        setView('list');
        fetchPlans();
    };

    // إضافة يوم تدريب جديد
    const handleDaySubmit = async (e) => {
        e.preventDefault();
        try {
            const dayOrder = selectedPlan.days ? selectedPlan.days.length + 1 : 1;
            await window.GymQueries.addDayToPlan(selectedPlan.id, dayForm.name, dayOrder);
            showToast("تمت إضافة يوم التدريب");
            setIsDayModalOpen(false);
            setDayForm({ name: '' });
            openBuilder(selectedPlan.id); 
        } catch (error) {
            showToast("حدث خطأ", "error");
        }
    };

    // فتح مودال إضافة تمرين
    const openAddExerciseModal = (dayId) => {
        if (library.exercises.length === 0) {
            showToast("مكتبة التمارين فارغة! قم بإضافة تمارين من الشاشة السابقة.", "error");
            return;
        }
        setExerciseForm({ 
            day_id: dayId, 
            category_id: library.categories[0]?.id || '', 
            exercise_id: '', 
            sets: 3, reps: '10-12', rest: 60 
        });
        setIsExerciseModalOpen(true);
    };

    const handleExerciseSubmit = async (e) => {
        e.preventDefault();
        if (!exerciseForm.exercise_id) { showToast("الرجاء اختيار تمرين", "error"); return; }
        
        try {
            await window.GymQueries.addExerciseToDay(
                exerciseForm.day_id, exerciseForm.exercise_id, 
                exerciseForm.sets, exerciseForm.reps, exerciseForm.rest, ""
            );
            showToast("تم ربط التمرين باليوم");
            setIsExerciseModalOpen(false);
            openBuilder(selectedPlan.id); 
        } catch (error) {
            showToast("حدث خطأ", "error");
        }
    };

    const removeExerciseFromDay = async (exId) => {
        if(confirm("إزالة التمرين من هذا اليوم؟")) {
            await window.db.workout_exercises.delete(exId);
            openBuilder(selectedPlan.id);
        }
    };

    const removeDay = async (dayId) => {
        if(confirm("هل أنت متأكد من حذف هذا اليوم بجميع تمارينه؟")) {
            await window.db.workout_days.delete(dayId);
            openBuilder(selectedPlan.id);
        }
    };

    // فلترة التمارين داخل المودال بناءً على الفئة
    const filteredModalExercises = library.exercises.filter(ex => ex.category_id === parseInt(exerciseForm.category_id));

    // --- 6. حساب Pagination وبحث الأيام (داخل Builder) الميزة المطلوبة ---
    const safeDays = selectedPlan?.days || [];
    const filteredDays = safeDays.filter(d => 
        d.day_name.toLowerCase().includes(daySearchQuery.toLowerCase()) || 
        d.day_order.toString().includes(daySearchQuery)
    );
    const totalDayPages = Math.ceil(filteredDays.length / DAYS_PER_PAGE) || 1;
    
    // تصحيح الصفحة إذا زادت عن الحد بسبب الفلترة أو الحذف
    let actualDayPage = dayCurrentPage;
    if (actualDayPage > totalDayPages) {
        actualDayPage = 1;
        if (dayCurrentPage !== 1) setDayCurrentPage(1);
    }
    
    const currentDaysList = filteredDays.slice((actualDayPage - 1) * DAYS_PER_PAGE, actualDayPage * DAYS_PER_PAGE);


    // ==============================================================================================
    // واجهة المستخدم (UI)
    // ==============================================================================================
    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-24 md:pb-6 animate-view">
            
            {/* ======================= 1. واجهة قائمة الخطط (List View) ======================= */}
            {view === 'list' && (
                <>
                    <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex w-full md:w-auto items-center justify-between md:justify-start gap-4">
                            <div className="flex items-center gap-3 text-indigo-500 font-black text-lg md:text-xl">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                    <i className="fas fa-clipboard-list"></i>
                                </div>
                                الخطط التدريبية
                            </div>
                            <button onClick={() => setIsPlanModalOpen(true)} className="md:hidden bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2">
                                <i className="fas fa-plus"></i> خطة
                            </button>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full sm:w-72">
                                <input type="text" placeholder="بحث باسم الخطة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl pl-4 pr-10 py-3 outline-none focus:border-indigo-500 transition-all shadow-inner" />
                                <i className="fas fa-search absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                            </div>
                            <button onClick={() => setIsPlanModalOpen(true)} className="hidden md:flex bg-indigo-500 text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg hover:bg-indigo-600 transition-all items-center gap-2">
                                <i className="fas fa-plus"></i> بناء خطة جديدة
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[400px]">
                        <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-black text-slate-800 text-base"><i className="fas fa-layer-group text-slate-400 ml-2"></i> أرشيف الخطط</h3>
                            <span className="bg-white border border-indigo-100 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">إجمالي: {filteredPlans.length}</span>
                        </div>
                        
                        <div className="p-4 sm:p-6">
                            {isLoading ? (
                                <div className="flex justify-center items-center py-16"><i className="fas fa-circle-notch fa-spin text-3xl text-indigo-500"></i></div>
                            ) : currentPlans.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {currentPlans.map((plan) => (
                                        <div key={plan.id} onClick={() => openBuilder(plan.id)} className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group flex flex-col relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-100 transition-colors"></div>
                                            <div className="relative z-10 flex justify-between items-start mb-4">
                                                <div>
                                                    <h4 className="font-black text-slate-800 text-lg mb-1">{plan.name}</h4>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                                        <i className="fas fa-calendar-alt text-indigo-400"></i> مدة الخطة: {plan.duration_weeks} أسابيع
                                                    </div>
                                                </div>
                                                <button onClick={(e) => deletePlan(plan.id, e)} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-colors"><i className="fas fa-trash text-xs"></i></button>
                                            </div>
                                            <div className="relative z-10 mt-auto flex items-center gap-2 pt-4 border-t border-slate-100">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black border ${levelColors[plan.level]}`}>{levelNames[plan.level]}</span>
                                                <span className="px-3 py-1 rounded-lg text-[10px] font-black border bg-slate-50 text-slate-600 border-slate-200"><i className="fas fa-bullseye text-slate-400 mr-1"></i> {goalNames[plan.goal]}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4"><i className="fas fa-folder-open text-4xl opacity-50"></i></div>
                                    <p className="text-base font-bold text-center">لا توجد خطط تدريبية مطابقة</p>
                                </div>
                            )}

                            {/* Pagination الخطط */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-3 mt-6 pt-6 border-t border-slate-100">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 flex items-center justify-center hover:bg-slate-100"><i className="fas fa-chevron-right"></i></button>
                                    <span className="text-sm font-bold text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-lg">صفحة {currentPage} من {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 flex items-center justify-center hover:bg-slate-100"><i className="fas fa-chevron-left"></i></button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ======================= 2. واجهة بناء الخطة (Builder View - تصميم جديد وإصلاح الأخطاء) ======================= */}
            {view === 'builder' && selectedPlan && (
                <div className="animate-view space-y-6">
                    
                    {/* شريط أدوات البناء المطور (بدون sticky لتجنب التداخل) */}
                    <div className="bg-indigo-600 rounded-[2rem] p-5 sm:p-6 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                        
                        <div className="flex items-center gap-4 w-full md:w-auto relative z-10">
                            <button onClick={closeBuilder} className="w-12 h-12 shrink-0 rounded-2xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors border border-white/20">
                                <i className="fas fa-arrow-right text-lg"></i>
                            </button>
                            <div>
                                <h2 className="font-black text-xl sm:text-2xl">{selectedPlan.name}</h2>
                                <p className="text-xs font-bold text-indigo-200 mt-1"><i className="fas fa-layer-group"></i> مُنشئ الأيام والتمارين</p>
                            </div>
                        </div>

                        {/* أدوات البحث والإضافة للأيام */}
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto relative z-10">
                            <div className="relative w-full sm:w-64">
                                <input type="text" placeholder="بحث عن يوم..." value={daySearchQuery} onChange={(e) => {setDaySearchQuery(e.target.value); setDayCurrentPage(1);}} className="w-full bg-black/20 border border-white/10 text-sm font-bold text-white placeholder-indigo-200 rounded-xl pl-4 pr-10 py-3 outline-none focus:border-white/40 transition-all" />
                                <i className="fas fa-search absolute top-1/2 right-4 -translate-y-1/2 text-indigo-300"></i>
                            </div>
                            <button onClick={() => setIsDayModalOpen(true)} className="w-full sm:w-auto bg-white text-indigo-600 hover:bg-slate-50 px-6 py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-md">
                                <i className="fas fa-calendar-plus"></i> إضافة يوم
                            </button>
                        </div>
                    </div>

                    {/* عرض الأيام (مع الليمت والبحث) */}
                    {isLoading ? (
                        <div className="flex justify-center items-center py-16"><i className="fas fa-circle-notch fa-spin text-4xl text-indigo-500"></i></div>
                    ) : currentDaysList.length > 0 ? (
                        <div className="space-y-6">
                            {currentDaysList.map((day) => (
                                <div key={day.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden relative">
                                    {/* عنوان اليوم */}
                                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-lg shadow-inner">
                                                {day.day_order}
                                            </div>
                                            <h3 className="font-black text-slate-800 text-lg">{day.day_name}</h3>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openAddExerciseModal(day.id)} className="flex-1 sm:flex-none bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-xs font-black border border-indigo-100 hover:bg-indigo-500 hover:text-white transition-colors shadow-sm flex items-center justify-center gap-2">
                                                <i className="fas fa-plus"></i> تمرين
                                            </button>
                                            <button onClick={() => removeDay(day.id)} className="w-10 h-10 rounded-xl bg-white text-rose-500 border border-rose-100 flex items-center justify-center hover:bg-rose-50 transition-colors shadow-sm shrink-0"><i className="fas fa-trash text-sm"></i></button>
                                        </div>
                                    </div>

                                    {/* التمارين داخل اليوم */}
                                    <div className="p-4 sm:p-5 bg-white">
                                        {day.exercises && day.exercises.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {day.exercises.map((dex, index) => (
                                                    <div key={dex.id} className="flex items-center bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 hover:border-indigo-300 transition-colors group shadow-sm">
                                                        <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs ml-0 mr-3 rtl:mr-0 rtl:ml-3 border border-slate-200">{index + 1}</div>
                                                        <div className="flex-1 overflow-hidden ml-3">
                                                            <h4 className="font-black text-slate-800 text-sm truncate">{dex.exercise_details?.name || 'تمرين محذوف'}</h4>
                                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                                                <span className="bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold"><i className="fas fa-dumbbell mr-1 text-indigo-400"></i>{dex.sets} مج</span>
                                                                <span className="bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold"><i className="fas fa-redo mr-1 text-emerald-400"></i>{dex.reps} عدة</span>
                                                                <span className="bg-slate-50 border border-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold"><i className="fas fa-clock mr-1 text-amber-400"></i>{dex.rest_time_seconds}ث</span>
                                                            </div>
                                                        </div>
                                                        <button onClick={() => removeExerciseFromDay(dex.id)} className="w-8 h-8 shrink-0 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"><i className="fas fa-times"></i></button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                <i className="fas fa-bed text-2xl text-slate-300 mb-2"></i>
                                                <p className="text-sm font-bold text-slate-400">يوم راحة أو لم يتم إضافة تمارين بعد</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {/* Pagination الأيام (الميزة المطلوبة) */}
                            {totalDayPages > 1 && (
                                <div className="flex justify-center items-center gap-3 mt-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                    <button onClick={() => setDayCurrentPage(p => Math.max(1, p - 1))} disabled={actualDayPage === 1} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 flex items-center justify-center transition-colors"><i className="fas fa-chevron-right"></i></button>
                                    <span className="text-sm font-bold text-slate-600 px-4">صفحة {actualDayPage} من {totalDayPages}</span>
                                    <button onClick={() => setDayCurrentPage(p => Math.min(totalDayPages, p + 1))} disabled={actualDayPage === totalDayPages} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 disabled:opacity-50 hover:bg-slate-100 flex items-center justify-center transition-colors"><i className="fas fa-chevron-left"></i></button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-slate-200 p-12 text-center shadow-sm">
                            <div className="w-20 h-20 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center text-4xl mx-auto mb-4"><i className="fas fa-search"></i></div>
                            <h3 className="text-xl font-black text-slate-800 mb-2">لا توجد أيام تدريب</h3>
                            <p className="text-slate-500 text-sm font-bold mb-6">لم يتم العثور على أيام تطابق بحثك، أو أن الخطة فارغة حالياً.</p>
                            {daySearchQuery === '' && (
                                <button onClick={() => setIsDayModalOpen(true)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-black shadow-lg transition-colors">
                                    إضافة أول يوم تدريب
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ================= النوافذ المنبثقة (Modals) ================= */}
            
            {/* مودال إنشاء خطة */}
            {isPlanModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsPlanModalOpen(false)}></div>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 flex flex-col overflow-hidden animate-view">
                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><i className="fas fa-clipboard-list"></i></div>
                            <h3 className="text-lg font-black text-slate-800">بناء خطة جديدة</h3>
                        </div>
                        <form onSubmit={handlePlanSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">اسم الخطة (مثال: Push Pull Legs)</label>
                                <input type="text" value={planForm.name} onChange={e => setPlanForm({...planForm, name: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-1.5">مستوى المتدرب</label>
                                    <select value={planForm.level} onChange={e => setPlanForm({...planForm, level: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                                        <option value="beginner">مبتدئ</option>
                                        <option value="intermediate">متوسط</option>
                                        <option value="advanced">متقدم</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-1.5">الهدف</label>
                                    <select value={planForm.goal} onChange={e => setPlanForm({...planForm, goal: e.target.value})} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                                        <option value="fitness">لياقة</option>
                                        <option value="bulking">تضخيم</option>
                                        <option value="cutting">تنشيف</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">مدة الخطة (بالأسابيع)</label>
                                <input type="number" min="1" max="24" value={planForm.duration} onChange={e => setPlanForm({...planForm, duration: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500" />
                            </div>
                            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg mt-4 transition-colors">إنشاء والبدء بالبناء</button>
                        </form>
                    </div>
                </div>
            )}

            {/* مودال إضافة يوم */}
            {isDayModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDayModalOpen(false)}></div>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 flex flex-col overflow-hidden animate-view">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800"><i className="fas fa-calendar-plus text-indigo-500 ml-2"></i> إضافة يوم تدريب</h3>
                        </div>
                        <form onSubmit={handleDaySubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">اسم اليوم (مثال: يوم الصدر والتراي)</label>
                                <input type="text" value={dayForm.name} onChange={e => setDayForm({...dayForm, name: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500" />
                            </div>
                            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg transition-colors">حفظ اليوم</button>
                        </form>
                    </div>
                </div>
            )}

            {/* مودال ربط تمرين باليوم */}
            {isExerciseModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsExerciseModalOpen(false)}></div>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 flex flex-col max-h-[90vh] overflow-hidden animate-view">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800"><i className="fas fa-dumbbell text-indigo-500 ml-2"></i> إضافة تمرين لليوم</h3>
                        </div>
                        <form onSubmit={handleExerciseSubmit} className="p-6 overflow-y-auto hide-scrollbar space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">فلترة بالفئة العضلية</label>
                                <select value={exerciseForm.category_id} onChange={e => setExerciseForm({...exerciseForm, category_id: e.target.value, exercise_id: ''})} className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                                    {library.categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1.5">اختر التمرين</label>
                                <select value={exerciseForm.exercise_id} onChange={e => setExerciseForm({...exerciseForm, exercise_id: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-indigo-500">
                                    <option value="" disabled>-- اختر تمريناً --</option>
                                    {filteredModalExercises.map(ex => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-1 text-center">المجموعات</label>
                                    <input type="number" min="1" value={exerciseForm.sets} onChange={e => setExerciseForm({...exerciseForm, sets: e.target.value})} required className="w-full bg-white border border-slate-200 text-sm font-bold rounded-xl px-2 py-2.5 outline-none focus:border-indigo-500 text-center shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-1 text-center">العدات</label>
                                    <input type="text" value={exerciseForm.reps} onChange={e => setExerciseForm({...exerciseForm, reps: e.target.value})} required className="w-full bg-white border border-slate-200 text-sm font-bold rounded-xl px-2 py-2.5 outline-none focus:border-indigo-500 text-center shadow-sm" placeholder="10-12" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 mb-1 text-center">الراحة (ث)</label>
                                    <input type="number" min="0" step="15" value={exerciseForm.rest} onChange={e => setExerciseForm({...exerciseForm, rest: e.target.value})} required className="w-full bg-white border border-slate-200 text-sm font-bold rounded-xl px-2 py-2.5 outline-none focus:border-indigo-500 text-center shadow-sm" />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg mt-2 transition-colors">إضافة التمرين لليوم</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};