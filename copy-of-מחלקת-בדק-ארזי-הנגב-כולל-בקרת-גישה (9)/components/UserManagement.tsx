
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, getDocs } from 'firebase/firestore';
import { Language, translations } from '../translations';
import { DisciplineDefinition } from '../types';
import { TenantImporter } from './TenantImporter';

interface UserProfile {
  id: string;
  uid: string | null;
  email: string;
  displayName: string | null;
  role: 'admin' | 'contractor' | 'viewer';
  discipline?: string;
  blocked?: boolean;
}

interface LoginAttempt {
  id: string;
  uid?: string;
  email?: string;
  displayName?: string;
  timestamp: any;
  userAgent: string;
  status: 'unauthorized' | 'blocked' | 'no_email' | 'error';
  error?: string;
}

interface Props {
  lang: Language;
  projectId: string;
}

export const DEFAULT_DISCIPLINES: DisciplineDefinition[] = [
  { id: 'general', labels: { he: 'מנהל עבודה / כללי', ru: 'Прораб / Общее', ar: 'مدير عمل / عام' }, isActive: true },
  { id: 'plumbing', labels: { he: 'אינסטלטור (אינסטלציה)', ru: 'Сантехник', ar: 'سباك (سباكة)' }, isActive: true },
  { id: 'rappelling', labels: { he: 'איש סנפלינג (סנפלינג)', ru: 'Верхолаз (Снапплинг)', ar: 'رجل تسلق (سنابلك)' }, isActive: true },
  { id: 'telefire', labels: { he: 'טלפייר (כיבוי אש)', ru: 'Telefire (Пож. безоп.)', ar: 'تليفايير (إطفاء حريق)' }, isActive: true },
  { id: 'itumit', labels: { he: 'קבלן איטום (איטום)', ru: 'Герметизация', ar: 'إيتوميت (عزل)' }, isActive: true },
  { id: 'emperion', labels: { he: 'אמפריון (משאבות)', ru: 'Emperion (Насосы)', ar: 'إمبيريون (مضخات)' }, isActive: true },
  { id: 'workers', labels: { he: 'פועל (שלד וגמר)', ru: 'Рабочий', ar: 'عامل (بناء وتشطيب)' }, isActive: true },
  { id: 'electrician', labels: { he: 'חשמלאי (חשמל)', ru: 'Электрик', ar: 'كهربائي (كهرباء)' }, isActive: true },
  { id: 'gas_contractor', labels: { he: 'קבלן גז', ru: 'Подрядчик по газу', ar: 'مقاول غاز' }, isActive: true },
  { id: 'aluminum', labels: { he: 'איש אלומיניום (חלונות ותריסים)', ru: 'Алюминиевые конструкции', ar: 'فני ألمنيوم (نوافذ وأباجورات)' }, isActive: true },
];

const UserManagement: React.FC<Props> = ({ lang, projectId }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineDefinition[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  
  // History Deletion Password State
  const [deletionPassword, setDeletionPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // User Form State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserProfile['role']>('viewer');
  const [newDiscipline, setNewDiscipline] = useState<string>('all');
  
  // Discipline Form State
  const [isAddingDiscipline, setIsAddingDiscipline] = useState(false);
  const [discId, setDiscId] = useState('');
  const [discHe, setDiscHe] = useState('');
  const [discRu, setDiscRu] = useState('');
  const [discAr, setDiscAr] = useState('');

  // Toast and Confirmation states
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const t = translations[lang];

  useEffect(() => {
    // Sync Users
    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as any));
      const sortedUsers = usersData.sort((a: any, b: any) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return a.email.localeCompare(b.email);
      });
      setUsers(sortedUsers);
      setLoading(false);
    });

    // Sync Disciplines
    const unsubDisc = onSnapshot(collection(db, 'disciplines'), async (snapshot) => {
      if (snapshot.empty) {
        // Initialize with defaults if empty
        for (const d of DEFAULT_DISCIPLINES) {
          await setDoc(doc(db, 'disciplines', d.id), d);
        }
      } else {
        const discData = snapshot.docs.map(doc => doc.data() as DisciplineDefinition);
        setDisciplines(discData);
        // Automatically insert any missing default disciplines
        for (const d of DEFAULT_DISCIPLINES) {
          if (!discData.some(existing => existing.id === d.id)) {
            await setDoc(doc(db, 'disciplines', d.id), d);
          }
        }
      }
    });

    // Sync Login Attempts
    const unsubAttempts = onSnapshot(collection(db, 'login_attempts'), (snapshot) => {
      const attempts = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LoginAttempt));
      setLoginAttempts(attempts.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 50));
    });

    // Sync Deletion Password
    const unsubPassword = onSnapshot(doc(db, 'settings', 'history_deletion'), (snapshot) => {
      if (snapshot.exists()) {
        setDeletionPassword(snapshot.data().password || '');
      }
    }, (error) => {
      console.warn("History deletion password subscription error in UserManagement:", error);
    });

    return () => {
      unsubUsers();
      unsubDisc();
      unsubAttempts();
      unsubPassword();
    };
  }, []);

  const handleSaveDeletionPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletionPassword.trim()) {
      showToast(lang === 'he' ? 'נא להזין סיסמה לא ריקה' : 'Please enter a non-empty password', 'error');
      return;
    }
    setIsSavingPassword(true);
    try {
      await setDoc(doc(db, 'settings', 'history_deletion'), {
        password: deletionPassword.trim()
      });
      showToast(lang === 'he' ? 'סיסמת מחיקת היסטוריה עודכנה בהצלחה!' : 'History deletion password updated successfully!');
    } catch (error) {
      console.error("Error saving deletion password:", error);
      showToast(lang === 'he' ? 'שגיאה בעדכון הסיסמה' : 'Error updating password', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleAddDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discId || !discHe) {
      showToast(lang === 'he' ? 'נא למלא מזהה ושם בעברית' : 'Please fill ID and Hebrew name', 'error');
      return;
    }
    const id = discId.trim().toLowerCase().replace(/\s+/g, '_');
    
    try {
      await setDoc(doc(db, 'disciplines', id), {
        id,
        labels: { he: discHe, ru: discRu || discHe, ar: discAr || discHe },
        isActive: true
      });
      setDiscId(''); setDiscHe(''); setDiscRu(''); setDiscAr('');
      setIsAddingDiscipline(false);
      showToast(lang === 'he' ? 'התחום נוסף בהצלחה!' : 'Discipline added successfully!');
    } catch (error) {
      console.error("Error adding discipline:", error);
      showToast(lang === 'he' ? 'שגיאה בהוספת תחום' : 'Error adding discipline', 'error');
    }
  };

  const toggleDisciplineActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'disciplines', id), { isActive: !current });
      showToast(lang === 'he' ? 'סטטוס תחום עודכן בהצלחה' : 'Discipline status updated');
    } catch (error) {
      console.error("Error updating discipline:", error);
      showToast(lang === 'he' ? 'שגיאה בעדכון תחום' : 'Error updating discipline', 'error');
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserProfile['role']) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
      showToast(lang === 'he' ? 'תפקיד עודכן בהצלחה' : 'Role updated successfully');
    } catch (error) {
      console.error("Error updating role:", error);
      showToast(t.errorUpdatingRole || 'Error updating role', 'error');
    }
  };

  const handleDisciplineChange = async (userId: string, discipline: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { discipline });
      showToast(lang === 'he' ? 'תחום עודכן בהצלחה' : 'Discipline updated successfully');
    } catch (error) {
      console.error("Error updating discipline:", error);
      showToast(t.errorUpdatingRole || 'Error updating discipline', 'error');
    }
  };

  const handleToggleBlock = async (userId: string, currentStatus: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { blocked: !currentStatus });
      showToast(
        !currentStatus 
          ? (lang === 'he' ? 'המשתמש נחסם בהצלחה' : 'User blocked successfully') 
          : (lang === 'he' ? 'החסימה בוטלה בהצלחה!' : 'User unblocked successfully!')
      );
    } catch (error) {
      console.error("Error toggling block:", error);
      showToast(lang === 'he' ? 'שגיאה בעדכון חסימה' : 'Error updating block status', 'error');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      const userRef = doc(db, 'users', newEmail.trim().toLowerCase());
      await setDoc(userRef, {
        uid: null,
        email: newEmail.trim().toLowerCase(),
        displayName: newName.trim() || null,
        role: newRole,
        discipline: newRole === 'contractor' ? newDiscipline : 'all',
        blocked: false
      });
      setNewEmail('');
      setNewName('');
      setNewRole('viewer');
      setNewDiscipline('all');
      showToast(t.userAdded || 'User added successfully');
    } catch (error) {
      console.error("Error adding user:", error);
      showToast(t.errorAddingUser || 'Error adding user', 'error');
    }
  };

  const handleDeleteUser = (userId: string, email: string) => {
    if (email === 'bargil.michael@gmail.com') return;

    setConfirmModal({
      show: true,
      title: lang === 'he' ? 'מחיקת משתמש' : 'Delete User',
      message: lang === 'he' ? `האם למחוק את המשתמש ${email}?` : `Are you sure you want to delete user ${email}?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          showToast(lang === 'he' ? 'המשתמש נמחק בהצלחה' : 'User deleted successfully');
        } catch (error) {
          console.error("Error deleting user:", error);
          showToast(lang === 'he' ? 'שגיאה במחיקת המשתמש' : 'Error deleting user', 'error');
        }
      }
    });
  };

  const handleApproveAttempt = (attempt: LoginAttempt) => {
    if (!attempt.email) return;
    const emailLower = attempt.email.trim().toLowerCase();

    setConfirmModal({
      show: true,
      title: lang === 'he' ? 'אישור משתמש חדש' : 'Approve New User',
      message: lang === 'he' 
        ? `האם לאשר גישה למערכת לחשבון ${emailLower}?` 
        : `Approve system access for account ${emailLower}?`,
      onConfirm: async () => {
        try {
          const userId = attempt.uid || emailLower;
          const userRef = doc(db, 'users', userId);
          await setDoc(userRef, {
            uid: attempt.uid || null,
            email: emailLower,
            displayName: attempt.displayName || emailLower.split('@')[0],
            role: 'viewer',
            discipline: 'all',
            blocked: false
          });
          showToast(
            lang === 'he' 
              ? `אישור הגישה לחשבון ${emailLower} בוצע בהצלחה!` 
              : `Approval of access for account ${emailLower} was completed successfully!`
          );
        } catch (error) {
          console.error("Error approving attempt:", error);
          showToast(lang === 'he' ? 'שגיאה באישור הגישה למשתמש' : 'Error approving user access', 'error');
        }
      }
    });
  };

  if (loading) return (
    <div className="p-8 text-center font-bold text-gray-500">
      {lang === 'he' ? 'טוען נתונים...' : lang === 'ru' ? 'Загрузка данных...' : 'جاري تحميل البيانات...'}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
          <span className="bg-blue-50 p-2 rounded-xl">➕</span> 
          {t.addUser}
        </h2>
        
        <form onSubmit={handleAddUser} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase px-2 tracking-widest">{t.userName}</label>
              <input 
                type="text" 
                placeholder={t.namePlaceholder}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold transition-all bg-slate-50/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase px-2 tracking-widest">{t.userEmail}</label>
              <input 
                type="email" 
                placeholder={t.emailPlaceholder}
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold transition-all bg-slate-50/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase px-2 tracking-widest">{t.userRole}</label>
              <select 
                value={newRole}
                onChange={e => setNewRole(e.target.value as UserProfile['role'])}
                className="w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-black transition-all bg-white"
              >
                <option value="admin">{t.adminRole}</option>
                <option value="contractor">{t.contractorRole}</option>
                <option value="viewer">{t.viewerRole}</option>
              </select>
            </div>

            {newRole === 'contractor' && (
              <div className="space-y-2 animate-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center px-2">
                  <label className="text-xs font-black text-indigo-500 uppercase tracking-widest">{t.disciplineLabel}</label>
                  <button 
                    type="button"
                    onClick={() => setIsAddingDiscipline(!isAddingDiscipline)}
                    className="text-[10px] font-black text-indigo-600 hover:underline"
                  >
                    {isAddingDiscipline ? (lang === 'he' ? 'ביטול' : 'Cancel') : (lang === 'he' ? '+ נהל תחומים' : '+ Manage Disciplines')}
                  </button>
                </div>

                {!isAddingDiscipline ? (
                  <select 
                    value={newDiscipline}
                    onChange={e => setNewDiscipline(e.target.value)}
                    className="w-full p-4 rounded-2xl border-2 border-indigo-100 focus:border-indigo-500 outline-none font-black transition-all bg-white shadow-sm ring-4 ring-indigo-50/50"
                    required
                  >
                    <option value="all">{t.allDisciplines}</option>
                    {disciplines.map(d => (
                      <option key={d.id} value={d.id}>{d.labels[lang] || d.labels.he} {!d.isActive ? ' (לא פעיל)' : ''}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-indigo-50 rounded-2xl border-2 border-indigo-200 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={discId} onChange={e => setDiscId(e.target.value)} placeholder="ID (e.g. paint)" className="p-2 text-xs rounded-lg border font-bold" />
                      <input type="text" value={discHe} onChange={e => setDiscHe(e.target.value)} placeholder="שם בעברית" className="p-2 text-xs rounded-lg border font-bold" />
                    </div>
                    <button 
                      type="button"
                      onClick={handleAddDiscipline}
                      className="w-full bg-indigo-600 text-white py-2 rounded-xl font-black text-xs shadow-md"
                    >
                      {lang === 'he' ? 'שמור תחום חדש' : 'Save New'}
                    </button>
                    
                    <div className="pt-2 border-t border-indigo-200">
                      <p className="text-[9px] font-black text-indigo-400 uppercase mb-2">תחומים קיימים (לחץ לנטרול):</p>
                      <div className="flex flex-wrap gap-1">
                        {disciplines.map(d => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDisciplineActive(d.id, d.isActive)}
                            className={`px-2 py-1 rounded-md text-[9px] font-black border transition-all ${d.isActive ? 'bg-white border-indigo-200 text-indigo-600' : 'bg-gray-100 border-gray-200 text-gray-400'}`}
                          >
                            {d.labels.he}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                <p className="text-[10px] text-indigo-400 font-bold px-2 mt-1">
                  💡 {lang === 'he' ? 'קבלן זה יוכל לראות ולדווח אך ורק בתחום שנבחר.' : 'This contractor will only see and report on the selected discipline.'}
                </p>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className="w-full bg-blue-600 text-white px-8 py-5 rounded-[2rem] font-black shadow-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-lg"
          >
            🚀 {t.addUser}
          </button>
        </form>
      </div>

      <TenantImporter lang={lang} projectId={projectId} />

      {/* הגדרת סיסמה למחיקת היסטוריה */}
      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-3">
          <span className="bg-red-50 p-2 rounded-xl">🔑</span>
          {lang === 'he' ? 'סיסמת אבטחה למחיקת היסטוריה' : 'Security Password for History Deletion'}
        </h2>
        
        <form onSubmit={handleSaveDeletionPassword} className="space-y-4 max-w-md">
          <p className="text-xs text-gray-500 font-bold leading-relaxed">
            {lang === 'he' 
              ? 'על מנת למנוע מחיקה מקרית או בלתי מורשית של היסטוריית הפרויקט, מנהל המערכת (Admin) נדרש להגדיר סיסמה ייעודית. מחיקת היסטוריה תתאפשר רק לאחר הזנת סיסמה זו.'
              : 'To prevent accidental or unauthorized deletion of project history, the administrator is required to set a dedicated password. History deletion will only be possible after entering this password.'}
          </p>
          
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase px-2 tracking-widest block">
              {lang === 'he' ? 'סיסמת מחיקה' : 'Deletion Password'}
            </label>
            <div className="relative flex items-center">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder={lang === 'he' ? 'הזן סיסמת מחיקה חדשה' : 'Enter new deletion password'}
                value={deletionPassword}
                onChange={e => setDeletionPassword(e.target.value)}
                required
                className="w-full p-4 pl-12 rounded-2xl border-2 border-slate-100 focus:border-red-500 outline-none font-bold transition-all bg-slate-50/30 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-4 text-gray-400 hover:text-gray-600 focus:outline-none text-xs font-black"
              >
                {showPassword ? (lang === 'he' ? 'הסתר' : 'Hide') : (lang === 'he' ? 'הצג' : 'Show')}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSavingPassword}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isSavingPassword 
              ? (lang === 'he' ? 'שומר סיסמה...' : 'Saving password...') 
              : (lang === 'he' ? '💾 שמור סיסמת מחיקה' : '💾 Save Deletion Password')}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
          <span className="bg-blue-50 p-2 rounded-xl">👥</span> 
          {t.userManagement}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.userName}</th>
                <th className="py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.userEmail}</th>
                <th className="py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.userRole}</th>
                <th className="py-4 px-4 text-xs font-black text-gray-400 uppercase tracking-widest">{t.disciplineLabel}</th>
                <th className="py-4 px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.filter(u => !u.blocked).map((user: UserProfile) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-black text-gray-700">{user.displayName || '---'}</td>
                  <td className="py-4 px-4 font-bold text-gray-500 text-sm">{user.email}</td>
                  <td className="py-4 px-4">
                    <select 
                      value={user.role} 
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserProfile['role'])}
                      disabled={user.email === 'bargil.michael@gmail.com'}
                      className={`px-4 py-2 rounded-xl font-black text-xs border-2 transition-all outline-none ${
                        user.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' :
                        user.role === 'contractor' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-gray-50 text-gray-600 border-gray-100'
                      } ${user.email === 'bargil.michael@gmail.com' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}`}
                    >
                      <option value="admin">{t.adminRole}</option>
                      <option value="contractor">{t.contractorRole}</option>
                      <option value="viewer">{t.viewerRole}</option>
                    </select>
                  </td>
                  <td className="py-4 px-4">
                    {user.role === 'contractor' && (
                      <select 
                        value={user.discipline || 'all'} 
                        onChange={(e) => handleDisciplineChange(user.id, e.target.value)}
                        className="px-4 py-2 rounded-xl font-black text-xs border-2 border-gray-100 bg-white hover:border-blue-400 transition-all outline-none cursor-pointer"
                      >
                        <option value="all">{t.allDisciplines}</option>
                        {disciplines.map(d => (
                          <option key={d.id} value={d.id}>{d.labels[lang] || d.labels.he}</option>
                        ))}
                      </select>
                    )}
                    {user.role !== 'contractor' && <span className="text-gray-300 font-bold text-xs uppercase">---</span>}
                  </td>
                  <td className="py-4 px-4 text-left">
                    <div className="flex items-center justify-end gap-2">
                       {user.email !== 'bargil.michael@gmail.com' && (
                        <button 
                          onClick={() => handleToggleBlock(user.id, false)}
                          className="bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-orange-100 transition-all border border-orange-100"
                          title={(t as any).block}
                        >
                          🚫 {(t as any).block}
                        </button>
                      )}
                      {user.email !== 'bargil.michael@gmail.com' && (
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors border border-red-100"
                            title={lang === 'he' ? 'מחק משתמש' : lang === 'ru' ? 'Удалить пользователя' : 'حذف المستخدم'}
                          >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.some(u => u.blocked) && (
          <div className="mt-12 border-t pt-8">
            <h3 className="text-xl font-black text-red-600 mb-6 flex items-center gap-3">
              <span className="bg-red-50 p-2 rounded-xl">🚫</span> 
              {(t as any).emailsBlocked}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.userName}</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.userEmail}</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.filter(u => u.blocked).map((user: UserProfile) => (
                    <tr key={user.id} className="bg-red-50/20">
                      <td className="py-3 px-4 font-bold text-gray-700">{user.displayName || '---'}</td>
                      <td className="py-3 px-4 font-bold text-gray-400 text-sm italic line-through decoration-red-300">{user.email}</td>
                      <td className="py-3 px-4 text-left">
                        <button 
                          onClick={() => handleToggleBlock(user.id, true)}
                          className="bg-green-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-green-700 transition-all shadow-md"
                        >
                          🔓 {(t as any).unblock}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {loginAttempts.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h3 className="text-xl font-black text-blue-600 mb-6 flex items-center gap-3">
              <span className="bg-blue-50 p-2 rounded-xl">🕒</span> 
              {(t as any).recentAttempts}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{(t as any).attemptDate}</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.userEmail}</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{(t as any).device}</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">סטטוס</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-left">{lang === 'he' ? 'פעולות' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loginAttempts.map((attempt) => {
                    const matchedUser = attempt.email ? users.find(u => u.email.toLowerCase() === attempt.email!.toLowerCase()) : null;
                    const isAttemptRegistered = !!matchedUser;
                    const isAttemptBlocked = !!matchedUser?.blocked;
                    return (
                      <tr key={attempt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-xs font-bold text-gray-500">
                          {attempt.timestamp?.toDate ? attempt.timestamp.toDate().toLocaleString('he-IL') : '---'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-black text-gray-700 text-sm">{attempt.email || '---'}</span>
                            <span className="text-[10px] font-bold text-gray-400">{attempt.displayName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[10px] text-gray-400 max-w-[200px] truncate" title={attempt.userAgent}>
                          {attempt.userAgent || '---'}
                        </td>
                        <td className="py-3 px-4">
                           <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                             attempt.status === 'unauthorized' ? 'bg-orange-100 text-orange-600' :
                             attempt.status === 'blocked' || isAttemptBlocked ? 'bg-red-100 text-red-600' :
                             'bg-gray-100 text-gray-600'
                           }`}>
                             {isAttemptBlocked ? (lang === 'he' ? 'חסום' : 'Blocked') : ((t as any)[attempt.status] || attempt.status)}
                           </span>
                        </td>
                        <td className="py-3 px-4 text-left">
                          {attempt.email && isAttemptBlocked && (
                            <button
                              onClick={() => handleToggleBlock(matchedUser.id, true)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer animate-pulse"
                            >
                              🔓 {lang === 'he' ? 'אשר גישה / בטל חסימה' : 'Approve Access / Unblock'}
                            </button>
                          )}
                          {attempt.email && !isAttemptRegistered && (
                            <button
                              onClick={() => handleApproveAttempt(attempt)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all shadow-md cursor-pointer animate-pulse"
                            >
                              🔓 {lang === 'he' ? 'אשר גישה' : 'Approve Access'}
                            </button>
                          )}
                          {isAttemptRegistered && !isAttemptBlocked && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 uppercase select-none">
                              ✓ {lang === 'he' ? 'מאושר' : 'Approved'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-xs font-bold text-blue-700 leading-relaxed">
            💡 {t.roleExplanation}
          </p>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.show && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" dir={lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4 text-xl">
              ❓
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-slate-500 mb-6 font-bold leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs transition-all cursor-pointer"
              >
                {lang === 'he' ? 'ביטול' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const onConfirmFn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  await onConfirmFn();
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all shadow-md cursor-pointer"
              >
                {lang === 'he' ? 'אשר' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[999] p-4 rounded-2xl shadow-2xl border flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 font-bold text-sm bg-slate-900 text-white border-slate-700">
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
