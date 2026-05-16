
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, getDocs } from 'firebase/firestore';
import { Language, translations } from '../translations';
import { DisciplineDefinition } from '../types';

interface UserProfile {
  uid: string | null;
  email: string;
  displayName: string | null;
  role: 'admin' | 'contractor' | 'viewer';
  discipline?: string;
}

interface Props {
  lang: Language;
}

const DEFAULT_DISCIPLINES: DisciplineDefinition[] = [
  { id: 'general', labels: { he: 'מנהל עבודה / כללי', ru: 'Прораб / Общее', ar: 'مدير عمل / عام' }, isActive: true },
  { id: 'plumbing', labels: { he: 'אינסטלטור (אינסטלציה)', ru: 'Сантехник', ar: 'سباك (سباكة)' }, isActive: true },
  { id: 'rappelling', labels: { he: 'איש סנפלינג (סנפלינג)', ru: 'Верхолаз (Снапплинг)', ar: 'رجل تسلق (سنابلك)' }, isActive: true },
  { id: 'telefire', labels: { he: 'טלפייר (כיבוי אש)', ru: 'Telefire (Пож. безоп.)', ar: 'تليفايير (إطفاء حريق)' }, isActive: true },
  { id: 'itumit', labels: { he: 'קבלן איטום (איטום)', ru: 'Герметизация', ar: 'إيتوميت (عزل)' }, isActive: true },
  { id: 'emperion', labels: { he: 'אמפריון (משאבות)', ru: 'Emperion (Насосы)', ar: 'إمبيريون (مضخات)' }, isActive: true },
  { id: 'workers', labels: { he: 'פועל (שלד וגמר)', ru: 'Рабочий', ar: 'عامل (بناء وتشطيب)' }, isActive: true },
  { id: 'electrician', labels: { he: 'חשמלאי (חשמל)', ru: 'Электрик', ar: 'كهربائي (كهرباء)' }, isActive: true },
];

const UserManagement: React.FC<Props> = ({ lang }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [disciplines, setDisciplines] = useState<DisciplineDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  
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
      }
    });

    return () => {
      unsubUsers();
      unsubDisc();
    };
  }, []);

  const handleAddDiscipline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!discId || !discHe) return alert('נא למלא מזהה ושם בעברית');
    const id = discId.trim().toLowerCase().replace(/\s+/g, '_');
    
    try {
      await setDoc(doc(db, 'disciplines', id), {
        id,
        labels: { he: discHe, ru: discRu || discHe, ar: discAr || discHe },
        isActive: true
      });
      setDiscId(''); setDiscHe(''); setDiscRu(''); setDiscAr('');
      setIsAddingDiscipline(false);
    } catch (error) {
      console.error("Error adding discipline:", error);
    }
  };

  const toggleDisciplineActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'disciplines', id), { isActive: !current });
    } catch (error) {
      console.error("Error updating discipline:", error);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserProfile['role']) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { role: newRole });
    } catch (error) {
      console.error("Error updating role:", error);
      alert(t.errorUpdatingRole);
    }
  };

  const handleDisciplineChange = async (userId: string, discipline: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { discipline });
    } catch (error) {
      console.error("Error updating discipline:", error);
      alert(t.errorUpdatingRole);
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
        discipline: newRole === 'contractor' ? newDiscipline : 'all'
      });
      setNewEmail('');
      setNewName('');
      setNewRole('viewer');
      setNewDiscipline('all');
      alert(t.userAdded);
    } catch (error) {
      console.error("Error adding user:", error);
      alert(t.errorAddingUser);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (email === 'bargil.michael@gmail.com') return;
    const confirmMsg = lang === 'he' ? `האם למחוק את המשתמש ${email}?` : lang === 'ru' ? `Удалить пользователя ${email}?` : `هل تريد حذف المستخدم ${email}؟`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
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
              {users.map((user: any) => (
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
                    {user.email !== 'bargil.michael@gmail.com' && (
                        <button 
                          onClick={() => handleDeleteUser(user.id, user.email)}
                          className="text-red-400 hover:text-red-600 p-2 transition-colors"
                          title={lang === 'he' ? 'מחק משתמש' : lang === 'ru' ? 'Удалить пользователя' : 'حذف المستخدم'}
                        >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-xs font-bold text-blue-700 leading-relaxed">
            💡 {t.roleExplanation}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
