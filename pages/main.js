// ============================================================================
// Module: Main Dashboard (Gym Overview) - Mobile Optimized
// ============================================================================

window.Module_Main = function({ gymId, userId, showToast, setActiveModule }) {
    const { useState, useEffect } = React;

    // --- 1. إدارة التواريخ (من / إلى) ---
    const getTodayStr = () => new Date().toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(getTodayStr());
    const [toDate, setToDate] = useState(getTodayStr());

    // --- 2. حالة البيانات ---
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ totalMembers: 0, totalPlans: 0, logsCount: 0 });
    const [recentLogs, setRecentLogs] = useState([]);
    
    // --- 3. حالة الـ Pagination ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3; 

    // --- 4. جلب البيانات من IndexedDB ---
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!window.db) return;
            setIsLoading(true);
            try {
                const membersCount = await window.db.members.count();
                const plansCount = await window.db.workout_plans.count();

                const logs = await window.db.workout_logs
                    .where('date')
                    .between(fromDate, toDate, true, true)
                    .reverse() 
                    .toArray();

                const enrichedLogs = await Promise.all(logs.map(async (log) => {
                    const member = await window.db.members.get(log.member_id);
                    const plan = await window.db.workout_plans.get(log.plan_id);
                    return {
                        ...log,
                        memberName: member ? member.name : 'عضو غير معروف',
                        planName: plan ? plan.name : 'خطة محذوفة'
                    };
                }));

                setStats({
                    totalMembers: membersCount,
                    totalPlans: plansCount,
                    logsCount: logs.length
                });
                
                setRecentLogs(enrichedLogs);
                setCurrentPage(1);
            } catch (error) {
                console.error("خطأ في جلب بيانات الرئيسية:", error);
                showToast("حدث خطأ أثناء تحميل البيانات", "error");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [fromDate, toDate]);

    // --- 5. منطق الـ Pagination ---
    const totalPages = Math.ceil(recentLogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentLogs = recentLogs.slice(startIndex, startIndex + itemsPerPage);

    const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
    const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

    return (
        // إضافة pb-24 (Padding Bottom) مهمة جداً للموبايل عشان المحتوى ميتغطاش بالقائمة السفلية
        <div className="space-y-6 fade-up pb-24 md:pb-6">
            
            {/* ================= شريط فلتر التاريخ ================= */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-[#06B6D4] font-black text-lg md:text-xl">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100">
                        <i className="fas fa-chart-line"></i>
                    </div>
                    ملخص الأداء
                </div>
                
                {/* تعديل الفلاتر لتأخذ عرض الشاشة على الموبايل */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto bg-slate-50 p-2 sm:p-3 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2 w-full sm:w-auto bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-black text-slate-400">من:</span>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none" />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-sm">
                        <span className="text-xs font-black text-slate-400">إلى:</span>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full bg-transparent text-sm font-bold text-slate-700 outline-none" />
                    </div>
                </div>
            </div>

            {/* ================= بطاقات الإحصائيات ================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:border-cyan-200 transition-colors">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-cyan-50 text-[#06B6D4] flex items-center justify-center text-2xl relative z-10 border border-cyan-100"><i className="fas fa-users"></i></div>
                    <div className="relative z-10 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-400">إجمالي الأعضاء</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{isLoading ? '...' : stats.totalMembers}</h3>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:border-blue-200 transition-colors">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-blue-50 text-[#3B82F6] flex items-center justify-center text-2xl relative z-10 border border-blue-100"><i className="fas fa-fire"></i></div>
                    <div className="relative z-10 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-400">تمارين للتاريخ المحدد</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{isLoading ? '...' : stats.logsCount}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group sm:col-span-2 md:col-span-1 hover:border-indigo-200 transition-colors">
                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-2xl relative z-10 border border-indigo-100"><i className="fas fa-clipboard-list"></i></div>
                    <div className="relative z-10 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-400">خطط متاحة</p>
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-800 mt-1">{isLoading ? '...' : stats.totalPlans}</h3>
                    </div>
                </div>
            </div>

            {/* ================= القسم الأوسط ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* الوصول السريع (مُحسّن للموبايل) */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-1 flex flex-col h-full">
                    <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><i className="fas fa-bolt text-yellow-500"></i> وصول سريع</h3>
                    {/* تعديل الأزرار لتاخد padding بدل طول ثابت */}
                    <div className="grid grid-cols-2 gap-3 flex-1">
                        <button onClick={() => setActiveModule('tracking')} className="bg-slate-50 hover:bg-[#06B6D4] hover:text-white text-slate-600 py-6 px-2 rounded-2xl border border-slate-100 transition-all group flex flex-col items-center justify-center gap-3 text-center shadow-sm hover:shadow-md">
                            <i className="fas fa-stopwatch text-3xl group-hover:scale-110 transition-transform text-[#06B6D4] group-hover:text-white"></i>
                            <span className="font-bold text-xs sm:text-sm">تسجيل تمرينة</span>
                        </button>
                        <button onClick={() => setActiveModule('members')} className="bg-slate-50 hover:bg-[#3B82F6] hover:text-white text-slate-600 py-6 px-2 rounded-2xl border border-slate-100 transition-all group flex flex-col items-center justify-center gap-3 text-center shadow-sm hover:shadow-md">
                            <i className="fas fa-user-plus text-3xl group-hover:scale-110 transition-transform text-[#3B82F6] group-hover:text-white"></i>
                            <span className="font-bold text-xs sm:text-sm">إضافة عضو</span>
                        </button>
                        <button onClick={() => setActiveModule('plans')} className="col-span-2 bg-gradient-to-l from-indigo-50 to-slate-50 hover:from-indigo-500 hover:to-indigo-600 hover:text-white text-slate-600 py-5 px-4 rounded-2xl border border-indigo-100 transition-all group flex items-center justify-center gap-4 text-center shadow-sm hover:shadow-md">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center group-hover:bg-white/20 group-hover:text-white transition-colors">
                                <i className="fas fa-layer-group text-xl"></i>
                            </div>
                            <span className="font-black text-sm sm:text-base">بناء خطة تدريبية جديدة</span>
                        </button>
                    </div>
                </div>

                {/* جدول التمارين */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 lg:col-span-2 flex flex-col min-h-[350px]">
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap justify-between items-center bg-slate-50/50 rounded-t-3xl gap-2">
                        <h3 className="font-black text-slate-800 text-base sm:text-lg flex items-center gap-2"><i className="fas fa-history text-slate-400"></i> أحدث التمارين المسجلة</h3>
                        <span className="bg-[#06B6D4]/10 text-[#06B6D4] px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold border border-[#06B6D4]/20">للتاريخ المحدد</span>
                    </div>
                    
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                        {isLoading ? (
                            <div className="flex justify-center items-center flex-1 py-10"><i className="fas fa-circle-notch fa-spin text-3xl text-[#06B6D4]"></i></div>
                        ) : currentLogs.length > 0 ? (
                            <div className="space-y-3">
                                {currentLogs.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl border border-slate-100 hover:border-cyan-200 hover:shadow-md transition-all bg-white">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-black border border-slate-200">
                                                {log.memberName.charAt(0)}
                                            </div>
                                            <div className="flex flex-col overflow-hidden">
                                                <p className="font-black text-slate-800 text-sm truncate">{log.memberName}</p>
                                                <p className="text-xs font-bold text-[#06B6D4] mt-0.5 truncate max-w-[120px] sm:max-w-xs">{log.planName}</p>
                                            </div>
                                        </div>
                                        <div className="text-left shrink-0">
                                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black border border-emerald-100">
                                                <i className="fas fa-check-circle"></i> مكتمل
                                            </div>
                                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 mt-1.5">{log.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 py-10 text-slate-400">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                                    <i className="fas fa-clipboard-check text-3xl opacity-50"></i>
                                </div>
                                <p className="text-sm font-bold text-center px-4">لا يوجد تمارين مسجلة في هذا النطاق الزمني</p>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">صفحة {currentPage} من {totalPages}</span>
                                <div className="flex gap-2">
                                    <button onClick={prevPage} disabled={currentPage === 1} className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#06B6D4] hover:text-white disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-slate-600 transition-colors shadow-sm"><i className="fas fa-chevron-right text-sm"></i></button>
                                    <button onClick={nextPage} disabled={currentPage === totalPages} className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#06B6D4] hover:text-white disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-slate-600 transition-colors shadow-sm"><i className="fas fa-chevron-left text-sm"></i></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ================= إعلان النسخة المدفوعة ================= */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0B1120] via-slate-900 to-slate-800 rounded-3xl p-6 sm:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.1)] border border-[#06B6D4]/30 group mt-4">
                <div className="absolute top-0 right-0 w-48 sm:w-64 h-48 sm:h-64 bg-[#06B6D4]/10 rounded-full blur-[50px] sm:blur-[60px] pointer-events-none group-hover:bg-[#06B6D4]/20 transition-all duration-700"></div>
                <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-[#3B82F6]/10 rounded-full blur-[50px] sm:blur-[60px] pointer-events-none group-hover:bg-[#3B82F6]/20 transition-all duration-700"></div>
                
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center lg:text-right text-white">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-yellow-400 text-xs font-black mb-4 backdrop-blur-sm shadow-inner">
                            <i className="fas fa-crown animate-pulse"></i> اكتشف القوة الحقيقية
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight leading-tight">
                            ارتقِ بصالتك مع <br className="sm:hidden" /> <span className="text-transparent bg-clip-text bg-gradient-to-l from-[#06B6D4] to-[#3B82F6]">MentraGym PRO</span>
                        </h3>
                        <p className="text-slate-400 font-bold text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto lg:mx-0">
                            النسخة السحابية الشاملة توفر لك تطبيق موبايل خاص بالأعضاء، نظام البصمة الإلكترونية (Access Control)، إدارة الاشتراكات المالية وتنبيهات التجديد عبر الواتساب.
                        </p>
                    </div>
                    
                    <a href="https://wa.me/201211934816" target="_blank" className="w-full lg:w-auto bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] hover:opacity-90 text-white font-black px-6 sm:px-8 py-4 rounded-2xl shadow-[0_10px_30px_rgba(6,182,212,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap text-sm sm:text-base border border-white/10">
                        <i className="fab fa-whatsapp text-2xl"></i>
                        <span>تواصل للترقية الآن</span>
                    </a>
                </div>
            </div>

        </div>
    );
};