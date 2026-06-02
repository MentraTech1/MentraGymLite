// ============================================================================
// Module: Settings & Staff Management (الإعدادات وطاقم العمل - مع التعديل)
// ============================================================================

window.Module_Settings = function({ gymId, userId, showToast }) {
    const { useState, useEffect } = React;

    // --- 1. حالة الشاشة والبيانات ---
    const [activeTab, setActiveTab] = useState('staff'); // 'staff' أو 'gymInfo'
    const [isLoading, setIsLoading] = useState(true);
    
    const [staff, setStaff] = useState([]);
    const [gymInfo, setGymInfo] = useState(null);

    // [جديد] حالات تعديل بيانات الصالة
    const [isEditingGym, setIsEditingGym] = useState(false);
    const [gymFormData, setGymFormData] = useState({ gymName: '', ownerName: '', phone: '' });

    // حالة البحث والـ Pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3; // ليمت 3 موظفين في الصفحة

    // حالة المودال (إضافة وتعديل موظف)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaffId, setEditingStaffId] = useState(null); // إذا كان له قيمة، نحن في وضع التعديل
    const [formData, setFormData] = useState({ name: '', phone: '', password: '', role: 'trainer' });

    // مسميات وألوان الصلاحيات
    const roleDetails = {
        'owner': { name: 'مدير الصالة', color: 'bg-purple-50 text-purple-600 border-purple-200' },
        'trainer': { name: 'مدرب (كابتن)', color: 'bg-blue-50 text-blue-600 border-blue-200' },
        'reception': { name: 'موظف استقبال', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
    };

    // دالة تشفير كلمة المرور
    const hashPassword = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // --- 2. جلب البيانات الأساسية ---
    const fetchSettingsData = async () => {
        setIsLoading(true);
        try {
            const usersList = await window.db.users.reverse().toArray();
            setStaff(usersList);

            if (window.masterDb) {
                const gym = await window.masterDb.gyms.get(parseInt(gymId));
                setGymInfo(gym);
                // تجهيز بيانات الفورم في حالة ضغط المستخدم على تعديل
                setGymFormData({ gymName: gym.gymName, ownerName: gym.ownerName, phone: gym.phone });
            }
        } catch (error) {
            console.error("خطأ في جلب الإعدادات:", error);
            showToast("حدث خطأ أثناء تحميل الإعدادات", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSettingsData();
    }, []);

    // إعادة التعيين للصفحة الأولى عند البحث
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // --- 3. منطق البحث والـ Pagination ---
    const filteredStaff = staff.filter(user => 
        user.name.includes(searchQuery) || user.phone.includes(searchQuery)
    );
    const totalPages = Math.ceil(filteredStaff.length / itemsPerPage) || 1;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentStaff = filteredStaff.slice(startIndex, startIndex + itemsPerPage);

    const nextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
    const prevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

    // --- 4. معالجة بيانات الموظف (إضافة وتعديل) ---
    const openAddModal = () => {
        setEditingStaffId(null);
        setFormData({ name: '', phone: '', password: '', role: 'trainer' });
        setIsModalOpen(true);
    };

    const openEditModal = (staffMember) => {
        setEditingStaffId(staffMember.id);
        setFormData({ 
            name: staffMember.name, 
            phone: staffMember.phone, 
            password: '', 
            role: staffMember.role 
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const existingUser = await window.db.users.where('phone').equals(formData.phone).first();
            if (existingUser && existingUser.id !== editingStaffId) {
                showToast("رقم الهاتف مسجل مسبقاً لموظف آخر", "error");
                return;
            }

            const dataToSave = {
                name: formData.name,
                phone: formData.phone,
                role: formData.role
            };

            if (formData.password.trim() !== '') {
                dataToSave.password = await hashPassword(formData.password);
            }

            if (editingStaffId) {
                await window.db.users.update(editingStaffId, dataToSave);
                showToast("تم تعديل بيانات الموظف بنجاح", "success");
            } else {
                if (formData.password.trim() === '') {
                    showToast("يجب إدخال كلمة مرور للموظف الجديد", "error");
                    return;
                }
                dataToSave.is_active = true;
                await window.db.users.add(dataToSave);
                showToast("تم إضافة الموظف بنجاح", "success");
            }

            setIsModalOpen(false);
            fetchSettingsData();
        } catch (error) {
            showToast("حدث خطأ أثناء الحفظ", "error");
        }
    };

    // --- 5. معالجة إيقاف / تفعيل الموظف ---
    const toggleStaffStatus = async (staffMember) => {
        if (staffMember.id === parseInt(userId)) {
            showToast("لا يمكنك إيقاف حسابك الشخصي الذي تستخدمه حالياً!", "error");
            return;
        }

        if(confirm(staffMember.is_active ? `هل أنت متأكد من إيقاف حساب (${staffMember.name})؟ لن يتمكن من تسجيل الدخول.` : `هل تريد تفعيل حساب (${staffMember.name})؟`)) {
            try {
                await window.db.users.update(staffMember.id, { is_active: !staffMember.is_active });
                showToast(staffMember.is_active ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
                fetchSettingsData();
            } catch (error) {
                showToast("حدث خطأ أثناء تغيير حالة الحساب", "error");
            }
        }
    };

    // --- 6. [جديد] معالجة تعديل بيانات الصالة ---
    const handleSaveGymInfo = async (e) => {
        e.preventDefault();
        try {
            // تحديث البيانات في قاعدة البيانات الرئيسية
            await window.masterDb.gyms.update(parseInt(gymId), {
                gymName: gymFormData.gymName,
                ownerName: gymFormData.ownerName,
                phone: gymFormData.phone
            });

            // تحديث الـ Local Storage عشان يتغير الاسم في الهيدر فوق
            let session = JSON.parse(localStorage.getItem('MentraGym_Session'));
            if (session) {
                session.gym_name = gymFormData.gymName;
                if (session.role === 'owner' && parseInt(session.user_id) === parseInt(userId)) {
                    session.name = gymFormData.ownerName;
                }
                localStorage.setItem('MentraGym_Session', JSON.stringify(session));
            }

            // تحديث الحالة المحلية وإغلاق وضع التعديل
            setGymInfo(prev => ({ ...prev, ...gymFormData }));
            setIsEditingGym(false);
            showToast("تم حفظ بيانات الصالة بنجاح! سيتم تحديث الاسم بالأعلى عند إعادة التحميل.", "success");
            
            // تحديث الواجهة
            setTimeout(() => {
                window.location.reload(); // لضمان تحديث الهيدر الرئيسي في dashboard.html
            }, 1500);

        } catch (error) {
            console.error("خطأ أثناء حفظ الصالة:", error);
            showToast("حدث خطأ أثناء تحديث البيانات", "error");
        }
    };


    return (
        <div className="space-y-6 fade-up pb-24 md:pb-6 relative max-w-7xl mx-auto">
            
            {/* ================= الهيدر والتبويبات ================= */}
            <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-slate-800 font-black text-lg md:text-xl w-full md:w-auto">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
                        <i className="fas fa-cog text-slate-600"></i>
                    </div>
                    إعدادات النظام
                </div>
                
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto">
                    <button onClick={() => setActiveTab('staff')} className={`flex-1 md:w-40 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'staff' ? 'bg-white text-[#3B82F6] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>طاقم العمل</button>
                    <button onClick={() => { setActiveTab('gymInfo'); setIsEditingGym(false); }} className={`flex-1 md:w-40 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'gymInfo' ? 'bg-white text-[#3B82F6] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>بيانات الصالة</button>
                </div>
            </div>

            {/* ================= تبويب: إدارة طاقم العمل ================= */}
            {activeTab === 'staff' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[400px] animate-view">
                    
                    {/* هيدر قسم الموظفين + البحث والزر */}
                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 rounded-t-3xl">
                        <h3 className="font-black text-slate-800 text-base flex items-center gap-2 shrink-0">
                            <i className="fas fa-user-shield text-slate-400"></i> الحسابات المسجلة
                        </h3>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <input 
                                    type="text" 
                                    placeholder="بحث بالاسم أو الرقم..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-[#3B82F6] shadow-sm transition-all"
                                />
                                <i className="fas fa-search absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 text-sm"></i>
                            </div>
                            
                            <button onClick={openAddModal} className="w-full sm:w-auto bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform shrink-0">
                                <i className="fas fa-plus"></i> موظف جديد
                            </button>
                        </div>
                    </div>

                    {/* عرض الكروت */}
                    <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                        {isLoading ? (
                            <div className="flex justify-center items-center py-10"><i className="fas fa-circle-notch fa-spin text-3xl text-[#3B82F6]"></i></div>
                        ) : currentStaff.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {currentStaff.map((user) => (
                                    <div key={user.id} className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-[#3B82F6] transition-colors flex flex-col relative overflow-hidden group shadow-sm">
                                        
                                        {/* شريط الدلالة إذا كان هو المستخدم الحالي */}
                                        {user.id === parseInt(userId) && (
                                            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[9px] font-black px-2 py-0.5 rounded-bl-lg">حسابك الحالي</div>
                                        )}

                                        <div className="flex items-center gap-4 mb-4 mt-1">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shrink-0 ${user.is_active ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="overflow-hidden flex-1">
                                                <h4 className={`font-black text-base truncate ${user.is_active ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{user.name}</h4>
                                                <p className="text-xs font-bold text-slate-500 mt-0.5 truncate" dir="ltr"><i className="fas fa-phone text-slate-300 mr-1"></i> {user.phone}</p>
                                            </div>
                                            {/* زر التعديل */}
                                            <button onClick={() => openEditModal(user)} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center hover:bg-[#3B82F6] hover:text-white transition-colors shrink-0 border border-slate-100">
                                                <i className="fas fa-pen text-xs"></i>
                                            </button>
                                        </div>

                                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${roleDetails[user.role]?.color || 'bg-slate-50 text-slate-600'}`}>
                                                {roleDetails[user.role]?.name || user.role}
                                            </span>
                                            
                                            <button 
                                                onClick={() => toggleStaffStatus(user)} 
                                                disabled={user.id === parseInt(userId)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${user.is_active ? 'bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`}
                                            >
                                                {user.is_active ? 'إيقاف' : 'تفعيل'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 py-10 text-slate-400">
                                <i className="fas fa-users-slash text-4xl mb-3 opacity-50"></i>
                                <p className="text-sm font-bold text-center">لا يوجد موظفين مطابقين للبحث</p>
                            </div>
                        )}

                        {/* أزرار الـ Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                    صفحة {currentPage} من {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={prevPage} disabled={currentPage === 1} className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#3B82F6] hover:text-white disabled:opacity-50 transition-colors shadow-sm"><i className="fas fa-chevron-right text-sm"></i></button>
                                    <button onClick={nextPage} disabled={currentPage === totalPages} className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 flex items-center justify-center hover:bg-[#3B82F6] hover:text-white disabled:opacity-50 transition-colors shadow-sm"><i className="fas fa-chevron-left text-sm"></i></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================= تبويب: بيانات الصالة (عرض وتعديل) ================= */}
            {activeTab === 'gymInfo' && gymInfo && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 sm:p-10 animate-view flex flex-col items-center max-w-2xl mx-auto relative overflow-hidden">
                    
                    {/* زر تبديل وضع التعديل */}
                    {!isEditingGym && (
                        <button 
                            onClick={() => setIsEditingGym(true)} 
                            className="absolute top-6 left-6 bg-slate-50 hover:bg-[#3B82F6] text-slate-500 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-slate-100 flex items-center gap-2"
                        >
                            <i className="fas fa-pen"></i> تعديل
                        </button>
                    )}

                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#3B82F6] flex items-center justify-center text-white text-4xl shadow-xl mb-6 shrink-0">
                        <i className="fas fa-dumbbell"></i>
                    </div>

                    {!isEditingGym ? (
                        // ================= وضع العرض =================
                        <div className="text-center w-full">
                            <h2 className="text-2xl font-black text-slate-800 mb-1">{gymInfo.gymName}</h2>
                            <p className="text-slate-500 font-bold mb-8">نظام إدارة محلي (Offline-First)</p>

                            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 mb-1">المدير المسؤول</p>
                                    <p className="text-sm font-black text-slate-800">{gymInfo.ownerName}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 mb-1">رقم الهاتف الأساسي</p>
                                    <p className="text-sm font-black text-slate-800" dir="ltr">{gymInfo.phone}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 sm:col-span-2">
                                    <p className="text-[10px] font-bold text-slate-400 mb-1">المُعرف التقني لقاعدة البيانات (لا يمكن تغييره)</p>
                                    <code className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded border border-blue-100">{gymInfo.dbName}</code>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // ================= وضع التعديل (Form) =================
                        <form onSubmit={handleSaveGymInfo} className="w-full mt-2 space-y-4 animate-view text-right">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">اسم الصالة (الجيم)</label>
                                <input 
                                    type="text" 
                                    required
                                    value={gymFormData.gymName} 
                                    onChange={e => setGymFormData({...gymFormData, gymName: e.target.value})} 
                                    className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6]" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">اسم المدير المسئول</label>
                                <input 
                                    type="text" 
                                    required
                                    value={gymFormData.ownerName} 
                                    onChange={e => setGymFormData({...gymFormData, ownerName: e.target.value})} 
                                    className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6]" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">رقم هاتف الصالة (للتواصل)</label>
                                <input 
                                    type="tel" 
                                    required
                                    dir="ltr"
                                    value={gymFormData.phone} 
                                    onChange={e => setGymFormData({...gymFormData, phone: e.target.value})} 
                                    className="w-full text-left bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6]" 
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                                <button type="submit" className="flex-1 bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white font-black py-3 rounded-xl shadow-lg hover:opacity-90 transition-all text-sm">
                                    <i className="fas fa-save mr-1"></i> حفظ التعديلات
                                </button>
                                <button type="button" onClick={() => {setIsEditingGym(false); setGymFormData({gymName: gymInfo.gymName, ownerName: gymInfo.ownerName, phone: gymInfo.phone});}} className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 font-black py-3 rounded-xl transition-all text-sm">
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {/* ================= إعلان النسخة المدفوعة ================= */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#3B82F6]/20 group mt-8">
                <div className="absolute top-0 left-0 w-64 h-64 bg-[#3B82F6]/10 rounded-full blur-[60px] pointer-events-none group-hover:bg-[#3B82F6]/20 transition-all duration-700"></div>
                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex-1 text-center lg:text-right text-white">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-blue-400 text-xs font-black mb-3 backdrop-blur-sm">
                            <i className="fas fa-building animate-pulse"></i> لإدارة المشاريع الكبيرة
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black mb-2 tracking-tight">
                            هل تملك أكثر من فرع؟ اكتشف <span className="text-transparent bg-clip-text bg-gradient-to-l from-[#06B6D4] to-[#3B82F6]">MentraGym PRO</span>
                        </h3>
                        <p className="text-slate-400 font-bold text-xs sm:text-sm leading-relaxed max-w-2xl mx-auto lg:mx-0">
                            اربط جميع فروع الجيم الخاصة بك في لوحة تحكم سحابية واحدة. تدير الرواتب، اشتراكات الأعضاء عبر الفروع، وتحلل الأرباح والمصروفات من هاتفك في أي مكان بالعالم.
                        </p>
                    </div>
                    <a href="https://wa.me/201211934816" target="_blank" className="w-full lg:w-auto bg-[#3B82F6] hover:bg-blue-600 text-white font-black px-6 py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 whitespace-nowrap text-sm sm:text-base">
                        <i className="fab fa-whatsapp text-xl"></i><span>تواصل للمزيد من التفاصيل</span>
                    </a>
                </div>
            </div>

            {/* ================= المودال (إضافة/تعديل موظف) ================= */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md relative z-10 flex flex-col max-h-[90vh] animate-view">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-[2rem]">
                            <h3 className="text-lg font-black text-slate-800">
                                <i className={`fas ${editingStaffId ? 'fa-pen' : 'fa-user-plus'} text-[#06B6D4] ml-2`}></i> 
                                {editingStaffId ? 'تعديل بيانات الموظف' : 'إضافة موظف أو مدرب'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto hide-scrollbar">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">الاسم بالكامل</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required className="w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6]" placeholder="مثال: كابتن محمود" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">رقم الهاتف (للدخول به)</label>
                                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required dir="ltr" className="w-full text-left bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6]" placeholder="01xxxxxxxxx" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">
                                    {editingStaffId ? 'كلمة المرور الجديدة (اتركها فارغة إذا لم ترد التغيير)' : 'كلمة المرور المؤقتة'}
                                </label>
                                <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingStaffId} dir="ltr" className="w-full text-left bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl px-4 py-3 outline-none focus:border-[#3B82F6]" placeholder={editingStaffId ? '••••••••' : 'يستخدمها الموظف لتسجيل الدخول'} />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">صلاحية النظام</label>
                                <div className="relative">
                                    <select 
                                        value={formData.role} 
                                        onChange={e => setFormData({...formData, role: e.target.value})} 
                                        disabled={editingStaffId === parseInt(userId)} // منع المدير من تغيير صلاحية نفسه
                                        className={`w-full bg-slate-50 border border-slate-200 text-sm font-bold rounded-xl pl-4 pr-10 py-3 outline-none focus:border-[#3B82F6] appearance-none ${editingStaffId === parseInt(userId) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <option value="trainer">مدرب (صلاحية خطط ومتابعة فقط)</option>
                                        <option value="reception">استقبال (صلاحية أعضاء فقط)</option>
                                        <option value="owner">مدير (صلاحية كاملة لكل شيء)</option>
                                    </select>
                                    <i className="fas fa-chevron-down absolute top-1/2 left-4 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                                </div>
                                {editingStaffId === parseInt(userId) && <p className="text-[10px] font-bold text-amber-500 mt-1">لا يمكنك تغيير صلاحية حسابك الشخصي حالياً.</p>}
                            </div>
                            
                            <button type="submit" className="w-full bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white font-black py-4 rounded-xl shadow-lg mt-2 transition-transform active:scale-95">
                                <i className="fas fa-save mr-2"></i> حفظ بيانات الموظف
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};