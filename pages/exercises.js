// ============================================================================
// Module: Exercise Library (مكتبة التمارين والفئات - تصميم القائمة الجانبية)
// ============================================================================

window.Module_Exercises = function({ gymId, userId, showToast }) {
    const { useState, useEffect } = React;

    // --- 1. حالة البيانات ---
    const [categories, setCategories] = useState([]);
    const [exercises, setExercises] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // حالة الفلاتر والبحث
    const [activeCategory, setActiveCategory] = useState('all'); // 'all' أو ID الفئة
    const [searchQuery, setSearchQuery] = useState('');

    // حالة الـ Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6; 

    // حالة النوافذ المنبثقة (Modals)
    const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    
    // بيانات النماذج (Forms)
    const [editingExercise, setEditingExercise] = useState(null);
    const [exFormData, setExFormData] = useState({ name: '', target_muscle: '', category_id: '' });
    
    const [editingCategory, setEditingCategory] = useState(null);
    const [catFormData, setCatFormData] = useState({ name: '' });

    // --- 2. جلب البيانات من IndexedDB ---
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const cats = await window.db.exercise_categories.toArray();
            const exers = await window.db.exercises.toArray();

            const enrichedExercises = exers.map(ex => ({
                ...ex,
                categoryName: cats.find(c => c.id === ex.category_id)?.name || 'فئة محذوفة'
            })).reverse(); 

            setCategories(cats);
            setExercises(enrichedExercises);
        } catch (error) {
            console.error("خطأ في جلب التمارين:", error);
            showToast("حدث خطأ أثناء تحميل مكتبة التمارين", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, activeCategory]);

    // --- 3. الفلترة والـ Pagination ---
    const filteredExercises = exercises.filter(ex => {
        const matchesSearch = ex.name.includes(searchQuery) || ex.target_muscle.includes(searchQuery);
        const matchesCategory = activeCategory === 'all' || ex.category_id === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const totalPages = Math.ceil(filteredExercises.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentExercises = filteredExercises.slice(startIndex, startIndex + itemsPerPage);

    const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
    const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

    // --- 4. معالجة بيانات الفئات (Categories) ---
    const openEditCatModal = (cat, e) => {
        e.stopPropagation(); // لمنع تحديد الفئة عند الضغط على زر التعديل
        setEditingCategory(cat);
        setCatFormData({ name: cat.name });
        setIsCatModalOpen(true);
    };

    const handleCatSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingCategory) {
                await window.db.exercise_categories.update(editingCategory.id, { name: catFormData.name });
                showToast("تم تعديل اسم الفئة بنجاح");
            } else {
                await window.db.exercise_categories.add({ name: catFormData.name });
                showToast("تمت إضافة الفئة بنجاح");
            }
            setIsCatModalOpen(false);
            fetchData();
        } catch (error) {
            showToast("حدث خطأ أثناء حفظ الفئة", "error");
        }
    };

    // --- 5. معالجة بيانات التمارين (Exercises) ---
    const openExModal = (ex = null) => {
        if (categories.length === 0 && !ex) {
            showToast("يجب إضافة فئة عضلية أولاً قبل إضافة تمرين!", "error");
            return;
        }
        if (ex) {
            setEditingExercise(ex);
            setExFormData({ name: ex.name, target_muscle: ex.target_muscle, category_id: ex.category_id });
        } else {
            setEditingExercise(null);
            setExFormData({ name: '', target_muscle: '', category_id: categories[0]?.id || '' });
        }
        setIsExerciseModalOpen(true);
    };

    const handleExSubmit = async (e) => {
        e.preventDefault();
        try {
            const dataToSave = {
                name: exFormData.name,
                target_muscle: exFormData.target_muscle,
                category_id: parseInt(exFormData.category_id)
            };

            if (editingExercise) {
                await window.db.exercises.update(editingExercise.id, dataToSave);
                showToast("تم تحديث التمرين بنجاح");
            } else {
                await window.db.exercises.add(dataToSave);
                showToast("تم إضافة التمرين لمكتبتك");
            }
            setIsExerciseModalOpen(false);
            fetchData();
        } catch (error) {
            showToast("حدث خطأ أثناء حفظ التمرين", "error");
        }
    };

    const deleteExercise = async (id) => {
        if(confirm("هل أنت متأكد من حذف هذا التمرين؟ لن يؤثر ذلك على سجلات الأعضاء السابقة.")) {
            try {
                await window.db.exercises.delete(id);
                showToast("تم حذف التمرين");
                fetchData();
            } catch (error) {
                showToast("حدث خطأ أثناء الحذف", "error");
            }
        }
    };

    return (
        <div className="space-y-6 fade-up pb-24 md:pb-6 relative max-w-7xl mx-auto">
            
            {/* ================= الهيدر والبحث ================= */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex w-full md:w-auto items-center justify-between md:justify-start gap-4">
                    <div className="flex items-center gap-3 text-[#06B6D4] font-black text-lg md:text-xl">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center border border-cyan-100">
                            <i className="fas fa-dumbbell"></i>
                        </div>
                        مكتبة التمارين
                    </div>
                    
                    <button onClick={() => openExModal()} className="md:hidden bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 active:scale-95 transition-transform">
                        <i className="fas fa-plus"></i> تمرين
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full sm:w-72">
                        <input 
                            type="text" 
                            placeholder="بحث عن تمرين أو عضلة..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl pl-4 pr-10 py-3 outline-none focus:border-[#3B82F6] focus:bg-white transition-all shadow-inner"
                        />
                        <i className="fas fa-search absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                    </div>
                    
                    <button onClick={() => openExModal()} className="hidden md:flex bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white px-5 py-3 rounded-2xl text-sm font-black shadow-lg hover:-translate-y-0.5 items-center gap-2 transition-all">
                        <i className="fas fa-plus"></i> إضافة تمرين
                    </button>
                </div>
            </div>

            {/* ================= الهيكل الجديد (قائمة جانبية للفئات + شبكة التمارين) ================= */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* 1. القائمة الجانبية للفئات العضلية (Categories Sidebar) */}
                <div className="w-full lg:w-1/4 bg-white rounded-3xl shadow-sm border border-slate-100 p-4 lg:p-5 lg:sticky lg:top-24">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                        <h3 className="font-black text-slate-800 text-base"><i className="fas fa-layer-group text-[#06B6D4] ml-2"></i> الفئات العضلية</h3>
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-lg text-xs font-bold">{categories.length}</span>
                    </div>
                    
                    {/* قائمة الأزرار تحت بعض */}
                    <div className="flex flex-col gap-2 max-h-[350px] lg:max-h-[60vh] overflow-y-auto hide-scrollbar">
                        
                        {/* زر عرض الكل */}
                        <button 
                            onClick={() => setActiveCategory('all')} 
                            className={`w-full text-right px-4 py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-between ${activeCategory === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'}`}
                        >
                            <span><i className="fas fa-th-large ml-2 opacity-50"></i> عرض الكل</span>
                            {activeCategory === 'all' && <i className="fas fa-check text-xs text-[#06B6D4]"></i>}
                        </button>
                        
                        {/* الفئات الديناميكية مع زر التعديل */}
                        {categories.map(cat => (
                            <div 
                                key={cat.id} 
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-black transition-all border group ${activeCategory === cat.id ? 'bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white shadow-md border-transparent' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-100'}`}
                            >
                                {/* منطقة النقر لتحديد الفئة */}
                                <div className="flex-1 flex items-center cursor-pointer truncate" onClick={() => setActiveCategory(cat.id)}>
                                    <i className="fas fa-tag ml-2 opacity-50 text-xs"></i> 
                                    <span className="truncate pr-1">{cat.name}</span>
                                </div>
                                
                                {/* أزرار التحكم (التعديل والمؤشر) */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {activeCategory === cat.id && <i className="fas fa-check text-xs ml-1"></i>}
                                    <button 
                                        onClick={(e) => openEditCatModal(cat, e)} 
                                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeCategory === cat.id ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-slate-200 text-slate-500 hover:bg-[#06B6D4] hover:text-white'}`}
                                        title="تعديل اسم الفئة"
                                    >
                                        <i className="fas fa-pen text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* زر إضافة فئة جديدة */}
                        <button 
                            onClick={() => { setEditingCategory(null); setCatFormData({name:''}); setIsCatModalOpen(true); }} 
                            className="w-full mt-2 px-4 py-3.5 rounded-2xl text-sm font-black bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-plus"></i> إضافة فئة جديدة
                        </button>
                    </div>
                </div>

                {/* 2. شبكة التمارين (Exercises Grid) */}
                <div className="flex-1 w-full bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[400px]">
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-3xl">
                        <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                            <i className="fas fa-dumbbell text-slate-400"></i> قائمة التمارين
                        </h3>
                        <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold">
                            النتيجة: {filteredExercises.length}
                        </span>
                    </div>

                    <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                        {isLoading ? (
                            <div className="flex justify-center items-center flex-1 py-10"><i className="fas fa-circle-notch fa-spin text-3xl text-[#06B6D4]"></i></div>
                        ) : currentExercises.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {currentExercises.map((ex) => (
                                    <div key={ex.id} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-[#06B6D4] hover:shadow-md transition-all group flex items-start gap-4 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-slate-50 to-transparent rounded-bl-3xl -z-10"></div>
                                        
                                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-50 flex items-center justify-center text-[#3B82F6] text-2xl border border-slate-100 group-hover:scale-110 transition-transform">
                                            <i className="fas fa-running"></i>
                                        </div>
                                        
                                        <div className="flex-1 overflow-hidden">
                                            <h4 className="font-black text-slate-800 text-base truncate">{ex.name}</h4>
                                            <p className="text-xs font-bold text-slate-400 mt-1 truncate"><i className="fas fa-crosshairs text-[#06B6D4] mr-1"></i> {ex.target_muscle}</p>
                                            <div className="mt-3 flex items-center gap-2">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold truncate max-w-[120px] border border-slate-200">{ex.categoryName}</span>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => openExModal(ex)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"><i className="fas fa-pen text-xs"></i></button>
                                            <button onClick={() => deleteExercise(ex.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors"><i className="fas fa-trash text-xs"></i></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 py-12 text-slate-400">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <i className="fas fa-box-open text-4xl opacity-50"></i>
                                </div>
                                <p className="text-base font-bold text-center px-4 text-slate-800">لا توجد تمارين هنا</p>
                                <p className="text-xs font-bold text-center mt-2 text-slate-500">اختر فئة أخرى أو قم بإضافة تمرين جديد</p>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    صفحة {currentPage} من {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={prevPage} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#06B6D4] hover:text-white disabled:opacity-50 transition-colors shadow-sm"><i className="fas fa-chevron-right text-sm"></i></button>
                                    <button onClick={nextPage} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#06B6D4] hover:text-white disabled:opacity-50 transition-colors shadow-sm"><i className="fas fa-chevron-left text-sm"></i></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ================= إعلان النسخة المدفوعة ================= */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-blue-500/20 group mt-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700"></div>
                
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center lg:text-right text-white">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-blue-400 text-xs font-black mb-3 backdrop-blur-sm">
                            <i className="fas fa-video animate-pulse"></i> مكتبة تمارين متحركة (3D)
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">
                            فيديوهات توضيحية للأعضاء في <span className="text-transparent bg-clip-text bg-gradient-to-l from-[#06B6D4] to-[#3B82F6]">MentraGym PRO</span>
                        </h3>
                        <p className="text-slate-400 font-bold text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto lg:mx-0">
                            في النسخة السحابية، يمتلك كل عضو تطبيق موبايل خاص به يعرض له خطة التمرين اليومية مدعومة بمقاطع فيديو قصيرة لشرح الأداء الصحيح لتخفيف الضغط على المدربين.
                        </p>
                    </div>
                    
                    <a href="https://wa.me/201211934816" target="_blank" className="w-full lg:w-auto bg-white/10 hover:bg-white/20 text-white font-black px-8 py-3.5 rounded-xl shadow-lg transition-all border border-white/20 flex items-center justify-center gap-3 whitespace-nowrap text-sm sm:text-base">
                        <i className="fab fa-whatsapp text-2xl text-[#25D366]"></i>
                        <span>احصل على النسخة الكاملة</span>
                    </a>
                </div>
            </div>

            {/* ================= مودال الفئات (Category Modal) ================= */}
            {isCatModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsCatModalOpen(false)}></div>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm relative z-10 animate-view flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <i className="fas fa-tags text-emerald-500"></i>
                                {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
                            </h3>
                        </div>
                        <form onSubmit={handleCatSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">اسم الفئة (مثال: عضلات الظهر)</label>
                                <input type="text" value={catFormData.name} onChange={e => setCatFormData({name: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setIsCatModalOpen(false)} className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors">إلغاء</button>
                                <button type="submit" className="flex-1 bg-emerald-500 text-white font-black py-3 rounded-xl shadow-lg hover:bg-emerald-600 transition-colors">حفظ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ================= مودال التمارين (Exercise Modal) ================= */}
            {isExerciseModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsExerciseModalOpen(false)}></div>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 animate-view flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <i className="fas fa-dumbbell text-[#06B6D4]"></i>
                                {editingExercise ? 'تعديل التمرين' : 'تمرين جديد'}
                            </h3>
                            <button onClick={() => setIsExerciseModalOpen(false)} className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center hover:bg-slate-200">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <form onSubmit={handleExSubmit} className="p-6 overflow-y-auto hide-scrollbar space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">اختر الفئة</label>
                                <div className="relative">
                                    <select value={exFormData.category_id} onChange={e => setExFormData({...exFormData, category_id: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pl-4 pr-11 py-3 outline-none focus:border-[#3B82F6] appearance-none cursor-pointer">
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    <i className="fas fa-layer-group absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                                    <i className="fas fa-chevron-down absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">اسم التمرين</label>
                                <input type="text" value={exFormData.name} onChange={e => setExFormData({...exFormData, name: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6] transition-colors" placeholder="مثال: تجميع بالدمبلص مستوي" />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">العضلة المستهدفة بدقة</label>
                                <div className="relative">
                                    <input type="text" value={exFormData.target_muscle} onChange={e => setExFormData({...exFormData, target_muscle: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pr-11 pl-4 py-3 outline-none focus:border-[#3B82F6] transition-colors" placeholder="مثال: الصدر الأوسط" />
                                    <i className="fas fa-crosshairs absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white font-black py-4 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 text-base transition-all active:scale-95">
                                <i className="fas fa-save"></i> حفظ التمرين
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};