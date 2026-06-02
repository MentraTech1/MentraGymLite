// ============================================================================
// MentraGym Lite - Offline First Database Engine
// Powered by Dexie.js (IndexedDB Wrapper)
// ============================================================================

// 1. قاعدة البيانات الرئيسية (Master DB) - لتخزين الفروع/الصالات المسجلة على هذا الجهاز
window.masterDb = new Dexie("MentraGym_MasterDB");
window.masterDb.version(2).stores({
    gyms: '++id, gymName, ownerName, phone, dbName, createdAt'
});

// متغير عالمي سيحمل قاعدة بيانات الفرع النشط
window.db = null;

// 2. دالة تشفير كلمات المرور (للحماية المحلية)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 3. دالة تهيئة وفتح قاعدة بيانات فرع معين (Gym Instance)
window.initGymDB = async function(dbName) {
    if (window.db) {
        window.db.close();
    }
    
    window.db = new Dexie(dbName);
    
    // تصميم الجداول الخاصة بنظام الجيم (Schema)
    window.db.version(1).stores({
        // المستخدمين (مدير، مدرب، استقبال)
        users: '++id, name, phone, password, role, is_active',
        
        // الأعضاء (المشتركين)
        members: '++id, name, phone, barcode, active_status',
        
        // ================= Workout Engine (نظام التمارين) =================
        exercise_categories: '++id, name',
        exercises: '++id, category_id, name, target_muscle',
        workout_plans: '++id, name, level, goal, duration_weeks',
        workout_days: '++id, plan_id, day_name, day_order',
        workout_exercises: '++id, day_id, exercise_id', 
        member_workout_plans: '++id, member_id, plan_id, start_date, status',
        workout_logs: '++id, member_id, plan_id, day_id, date, is_completed',
        workout_log_details: '++id, log_id, exercise_id',

        // ================= Financial Engine (نظام الحسابات والماليات) =================
        
        // سجل الاشتراكات المدفوعة للأعضاء
        subscriptions: '++id, member_id, start_date, end_date, status', 
        
        // سجل الخزينة (المصروفات والإيرادات)
        // type: 'income' (إيراد) | 'expense' (مصروف)
        transactions: '++id, type, date, category' 
    });

    await window.db.open();
};

// ============================================================================
// كائن الاستعلامات (GymQueries) - يحتوي على كافة دوال التعامل مع البيانات
// ============================================================================
window.GymQueries = {
    
    // --- 1. المصادقة وتأسيس الجيم ---
    
    createGym: async (gymName, ownerName, phone, password) => {
        const dbName = `MentraGym_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const hashedPassword = await hashPassword(password);
        
        const gymId = await window.masterDb.gyms.add({
            gymName, ownerName, phone, dbName, createdAt: new Date().toISOString()
        });
        
        await window.initGymDB(dbName);
        
        const userId = await window.db.users.add({
            name: ownerName, phone, password: hashedPassword, role: 'owner', is_active: true
        });

        await window.db.exercise_categories.bulkAdd([
            { name: 'عضلات الصدر (Chest)' },
            { name: 'عضلات الظهر (Back)' },
            { name: 'عضلات الأرجل (Legs)' },
            { name: 'عضلات الكتف (Shoulders)' },
            { name: 'عضلات الذراعين (Arms)' },
            { name: 'عضلات البطن (Core/Abs)' },
            { name: 'كارديو لياقة (Cardio)' }
        ]);

        return { gymId, userId, dbName };
    },

    login: async (dbName, phone, password) => {
        const hashedPassword = await hashPassword(password);
        
        const gym = await window.masterDb.gyms.where('dbName').equals(dbName).first();
        if (!gym) throw new Error("بيانات الجيم غير موجودة");

        await window.initGymDB(dbName);
        const user = await window.db.users.where('phone').equals(phone).first();
        
        if (!user) throw new Error("رقم الهاتف غير مسجل");
        if (!user.is_active) throw new Error("هذا الحساب موقوف، راجع الإدارة");
        if (user.password !== hashedPassword) throw new Error("كلمة المرور غير صحيحة");

        return { user, gym, dbName };
    },

    // --- 2. إدارة مكتبة التمارين (Exercises Library) ---

    addExerciseCategory: async (name) => {
        return await window.db.exercise_categories.add({ name });
    },

    getCategories: async () => {
        return await window.db.exercise_categories.toArray();
    },

    addExercise: async (categoryId, name, targetMuscle) => {
        return await window.db.exercises.add({ category_id: parseInt(categoryId), name, target_muscle: targetMuscle });
    },

    getExercisesByCategory: async (categoryId) => {
        if (!categoryId) return await window.db.exercises.toArray();
        return await window.db.exercises.where('category_id').equals(parseInt(categoryId)).toArray();
    },

    // --- 3. بناء الخطط التدريبية (Workout Plans Engine) ---

    createWorkoutPlan: async (name, level, goal, durationWeeks) => {
        return await window.db.workout_plans.add({ name, level, goal, duration_weeks: parseInt(durationWeeks) });
    },

    addDayToPlan: async (planId, dayName, dayOrder) => {
        return await window.db.workout_days.add({ plan_id: parseInt(planId), day_name: dayName, day_order: parseInt(dayOrder) });
    },

    addExerciseToDay: async (dayId, exerciseId, sets, reps, restTime, notes) => {
        return await window.db.workout_exercises.add({
            day_id: parseInt(dayId), exercise_id: parseInt(exerciseId), sets: parseInt(sets),
            reps: reps, rest_time_seconds: parseInt(restTime), notes: notes || ""
        });
    },

    getFullPlanDetails: async (planId) => {
        const plan = await window.db.workout_plans.get(parseInt(planId));
        if (!plan) return null;

        const days = await window.db.workout_days.where('plan_id').equals(plan.id).sortBy('day_order');
        for (let day of days) {
            const dayExercises = await window.db.workout_exercises.where('day_id').equals(day.id).toArray();
            for (let dex of dayExercises) {
                dex.exercise_details = await window.db.exercises.get(dex.exercise_id);
            }
            day.exercises = dayExercises;
        }
        plan.days = days;
        return plan;
    },

    // --- 4. تعيين وتتبع خطط الأعضاء (Member Tracking) ---

    assignPlanToMember: async (memberId, planId) => {
        await window.db.member_workout_plans.where('member_id').equals(parseInt(memberId)).modify({ status: 'archived' });
        return await window.db.member_workout_plans.add({
            member_id: parseInt(memberId), plan_id: parseInt(planId), start_date: new Date().toISOString().split('T')[0], status: 'active'
        });
    },

    logWorkoutSession: async (memberId, planId, dayId, exercisesLogData) => {
        return await window.db.transaction('rw', window.db.workout_logs, window.db.workout_log_details, async () => {
            const logId = await window.db.workout_logs.add({
                member_id: parseInt(memberId), plan_id: parseInt(planId), day_id: parseInt(dayId),
                date: new Date().toISOString().split('T')[0], is_completed: true
            });

            const detailsToInsert = exercisesLogData.map(ex => ({
                log_id: logId, exercise_id: parseInt(ex.exercise_id), actual_sets: parseInt(ex.actual_sets),
                actual_reps: parseInt(ex.actual_reps), weight_used: parseFloat(ex.weight_used), notes: ex.notes || ""
            }));

            await window.db.workout_log_details.bulkAdd(detailsToInsert);
            return logId;
        });
    },

    // --- 5. الحسابات والماليات (Financial Engine) ---

    /**
     * تجديد/إضافة اشتراك لعضو.
     * تقوم بتسجيل الاشتراك في جدول الاشتراكات، وتسجيل قيمته كـ "إيراد" في جدول الخزينة.
     */
    addSubscription: async (memberId, amount, durationMonths, startDateStr) => {
        // حساب تاريخ انتهاء الاشتراك بناءً على عدد الشهور
        const start = new Date(startDateStr);
        const end = new Date(start);
        end.setMonth(end.getMonth() + parseInt(durationMonths));
        const endDateStr = end.toISOString().split('T')[0];

        // استخدام Transaction لضمان تسجيل الاشتراك والفلوس معاً بأمان
        return await window.db.transaction('rw', window.db.subscriptions, window.db.transactions, async () => {
            // 1. إضافة سجل الاشتراك
            const subId = await window.db.subscriptions.add({
                member_id: parseInt(memberId),
                start_date: startDateStr,
                end_date: endDateStr,
                amount: parseFloat(amount),
                status: 'active'
            });

            // 2. تسجيل الفلوس كإيراد في الخزينة
            await window.db.transactions.add({
                type: 'income',
                category: 'اشتراكات أعضاء',
                amount: parseFloat(amount),
                date: startDateStr,
                description: `تجديد اشتراك للعضو رقم ${memberId} لمدة ${durationMonths} شهر`
            });

            return subId;
        });
    },

    /** تسجيل مصروفات الجيم (إيجار، كهرباء، صيانة، الخ) */
    addExpense: async (amount, category, description, dateStr) => {
        return await window.db.transactions.add({
            type: 'expense',
            category: category,
            amount: parseFloat(amount),
            date: dateStr || new Date().toISOString().split('T')[0],
            description: description || ""
        });
    },

    /** تسجيل إيرادات أخرى (مبيعات بار، مكملات، زجاجات مياه) */
    addIncome: async (amount, category, description, dateStr) => {
        return await window.db.transactions.add({
            type: 'income',
            category: category,
            amount: parseFloat(amount),
            date: dateStr || new Date().toISOString().split('T')[0],
            description: description || ""
        });
    },

    /** استخراج تقرير مالي (صافي الربح، إجمالي الإيرادات، إجمالي المصروفات) بين تاريخين */
    getFinancialSummary: async (startDateStr, endDateStr) => {
        // جلب كل العمليات المالية التي وقعت بين هذين التاريخين
        const transactions = await window.db.transactions
            .where('date')
            .between(startDateStr, endDateStr, true, true)
            .toArray();

        let totalIncome = 0;
        let totalExpense = 0;

        transactions.forEach(t => {
            if (t.type === 'income') totalIncome += t.amount;
            if (t.type === 'expense') totalExpense += t.amount;
        });

        return {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            transactions // إرجاع القائمة لعرضها في جدول
        };
    }
};