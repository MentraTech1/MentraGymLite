window.Module_Subscriptions = function({ gymId, userId, showToast }) {
    const { useState, useEffect, useRef } = React;

    // --- 1. إعدادات التواريخ الافتراضية للإحصائيات (من بداية الشهر لنهايته) ---
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    // --- 2. حالات الشاشة والبيانات ---
    const [subscriptions, setSubscriptions] = useState([]);
    const [stats, setStats] = useState({ totalRevenue: 0, activeCount: 0, expiredCount: 0 });
    const [isLoading, setIsLoading] = useState(true);
    
    // البحث في الجدول (Live Search)
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3; // ليمت 3

    // حالة المودال (إضافة / تعديل)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // بيانات الفورم
    const [formData, setFormData] = useState({
        memberId: '',
        memberName: '',
        planName: 'اشتراك شهري',
        price: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: ''
    });

    // --- 3. حالات الـ Live Search للأعضاء ---
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [memberResults, setMemberResults] = useState([]);
    const [isSearchingMember, setIsSearchingMember] = useState(false);

    // --- 4. جلب البيانات والإحصائيات ---
    const loadData = async () => {
        setIsLoading(true);
        try {
            if (!window.db || !window.db.subscriptions) {
                showToast("جدول الاشتراكات غير موجود في قاعدة البيانات", "error");
                setIsLoading(false); return;
            }

            let allSubs = await window.db.subscriptions.toArray();
            
            // فلترة بناءً على التاريخ (من - إلى)
            const filteredByDate = allSubs.filter(sub => {
                return sub.startDate >= startDate && sub.startDate <= endDate;
            });

            // حساب الإحصائيات
            let revenue = 0, active = 0, expired = 0;
            const currentDateStr = new Date().toISOString().split('T')[0];

            filteredByDate.forEach(sub => {
                revenue += parseFloat(sub.price) || 0;
                if (sub.endDate >= currentDateStr) active++;
                else expired++;
            });

            setStats({ totalRevenue: revenue, activeCount: active, expiredCount: expired });

            // الفلترة بناءً على بحث المستخدم
            let finalData = filteredByDate;
            if (searchQuery.trim() !== '') {
                finalData = finalData.filter(sub => 
                    sub.memberName.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            // ترتيب تنازلي (الأحدث أولاً)
            finalData.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
            
            setSubscriptions(finalData);
            setCurrentPage(1); 
        } catch (error) {
            console.error(error);
            showToast("حدث خطأ أثناء جلب الاشتراكات", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [startDate, endDate, searchQuery]);


    // --- 5. البحث الحي عن الأعضاء ---
    const handleMemberSearch = async (e) => {
        const value = e.target.value;
        setMemberSearchTerm(value);
        setFormData({ ...formData, memberId: '', memberName: '' }); 

        if (value.trim().length >= 2) {
            setIsSearchingMember(true);
            try {
                const results = await window.db.members
                    .filter(m => m.name.includes(value) || m.phone.includes(value))
                    .limit(5)
                    .toArray();
                setMemberResults(results);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSearchingMember(false);
            }
        } else {
            setMemberResults([]);
        }
    };

    const selectMember = (member) => {
        setFormData({ ...formData, memberId: member.id, memberName: member.name });
        setMemberSearchTerm(member.name);
        setMemberResults([]);
    };


    // --- 6. الحفظ (إضافة / تعديل مع الربط المالي) ---
    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!formData.memberId) {
            showToast("الرجاء اختيار متدرب من قائمة البحث", "error");
            return;
        }
        if (formData.endDate < formData.startDate) {
            showToast("تاريخ الانتهاء لا يمكن أن يكون قبل تاريخ البداية", "error");
            return;
        }

        setIsLoading(true);
        try {
            const priceValue = parseFloat(formData.price) || 0;
            const dataToSave = {
                memberId: formData.memberId,
                memberName: formData.memberName,
                planName: formData.planName,
                price: priceValue,
                startDate: formData.startDate,
                endDate: formData.endDate
            };

            if (editingId) {
                // =============== وضع التعديل ===============
                const existingSub = await window.db.subscriptions.get(editingId);
                
                // 1. تحديث بيانات الاشتراك
                await window.db.subscriptions.update(editingId, dataToSave);
                
                // 2. تحديث الحركة المالية المرتبطة في الخزينة
                if (existingSub.transactionId && window.db.transactions) {
                    await window.db.transactions.update(existingSub.transactionId, {
                        amount: priceValue,
                        description: `اشتراك المتدرب: ${formData.memberName} (${formData.planName})`,
                        date: formData.startDate
                    });
                } else if (!existingSub.transactionId && priceValue > 0 && window.db.transactions) {
                    // في حالة كان الاشتراك قديماً وليس له معاملة مالية، ننشئ له واحدة الآن
                    const transId = await window.db.transactions.add({
                        type: 'income',
                        amount: priceValue,
                        category: 'اشتراكات أعضاء',
                        description: `اشتراك المتدرب: ${formData.memberName} (${formData.planName})`,
                        date: formData.startDate
                    });
                    await window.db.subscriptions.update(editingId, { transactionId: transId });
                }

                showToast("تم تعديل الاشتراك وتحديث الخزينة بنجاح", "success");
            } else {
                // =============== وضع الإضافة ===============
                let transId = null;
                
                // 1. تسجيل الإيراد في جدول المعاملات المالية أولاً (إذا كان المبلغ أكبر من 0)
                if (priceValue > 0 && window.db.transactions) {
                    transId = await window.db.transactions.add({
                        type: 'income',
                        amount: priceValue,
                        category: 'اشتراكات أعضاء',
                        description: `اشتراك المتدرب: ${formData.memberName} (${formData.planName})`,
                        date: formData.startDate
                    });
                }

                // 2. ربط الـ transactionId مع الاشتراك وحفظه
                dataToSave.transactionId = transId;
                await window.db.subscriptions.add(dataToSave);
                
                showToast("تم إضافة الاشتراك وتسجيل الإيراد بنجاح", "success");
            }
            
            closeModal();
            loadData();
        } catch (error) {
            console.error(error);
            showToast("حدث خطأ أثناء الحفظ", "error");
            setIsLoading(false);
        }
    };

    // --- 7. التعديل والإغلاق ---
    const openEditModal = (sub) => {
        setEditingId(sub.id);
        setFormData({
            memberId: sub.memberId,
            memberName: sub.memberName,
            planName: sub.planName,
            price: sub.price,
            startDate: sub.startDate,
            endDate: sub.endDate
        });
        setMemberSearchTerm(sub.memberName);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({
            memberId: '', memberName: '', planName: 'اشتراك شهري', price: '',
            startDate: new Date().toISOString().split('T')[0], endDate: ''
        });
        setMemberSearchTerm('');
        setMemberResults([]);
    };

    // --- 8. الـ Pagination ---
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = subscriptions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(subscriptions.length / itemsPerPage) || 1;

    // حساب حالة الاشتراك برمجياً
    const getStatus = (endDateStr) => {
        const todayStr = new Date().toISOString().split('T')[0];
        return endDateStr >= todayStr ? 'active' : 'expired';
    };

    return (
        <div className="space-y-6 pb-10">
            
            {/* الهيدر والإحصائيات (من - إلى) */}
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#06B6D4] to-[#3B82F6] flex items-center justify-center text-white text-xl shadow-lg">
                        <i className="fas fa-id-card"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">إدارة الاشتراكات</h2>
                        <p className="text-xs font-bold text-slate-400">إحصائيات وتجديد المشتركين</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 w-full md:w-auto">
                    <span className="text-xs font-bold text-slate-400 px-2">الفترة:</span>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-700 px-3 py-2 rounded-xl outline-none focus:border-[#06B6D4]" />
                    <span className="text-slate-400 font-black">-</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-700 px-3 py-2 rounded-xl outline-none focus:border-[#06B6D4]" />
                </div>
            </div>

            {/* كروت الإحصائيات المخصصة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl p-6 border-b-4 border-cyan-500 shadow-sm relative overflow-hidden">
                    <i className="fas fa-money-bill-wave absolute -left-4 -bottom-4 text-cyan-50 text-7xl"></i>
                    <p className="text-slate-500 font-bold text-sm mb-1">إيرادات الفترة المحددة</p>
                    <h3 className="text-3xl font-black text-cyan-600">{stats.totalRevenue} <span className="text-sm">ج.م</span></h3>
                </div>
                <div className="bg-white rounded-3xl p-6 border-b-4 border-emerald-500 shadow-sm relative overflow-hidden">
                    <i className="fas fa-check-circle absolute -left-4 -bottom-4 text-emerald-50 text-7xl"></i>
                    <p className="text-slate-500 font-bold text-sm mb-1">اشتراكات سارية (نشطة)</p>
                    <h3 className="text-3xl font-black text-emerald-600">{stats.activeCount}</h3>
                </div>
                <div className="bg-white rounded-3xl p-6 border-b-4 border-rose-500 shadow-sm relative overflow-hidden">
                    <i className="fas fa-times-circle absolute -left-4 -bottom-4 text-rose-50 text-7xl"></i>
                    <p className="text-slate-500 font-bold text-sm mb-1">اشتراكات منتهية</p>
                    <h3 className="text-3xl font-black text-rose-600">{stats.expiredCount}</h3>
                </div>
            </div>

            {/* شريط البحث وزر الإضافة */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <input 
                        type="text" 
                        placeholder="بحث سريع باسم المتدرب..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-sm font-bold text-slate-700 rounded-2xl pl-4 pr-10 py-3 outline-none focus:border-[#3B82F6] shadow-sm"
                    />
                    <i className="fas fa-search absolute top-1/2 right-4 -translate-y-1/2 text-slate-400"></i>
                </div>
                
                <button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-black shadow-md flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                    <i className="fas fa-plus"></i> تسجيل اشتراك جديد
                </button>
            </div>

            {/* الجدول والـ Pagination */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {isLoading ? (
                    <div className="p-10 text-center text-slate-400"><i className="fas fa-circle-notch fa-spin text-3xl mb-3"></i></div>
                ) : subscriptions.length === 0 ? (
                    <div className="p-10 text-center">
                        <i className="fas fa-box-open text-5xl text-slate-200 mb-3"></i>
                        <p className="text-slate-500 font-bold">لا يوجد اشتراكات مطابقة للبحث أو الفترة المحددة</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-500 text-xs">
                                <tr>
                                    <th className="p-4 font-black">اسم المتدرب</th>
                                    <th className="p-4 font-black">نوع الاشتراك</th>
                                    <th className="p-4 font-black">تاريخ البداية</th>
                                    <th className="p-4 font-black">تاريخ الانتهاء</th>
                                    <th className="p-4 font-black">الحالة</th>
                                    <th className="p-4 font-black">المبلغ</th>
                                    <th className="p-4 font-black text-center">تعديل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                                {currentItems.map(sub => {
                                    const status = getStatus(sub.endDate);
                                    return (
                                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-black">{sub.memberName.charAt(0)}</div>
                                                {sub.memberName}
                                            </td>
                                            <td className="p-4 text-slate-500">{sub.planName}</td>
                                            <td className="p-4 text-slate-500">{sub.startDate}</td>
                                            <td className="p-4 font-black">{sub.endDate}</td>
                                            <td className="p-4">
                                                {status === 'active' 
                                                    ? <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-xs"><i className="fas fa-check-circle mr-1"></i> نشط</span>
                                                    : <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded text-xs"><i className="fas fa-times-circle mr-1"></i> منتهي</span>
                                                }
                                            </td>
                                            <td className="p-4 font-black text-[#06B6D4]">{sub.price} ج.م</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => openEditModal(sub)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors flex items-center justify-center mx-auto">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* أزرار الـ Pagination ليمت 3 */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                            disabled={currentPage === 1}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-50 shadow-sm"
                        >
                            السابق
                        </button>
                        <span className="text-sm font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">
                            صفحة {currentPage} من {totalPages}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                            disabled={currentPage === totalPages}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-50 shadow-sm"
                        >
                            التالي
                        </button>
                    </div>
                )}
            </div>

            {/* مودال الإضافة / التعديل */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-view">
                        <div className="p-5 text-white bg-gradient-to-r from-[#06B6D4] to-[#3B82F6]">
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <i className={`fas ${editingId ? 'fa-pen' : 'fa-plus-circle'}`}></i>
                                {editingId ? 'تعديل بيانات الاشتراك' : 'تسجيل اشتراك جديد'}
                            </h3>
                        </div>
                        
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            
                            {/* حقل البحث الحي (Live Search) للمتدرب */}
                            <div className="relative">
                                <label className="block text-xs font-black text-slate-500 mb-1">اسم المتدرب (اكتب للبحث)</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        required 
                                        value={memberSearchTerm} 
                                        onChange={handleMemberSearch}
                                        className={`w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl pl-4 pr-10 py-3 font-bold text-slate-700 outline-none ${formData.memberId ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50'}`} 
                                        placeholder="اكتب حرفين على الأقل..." 
                                    />
                                    <i className={`fas ${formData.memberId ? 'fa-check-circle text-emerald-500' : 'fa-search text-slate-400'} absolute top-1/2 right-4 -translate-y-1/2`}></i>
                                </div>
                                
                                {/* قائمة النتائج المنبثقة */}
                                {memberResults.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded-xl mt-1 shadow-xl max-h-40 overflow-y-auto">
                                        {memberResults.map(m => (
                                            <li 
                                                key={m.id} 
                                                onClick={() => selectMember(m)}
                                                className="p-3 hover:bg-cyan-50 cursor-pointer border-b border-slate-100 last:border-0 font-bold text-sm text-slate-700 flex justify-between items-center"
                                            >
                                                <span>{m.name}</span>
                                                <span className="text-xs text-slate-400 dir-ltr">{m.phone}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {isSearchingMember && <p className="text-[10px] text-cyan-600 mt-1 font-bold animate-pulse">جاري البحث...</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">نوع الاشتراك</label>
                                <input type="text" required value={formData.planName} onChange={(e) => setFormData({...formData, planName: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none bg-slate-50" placeholder="مثال: اشتراك شهري، كورس تخسيس..." />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">المبلغ المدفوع (ج.م)</label>
                                <input type="number" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none text-left dir-ltr bg-slate-50" placeholder="0" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-1">تاريخ البداية</label>
                                    <input type="date" required value={formData.startDate} onChange={(e) => setFormData({...formData, startDate: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none cursor-pointer bg-slate-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 mb-1">تاريخ الانتهاء</label>
                                    <input type="date" required value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} className="w-full border-2 border-rose-200 focus:border-rose-500 rounded-xl p-3 font-bold text-slate-700 outline-none cursor-pointer bg-rose-50" />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="submit" disabled={isLoading} className="flex-1 bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] text-white font-black py-3 rounded-xl transition-transform hover:scale-[1.02] active:scale-95 shadow-md">
                                    {editingId ? 'حفظ التعديلات' : 'تسجيل الاشتراك'}
                                </button>
                                <button type="button" onClick={closeModal} className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors">
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};