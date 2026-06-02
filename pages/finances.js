window.Module_FinancialTracking = function({ gymId, userId, showToast }) {
    const { useState, useEffect } = React;

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);
    
    const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 3;

    // القوائم
    const categories = {
        income: ['اشتراكات أعضاء', 'مبيعات بار ومكملات', 'مبيعات زجاجات مياه', 'إيرادات أخرى'],
        expense: ['إيجار المكان', 'كهرباء ومياه', 'رواتب مدربين وموظفين', 'صيانة أجهزة', 'نظافة', 'مصروفات أخرى']
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // [جديد] حالة تتبع العنصر الذي يتم تعديله
    const [editingId, setEditingId] = useState(null);

    const [formData, setFormData] = useState({
        type: 'income',
        amount: '',
        category: categories.income[0], 
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const loadFinancialData = async () => {
        setIsLoading(true);
        try {
            if (!window.db || !window.db.transactions) {
                showToast("تحديث قاعدة البيانات مطلوب. يرجى مسح بيانات المتصفح (Clear Data) وتسجيل الجيم من جديد.", "error");
                setIsLoading(false);
                return;
            }

            if(typeof window.GymQueries.getFinancialSummary !== 'function'){
                showToast("يرجى عمل Refresh للصفحة (Ctrl+F5) لتحديث دوال النظام", "error");
                setIsLoading(false);
                return;
            }

            const data = await window.GymQueries.getFinancialSummary(startDate, endDate);
            
            setSummary({
                income: data.totalIncome || 0,
                expense: data.totalExpense || 0,
                net: data.netProfit || 0
            });
            
            const sortedTransactions = (data.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(sortedTransactions);
            setCurrentPage(1); 
        } catch (error) {
            console.error("خطأ في جلب البيانات:", error);
            showToast("حدث خطأ أثناء تحميل البيانات المالية", "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadFinancialData();
    }, [startDate, endDate]);

    // [معدل] دالة الحفظ لتدعم الإضافة والتعديل معاً
    const handleSubmitTransaction = async (e) => {
        e.preventDefault();
        
        const amountValue = parseFloat(formData.amount);
        if (isNaN(amountValue) || amountValue <= 0) {
            showToast("الرجاء إدخال مبلغ صحيح أكبر من الصفر", "error");
            return;
        }

        setIsLoading(true);
        try {
            if (editingId) {
                // وضع التعديل (Update)
                await window.db.transactions.update(editingId, {
                    type: formData.type,
                    amount: amountValue,
                    category: formData.category,
                    description: formData.description,
                    date: formData.date
                });
                showToast("تم تعديل الحركة المالية بنجاح", "success");
            } else {
                // وضع الإضافة (Create)
                if (formData.type === 'income') {
                    await window.GymQueries.addIncome(amountValue, formData.category, formData.description, formData.date);
                } else {
                    await window.GymQueries.addExpense(amountValue, formData.category, formData.description, formData.date);
                }
                showToast("تم تسجيل الحركة المالية بنجاح", "success");
            }
            
            closeModal();
            loadFinancialData(); 
        } catch (error) {
            console.error(error);
            showToast("حدث خطأ أثناء الحفظ", "error");
            setIsLoading(false);
        }
    };

    // [جديد] دالة فتح مودال التعديل وتعبئة البيانات
    const openEditModal = (transaction) => {
        setEditingId(transaction.id);
        setFormData({
            type: transaction.type,
            amount: transaction.amount,
            category: transaction.category,
            description: transaction.description || '',
            date: transaction.date
        });
        setIsModalOpen(true);
    };

    // [جديد] دالة الحذف
    const handleDeleteTransaction = async (id) => {
        if (confirm("هل أنت متأكد من حذف هذه الحركة المالية؟ سيؤثر هذا على إجمالي الأرباح.")) {
            try {
                setIsLoading(true);
                await window.db.transactions.delete(id);
                showToast("تم حذف الحركة المالية بنجاح", "success");
                loadFinancialData();
            } catch (error) {
                console.error("خطأ في الحذف:", error);
                showToast("حدث خطأ أثناء الحذف", "error");
                setIsLoading(false);
            }
        }
    };

    // [جديد] دالة إغلاق المودال وتصفير الحالات
    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData({ ...formData, amount: '', description: '', date: new Date().toISOString().split('T')[0] });
    };

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = transactions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(transactions.length / itemsPerPage);

    const exportToExcel = () => {
        if (transactions.length === 0) { showToast("لا يوجد بيانات لتصديرها", "error"); return; }
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "التاريخ,نوع الحركة,التصنيف,البيان,المبلغ\n";
        transactions.forEach(t => {
            const typeName = t.type === 'income' ? 'إيراد' : 'مصروف';
            const cleanDesc = (t.description || '').replace(/,/g, '-'); 
            csvContent += `${t.date},${typeName},${t.category},${cleanDesc},${t.amount}\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `تقرير_الخزينة_${startDate}_الي_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast("تم تحميل ملف الإكسيل بنجاح", "success");
    };

    const exportToPDF = () => {
        if (transactions.length === 0) { showToast("لا يوجد بيانات لطباعتها", "error"); return; }
        const printWindow = window.open('', '_blank', 'width=800,height=900');
        if (!printWindow) { showToast("عفواً! المتصفح يمنع النوافذ المنبثقة، يرجى السماح بها لطباعة التقرير.", "error"); return; }
        
        const htmlContent = `
            <html lang="ar" dir="rtl">
            <head>
                <title>تقرير مالي - MentraGym</title>
                <style>
                    body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #333; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #06B6D4; padding-bottom: 10px; }
                    .summary-box { display: flex; justify-content: space-around; background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
                    .stat { text-align: center; font-weight: bold; }
                    .stat span { display: block; font-size: 20px; margin-top: 5px; }
                    .text-green { color: #10b981; } .text-red { color: #f43f5e; } .text-blue { color: #3b82f6; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: right; }
                    th { background-color: #06B6D4; color: white; }
                    tr:nth-child(even) { background-color: #f1f5f9; }
                    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>التقرير المالي (الخزينة)</h2>
                    <p>عن الفترة من <strong>${startDate}</strong> إلى <strong>${endDate}</strong></p>
                </div>
                <div class="summary-box">
                    <div class="stat">إجمالي الإيرادات <span class="text-green">${summary.income} ج.م</span></div>
                    <div class="stat">إجمالي المصروفات <span class="text-red">${summary.expense} ج.م</span></div>
                    <div class="stat">صافي الربح <span class="text-blue">${summary.net} ج.م</span></div>
                </div>
                <table>
                    <thead><tr><th>التاريخ</th><th>النوع</th><th>التصنيف</th><th>البيان</th><th>المبلغ</th></tr></thead>
                    <tbody>
                        ${transactions.map(t => `
                            <tr>
                                <td>${t.date}</td>
                                <td style="color: ${t.type === 'income' ? '#10b981' : '#f43f5e'}; font-weight:bold;">${t.type === 'income' ? 'إيراد +' : 'مصروف -'}</td>
                                <td>${t.category}</td>
                                <td>${t.description || '-'}</td>
                                <td style="font-weight:bold;">${t.amount} ج.م</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="footer">تم طباعة هذا التقرير بواسطة MentraGym Lite</div>
                <script>window.onload = function() { window.print(); window.setTimeout(function(){ window.close(); }, 500); }</script>
            </body>
            </html>
        `;
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#06B6D4] to-[#3B82F6] flex items-center justify-center text-white text-xl shadow-lg">
                        <i className="fas fa-wallet"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">السجل المالي</h2>
                        <p className="text-xs font-bold text-slate-400">إدارة المصروفات والأرباح</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-700 px-3 py-2 rounded-xl outline-none focus:border-[#06B6D4]" />
                    <span className="text-slate-400 font-black">-</span>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border border-slate-200 text-sm font-bold text-slate-700 px-3 py-2 rounded-xl outline-none focus:border-[#06B6D4]" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-3xl p-6 border-b-4 border-emerald-500 shadow-sm relative overflow-hidden">
                    <i className="fas fa-arrow-down absolute -left-4 -bottom-4 text-emerald-50 text-7xl"></i>
                    <p className="text-slate-500 font-bold text-sm mb-1">إجمالي الإيرادات</p>
                    <h3 className="text-3xl font-black text-emerald-600">{summary.income} <span className="text-sm">ج.م</span></h3>
                </div>
                <div className="bg-white rounded-3xl p-6 border-b-4 border-rose-500 shadow-sm relative overflow-hidden">
                    <i className="fas fa-arrow-up absolute -left-4 -bottom-4 text-rose-50 text-7xl"></i>
                    <p className="text-slate-500 font-bold text-sm mb-1">إجمالي المصروفات</p>
                    <h3 className="text-3xl font-black text-rose-600">{summary.expense} <span className="text-sm">ج.م</span></h3>
                </div>
                <div className="bg-gradient-to-l from-[#06B6D4] to-[#3B82F6] rounded-3xl p-6 shadow-lg relative overflow-hidden text-white">
                    <i className="fas fa-piggy-bank absolute -left-4 -bottom-4 text-white/10 text-8xl"></i>
                    <p className="text-white/80 font-bold text-sm mb-1">صافي الربح (الخزينة)</p>
                    <h3 className="text-3xl font-black">{summary.net} <span className="text-sm text-white/80">ج.م</span></h3>
                </div>
            </div>

            <div className="flex flex-wrap gap-3">
                <button onClick={() => { setEditingId(null); setFormData({ ...formData, type: 'income', category: categories.income[0] }); setIsModalOpen(true); }} className="flex-1 min-w-[140px] bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 font-black py-3 rounded-2xl transition-colors flex justify-center items-center gap-2">
                    <i className="fas fa-plus-circle"></i> إضافة إيراد
                </button>
                <button onClick={() => { setEditingId(null); setFormData({ ...formData, type: 'expense', category: categories.expense[0] }); setIsModalOpen(true); }} className="flex-1 min-w-[140px] bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-black py-3 rounded-2xl transition-colors flex justify-center items-center gap-2">
                    <i className="fas fa-minus-circle"></i> إضافة مصروف
                </button>
                <button onClick={exportToExcel} className="flex-1 min-w-[140px] bg-slate-800 text-white hover:bg-slate-700 font-black py-3 rounded-2xl transition-colors flex justify-center items-center gap-2">
                    <i className="fas fa-file-excel text-emerald-400"></i> إكسيل
                </button>
                <button onClick={exportToPDF} className="flex-1 min-w-[140px] bg-slate-800 text-white hover:bg-slate-700 font-black py-3 rounded-2xl transition-colors flex justify-center items-center gap-2">
                    <i className="fas fa-file-pdf text-rose-400"></i> طباعة PDF
                </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-black text-slate-800">تفاصيل الحركات المالية</h3>
                    <span className="bg-cyan-50 text-cyan-600 text-xs font-bold px-3 py-1 rounded-full">{transactions.length} حركة مسجلة</span>
                </div>
                
                {isLoading ? (
                    <div className="p-10 text-center text-slate-400"><i className="fas fa-circle-notch fa-spin text-3xl mb-3"></i></div>
                ) : transactions.length === 0 ? (
                    <div className="p-10 text-center">
                        <i className="fas fa-receipt text-5xl text-slate-200 mb-3"></i>
                        <p className="text-slate-500 font-bold">لا توجد حركات مالية مسجلة في هذه الفترة</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-right whitespace-nowrap">
                            <thead className="bg-slate-50 text-slate-500 text-xs">
                                <tr>
                                    <th className="p-4 font-black">التاريخ</th>
                                    <th className="p-4 font-black">النوع</th>
                                    <th className="p-4 font-black">التصنيف</th>
                                    <th className="p-4 font-black">البيان</th>
                                    <th className="p-4 font-black">المبلغ</th>
                                    <th className="p-4 font-black text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm font-bold text-slate-700">
                                {currentItems.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-500">{t.date}</td>
                                        <td className="p-4">
                                            {t.type === 'income' 
                                                ? <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-xs"><i className="fas fa-arrow-down mr-1"></i> إيراد</span>
                                                : <span className="bg-rose-50 text-rose-600 px-2 py-1 rounded text-xs"><i className="fas fa-arrow-up mr-1"></i> مصروف</span>
                                            }
                                        </td>
                                        <td className="p-4">{t.category}</td>
                                        <td className="p-4 text-slate-500 max-w-xs truncate">{t.description || '-'}</td>
                                        <td className={`p-4 font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === 'income' ? '+' : '-'}{t.amount}
                                        </td>
                                        {/* أزرار التعديل والحذف */}
                                        <td className="p-4 text-center">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={() => openEditModal(t)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors flex items-center justify-center">
                                                    <i className="fas fa-pen text-xs"></i>
                                                </button>
                                                <button onClick={() => handleDeleteTransaction(t.id)} className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors flex items-center justify-center">
                                                    <i className="fas fa-trash text-xs"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                            disabled={currentPage === 1}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-50"
                        >
                            السابق
                        </button>
                        <span className="text-sm font-bold text-slate-500">
                            صفحة {currentPage} من {totalPages}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                            disabled={currentPage === totalPages}
                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-50"
                        >
                            التالي
                        </button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-view">
                        <div className={`p-5 text-white ${formData.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <i className={`fas ${editingId ? 'fa-pen' : (formData.type === 'income' ? 'fa-plus-circle' : 'fa-minus-circle')}`}></i>
                                {editingId ? 'تعديل الحركة المالية' : (formData.type === 'income' ? 'تسجيل إيراد الخزينة' : 'تسجيل مصروف الخزينة')}
                            </h3>
                        </div>
                        <form onSubmit={handleSubmitTransaction} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">المبلغ (ج.م)</label>
                                <input type="number" step="0.01" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none text-left dir-ltr" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">التصنيف</label>
                                <select value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none bg-slate-50 cursor-pointer">
                                    {(formData.type === 'income' ? categories.income : categories.expense).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">التاريخ</label>
                                <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none bg-slate-50 cursor-pointer" />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 mb-1">البيان / ملاحظات (اختياري)</label>
                                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full border-2 border-slate-200 focus:border-[#06B6D4] rounded-xl p-3 font-bold text-slate-700 outline-none resize-none" rows="2" placeholder="مثال: مبيعات، فاتورة، الخ..."></textarea>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={isLoading} className={`flex-1 text-white font-black py-3 rounded-xl transition-opacity hover:opacity-90 ${formData.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                    {editingId ? 'حفظ التعديلات' : 'حفظ العملية'}
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