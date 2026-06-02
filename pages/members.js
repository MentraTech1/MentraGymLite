// ============================================================================
// Module: Members Management (إدارة الأعضاء)
// ============================================================================

window.Module_Members = function({ gymId, userId, showToast }) {
    const { useState, useEffect } = React;

    // --- 1. حالة البيانات (State) ---
    const [members, setMembers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // حالة الـ Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3; // 5 أعضاء في كل صفحة لشكل مريح على الموبايل

    // حالة النافذة المنبثقة (Modal)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', barcode: '' });

    // --- 2. جلب الأعضاء من قاعدة البيانات ---
    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            // جلب الأعضاء وعكس الترتيب ليظهر الأحدث أولاً
            const allMembers = await window.db.members.reverse().toArray();
            setMembers(allMembers);
        } catch (error) {
            console.error("خطأ في جلب الأعضاء:", error);
            showToast("حدث خطأ أثناء تحميل بيانات الأعضاء", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    // إعادة تعيين الصفحة الأولى عند البحث
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // --- 3. منطق البحث والـ Pagination ---
    const filteredMembers = members.filter(member => 
        member.name.includes(searchQuery) || 
        member.phone.includes(searchQuery) ||
        (member.barcode && member.barcode.includes(searchQuery))
    );

    const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentMembers = filteredMembers.slice(startIndex, startIndex + itemsPerPage);

    const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
    const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

    // --- 4. معالجة النماذج (Add / Edit) ---
    const openModal = (member = null) => {
        if (member) {
            setEditingMember(member);
            setFormData({ name: member.name, phone: member.phone, barcode: member.barcode || '' });
        } else {
            setEditingMember(null);
            // توليد باركود عشوائي مبدئي لتسهيل العمل (يمكن تغييره)
            const randomBarcode = Math.floor(100000 + Math.random() * 900000).toString();
            setFormData({ name: '', phone: '', barcode: randomBarcode });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingMember(null);
        setFormData({ name: '', phone: '', barcode: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.phone) {
            showToast("الرجاء إدخال الاسم ورقم الهاتف", "error");
            return;
        }

        try {
            if (editingMember) {
                // تعديل عضو
                await window.db.members.update(editingMember.id, {
                    name: formData.name,
                    phone: formData.phone,
                    barcode: formData.barcode
                });
                showToast("تم تحديث بيانات العضو بنجاح");
            } else {
                // إضافة عضو جديد
                await window.db.members.add({
                    name: formData.name,
                    phone: formData.phone,
                    barcode: formData.barcode,
                    active_status: true // العضو مفعل افتراضياً
                });
                showToast("تم إضافة العضو الجديد بنجاح");
            }
            closeModal();
            fetchMembers(); // تحديث القائمة
        } catch (error) {
            console.error("خطأ في الحفظ:", error);
            showToast("حدث خطأ أثناء الحفظ", "error");
        }
    };

    // تغيير حالة العضو (نشط / غير نشط)
    const toggleMemberStatus = async (id, currentStatus) => {
        if(confirm(currentStatus ? "هل تريد إيقاف هذا العضو؟" : "هل تريد تفعيل هذا العضو؟")) {
            try {
                await window.db.members.update(id, { active_status: !currentStatus });
                showToast(currentStatus ? "تم إيقاف العضو" : "تم تفعيل العضو");
                fetchMembers();
            } catch (error) {
                showToast("حدث خطأ أثناء تغيير الحالة", "error");
            }
        }
    };

    return (
        // pb-24 ضرورية جداً لضمان عدم اختفاء المحتوى خلف قائمة الموبايل
        <div className="space-y-6 fade-up pb-24 md:pb-6 relative">
            
            {/* الهيدر وشريط البحث */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex w-full md:w-auto items-center justify-between md:justify-start gap-4">
                    <div className="flex items-center gap-3 text-[#3B82F6] font-black text-lg md:text-xl">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
                            <i className="fas fa-users"></i>
                        </div>
                        إدارة الأعضاء
                    </div>
                    
                    <button onClick={() => openModal()} className="md:hidden bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 active:scale-95 transition-transform">
                        <i className="fas fa-plus"></i> عضو جديد
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-72">
                        <input 
                            type="text" 
                            placeholder="بحث بالاسم، الرقم، أو الباركود..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl pl-4 pr-10 py-3 outline-none focus:border-[#3B82F6] focus:bg-white transition-all shadow-inner"
                        />
                        <i className="fas fa-search absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                    </div>
                    
                    <button onClick={() => openModal()} className="hidden md:flex bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white px-5 py-3 rounded-2xl text-sm font-black shadow-[0_5px_15px_rgba(6,182,212,0.3)] hover:shadow-[0_8px_20px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 items-center gap-2 transition-all">
                        <i className="fas fa-plus"></i> إضافة عضو
                    </button>
                </div>
            </div>

            {/* قائمة الأعضاء */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[400px] overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                        <i className="fas fa-list text-slate-400"></i> سجل المتدربين
                    </h3>
                    <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold">
                        إجمالي: {filteredMembers.length}
                    </span>
                </div>
                
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                    {isLoading ? (
                        <div className="flex justify-center items-center flex-1 py-10"><i className="fas fa-circle-notch fa-spin text-3xl text-[#3B82F6]"></i></div>
                    ) : currentMembers.length > 0 ? (
                        <div className="space-y-3">
                            {currentMembers.map((member) => (
                                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all bg-white gap-4">
                                    
                                    {/* معلومات العضو */}
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center text-lg font-black border ${member.active_status ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                            {member.name.charAt(0)}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <p className={`font-black text-sm sm:text-base truncate ${member.active_status ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                                {member.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-500">
                                                <span className="flex items-center gap-1"><i className="fas fa-phone text-[#06B6D4]"></i> {member.phone}</span>
                                                {member.barcode && <span className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg"><i className="fas fa-barcode"></i> {member.barcode}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* أزرار الإجراءات */}
                                    <div className="flex items-center justify-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                                        <div className={`mr-auto sm:mr-4 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] sm:text-xs font-black border ${member.active_status ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'}`}>
                                            <i className={`fas ${member.active_status ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                            {member.active_status ? 'نشط' : 'موقوف'}
                                        </div>
                                        
                                        <button onClick={() => openModal(member)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center hover:bg-[#3B82F6] hover:text-white transition-colors shadow-sm">
                                            <i className="fas fa-pen text-sm"></i>
                                        </button>
                                        <button onClick={() => toggleMemberStatus(member.id, member.active_status)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shadow-sm ${member.active_status ? 'bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`}>
                                            <i className="fas fa-power-off text-sm"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 py-12 text-slate-400">
                            <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                <i className="fas fa-user-slash text-4xl opacity-50"></i>
                            </div>
                            <p className="text-base font-bold text-center px-4 text-slate-500">لا يوجد أعضاء مطابقين للبحث</p>
                            <p className="text-xs font-bold text-center mt-2">قم بإضافة عضو جديد لتبدأ بإدارة اشتراكاته</p>
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                صفحة {currentPage} من {totalPages}
                            </span>
                            <div className="flex gap-2">
                                <button onClick={prevPage} disabled={currentPage === 1} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#3B82F6] hover:text-white disabled:opacity-50 transition-colors shadow-sm"><i className="fas fa-chevron-right text-sm"></i></button>
                                <button onClick={nextPage} disabled={currentPage === totalPages} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#3B82F6] hover:text-white disabled:opacity-50 transition-colors shadow-sm"><i className="fas fa-chevron-left text-sm"></i></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ================= النافذة المنبثقة (Modal) لإضافة/تعديل عضو ================= */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    {/* الخلفية المظلمة */}
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal}></div>
                    
                    {/* محتوى النافذة */}
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 animate-view flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-[2rem]">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <i className={`fas ${editingMember ? 'fa-pen text-[#3B82F6]' : 'fa-user-plus text-[#06B6D4]'}`}></i>
                                {editingMember ? 'تعديل بيانات العضو' : 'تسجيل عضو جديد'}
                            </h3>
                            <button onClick={closeModal} className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto hide-scrollbar space-y-5">
                            
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">اسم العضو (الرباعي يفضل)</label>
                                <div className="relative">
                                    <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pl-4 pr-11 py-3 outline-none focus:border-[#3B82F6] focus:bg-white transition-colors" placeholder="مثال: أحمد محمد علي" />
                                    <i className="fas fa-user absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">رقم الهاتف (للتواصل والواتساب)</label>
                                <div className="relative">
                                    <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required dir="ltr" className="w-full text-left bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pr-4 pl-11 py-3 outline-none focus:border-[#3B82F6] focus:bg-white transition-colors" placeholder="01xxxxxxxxx" />
                                    <i className="fas fa-phone absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"></i>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-2">رقم الباركود (اختياري / للدخول)</label>
                                <div className="relative">
                                    <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} dir="ltr" className="w-full text-left bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pr-4 pl-11 py-3 outline-none focus:border-[#06B6D4] focus:bg-white transition-colors" placeholder="Scan Barcode or generate" />
                                    <i className="fas fa-barcode absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"></i>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 mt-1">يتم توليد رقم عشوائي تلقائياً إذا ترك فارغاً أو يمكنك تمرير قارئ الباركود.</p>
                            </div>

                            <button type="submit" className="w-full bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] hover:opacity-90 text-white font-black py-4 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2 text-base transition-all active:scale-95">
                                <i className="fas fa-save"></i> حفظ البيانات
                            </button>
                        </form>
                    </div>
                </div>
            )}
			
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