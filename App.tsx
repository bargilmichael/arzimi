import React, { useState, useEffect, useMemo } from 'react';
import { ProjectState, TaskStatus, Unit, Discipline, Building, DisciplineDefinition } from './types';
import { initializeData, getUnit, getUnitStatus, updateUnit, updateBuilding } from './services/dataService';
import BuildingSelector from './components/BuildingSelector';
import BuildingCommittee from './components/BuildingCommittee';
import UnitGrid from './components/UnitGrid';
import UnitModal from './components/UnitModal';
import PlotSelector from './components/PlotSelector';
import StatusDashboard from './components/StatusDashboard';
import FilteredUnitList from './components/FilteredUnitList';
import ContractorView from './components/ContractorView';
import ScheduleView from './components/ScheduleView';
import ProjectHistoryView from './components/ProjectHistoryView';
import UserManagement from './components/UserManagement';
import Login from './components/Login';
import LanguageSelector from './components/LanguageSelector';
import ProjectSelector from './components/ProjectSelector';
import { auth, onAuthStateChanged, logout, FirebaseUser, db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Language, translations } from './translations';
import { PUBLIC_AREAS, STATUS_CONFIG } from './constants';

const ADMIN_EMAIL = 'bargil.michael@gmail.com';

const Logo = () => (
  <svg width="140" height="50" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm">
    <path d="M40 50L70 10L100 50H40Z" fill="#71717A" fillOpacity="0.8"/>
    <path d="M75 50L105 15L135 50H75Z" fill="#A1A1AA" fillOpacity="0.6"/>
    <path d="M10 50L40 20L70 50H10Z" fill="#3F3F46" fillOpacity="0.9"/>
    <text x="0" y="70" fontFamily="Heebo" fontWeight="800" fontSize="22" fill="#18181B">ארזי הנגב</text>
    <text x="0" y="82" fontFamily="Heebo" fontWeight="500" fontSize="8" fill="#52525B">ייזום ובניה בע"מ</text>
  </svg>
);

const App: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'contractor' | 'viewer'>('viewer');
  const [userDiscipline, setUserDiscipline] = useState<string>('all');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    return localStorage.getItem('selected_project_id');
  });
  const [state, setState] = useState<ProjectState>(() => initializeData(selectedProjectId || undefined));
  const [disciplines, setDisciplines] = useState<DisciplineDefinition[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [showAllProcesses, setShowAllProcesses] = useState(false);
  const [viewMode, setViewMode] = useState<'units' | 'public' | 'contractors' | 'schedule' | 'history' | 'users' | 'processes'>('units');
  const [deletionPassword, setDeletionPassword] = useState<string>('');
  
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('app_lang') as Language) || 'he';
  });

  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setDeletionPassword('');
      return;
    }
    const unsub = onSnapshot(doc(db, 'settings', 'history_deletion'), (snapshot) => {
      if (snapshot.exists()) {
        setDeletionPassword(snapshot.data().password || '');
      } else {
        setDeletionPassword('');
      }
    }, (error) => {
      console.warn("History deletion password subscription error:", error);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setFirestoreConnected(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setFirestoreConnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      const { enableNetwork, getDocFromServer, doc } = await import('firebase/firestore');
      await enableNetwork(db);
      const healthRef = doc(db, '_internal_', 'healthcheck');
      await getDocFromServer(healthRef).catch(() => {});
      setFirestoreConnected(true);
      setIsOnline(navigator.onLine);
    } catch (e) {
      console.warn("Manual reconnect check:", e);
    } finally {
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem('selected_project_id', selectedProjectId);
      setState(initializeData(selectedProjectId));
    } else {
      localStorage.removeItem('selected_project_id');
      setState(initializeData());
    }
    // Deep reset of selections when project changes
    setSelectedPlotId(null);
    setSelectedBuildingId(null);
    setSelectedUnitId(null);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!user || !selectedProjectId) return;

    console.log("Setting up Firestore listeners for user:", user.email, "Project:", selectedProjectId);

    // Sync Disciplines
    const unsubDisc = onSnapshot(collection(db, 'disciplines'), (snapshot) => {
      const discData = snapshot.docs.map(doc => doc.data() as DisciplineDefinition);
      setDisciplines(discData);
      setFirestoreConnected(true);
    }, (error) => {
      console.error("Firestore Disciplines onSnapshot error:", error);
      if (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('reach')) {
        setFirestoreConnected(false);
      }
    });

    const unsubUnits = onSnapshot(collection(db, 'units'), (snapshot) => {
      console.log(`Units onSnapshot fired: ${snapshot.size} docs`);
      const unitsData: Record<string, Unit> = {};
      snapshot.forEach(doc => {
        const data = doc.data() as Unit;
        // Migration/Preservation logic: If no projectId, it's Bnei Brak
        const docProjectId = data.projectId || 'bnei-brak';
        if (docProjectId === selectedProjectId) {
          unitsData[doc.id] = { ...data, projectId: docProjectId };
        }
      });
      
      setLastSync(new Date());
      setFirestoreConnected(true);
      setState(prev => {
        const newUnits = { ...prev.units, ...unitsData };
        return { ...prev, units: newUnits };
      });
    }, (error) => {
      console.error("Firestore Units onSnapshot error:", error);
      if (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('reach')) {
        setFirestoreConnected(false);
      }
    });

    const unsubBuildings = onSnapshot(collection(db, 'buildings'), (snapshot) => {
      console.log(`Buildings onSnapshot fired: ${snapshot.size} docs`);
      const buildingsData: Building[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Building;
        const docProjectId = data.projectId || 'bnei-brak';
        if (docProjectId === selectedProjectId) {
          buildingsData.push({ ...data, projectId: docProjectId });
        }
      });
      
      setLastSync(new Date());
      setFirestoreConnected(true);
      if (buildingsData.length > 0) {
        setState(prev => {
          const newBuildings = prev.buildings.map(b => {
             const found = buildingsData.find(fb => fb.id === b.id);
             return found ? { ...b, ...found, totalUnits: b.totalUnits } : b;
          });
          return { ...prev, buildings: newBuildings };
        });
      }
    }, (error) => {
      console.error("Firestore Buildings onSnapshot error:", error);
      if (error.code === 'unavailable' || error.message?.includes('offline') || error.message?.includes('reach')) {
        setFirestoreConnected(false);
      }
    });

    return () => {
      unsubDisc();
      unsubUnits();
      unsubBuildings();
    };
  }, [user, selectedProjectId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (currentUser && currentUser.email) {
          const userEmail = currentUser.email.toLowerCase();
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            // Check if there's a pre-added user by email
            const emailRef = doc(db, 'users', userEmail);
            const emailSnap = await getDoc(emailRef);
            
            if (emailSnap.exists() && !emailSnap.data().uid) {
              const preData = emailSnap.data();
              
              if (preData.blocked) {
                setIsBlocked(true);
                setIsAuthorized(false);
                setUser(currentUser);
                setIsAuthReady(true);
                return;
              }

              const finalRole = userEmail === ADMIN_EMAIL ? 'admin' : (preData.role || 'viewer');
              
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                role: finalRole,
                discipline: preData.discipline || 'all'
              });
              
              await deleteDoc(emailRef);
              
              setUserRole(finalRole);
              setUserDiscipline(preData.discipline || 'all');
              setIsAuthorized(true);
            } else if (userEmail === ADMIN_EMAIL) {
              const defaultRole = 'admin';
              const defaultDiscipline = 'all';
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email.split('@')[0],
                role: defaultRole,
                discipline: defaultDiscipline
              });
              setUserRole(defaultRole);
              setUserDiscipline(defaultDiscipline);
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
              // Log unauthorized attempt
              try {
                const attemptId = `${currentUser.uid}_${Date.now()}`;
                await setDoc(doc(db, 'login_attempts', attemptId), {
                  uid: currentUser.uid,
                  email: userEmail,
                  displayName: currentUser.displayName || '---',
                  timestamp: serverTimestamp(),
                  userAgent: navigator.userAgent,
                  status: 'unauthorized'
                });
              } catch (e) {
                console.error("Error logging unauthorized attempt:", e);
              }
            }
          } else {
            const data = userSnap.data();
            if (data.blocked) {
              setIsBlocked(true);
              setIsAuthorized(false);
              setUser(currentUser);
              setIsAuthReady(true);
              
              // Log blocked attempt
              try {
                const attemptId = `${currentUser.uid}_${Date.now()}`;
                await setDoc(doc(db, 'login_attempts', attemptId), {
                  uid: currentUser.uid,
                  email: userEmail,
                  displayName: currentUser.displayName || data.displayName || '---',
                  timestamp: serverTimestamp(),
                  userAgent: navigator.userAgent,
                  status: 'blocked'
                });
              } catch (e) {
                console.error("Error logging blocked attempt:", e);
              }
              return;
            }
            setIsBlocked(false);
            const role = userEmail === ADMIN_EMAIL ? 'admin' : data.role;
            setUserRole(role);
            setUserDiscipline(data.discipline || 'all');
            setIsAuthorized(true);
            
            // Log successful attempt (optional but good for tracking)
            try {
              const loginRef = doc(db, 'users', currentUser.uid);
              await setDoc(loginRef, {
                lastLogin: serverTimestamp(),
                lastDevice: navigator.userAgent
              }, { merge: true });
            } catch (e) {}
          }
        } else if (currentUser && !currentUser.email) {
          // This should rarely happen with Google login, but for safety:
          setIsAuthorized(false);
          try {
            const attemptId = `${currentUser.uid}_${Date.now()}`;
            await setDoc(doc(db, 'login_attempts', attemptId), {
              uid: currentUser.uid,
              timestamp: serverTimestamp(),
              userAgent: navigator.userAgent,
              status: 'no_email'
            });
          } catch (e) {}
        } else {
          setIsAuthorized(null);
        }
      } catch (error) {
        console.error("Auth error:", error);
        // Log error attempt
        if (currentUser) {
           try {
            const attemptId = `${currentUser.uid}_${Date.now()}`;
            await setDoc(doc(db, 'login_attempts', attemptId), {
              uid: currentUser.uid,
              email: currentUser.email,
              timestamp: serverTimestamp(),
              status: 'error',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          } catch (e) {}
        }
        // Fallback to true if it's the admin, just in case Firestore is being flaky
        if (currentUser?.email?.toLowerCase() === ADMIN_EMAIL) {
          setUserRole('admin');
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      }
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('app_lang', lang);
    document.documentElement.dir = (lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = translations[lang] || translations.he;

  useEffect(() => {
    if (!selectedPlotId && state.plots.length > 0) {
      setSelectedPlotId(state.plots[0].id);
    }
  }, [state.plots, selectedPlotId]);

  useEffect(() => {
    if (selectedPlotId) {
      const plotBuildings = state.buildings.filter(b => b.plotId === selectedPlotId);
      if (plotBuildings.length > 0 && !plotBuildings.find(b => b.id === selectedBuildingId)) {
        setSelectedBuildingId(plotBuildings[0].id);
      }
    }
  }, [selectedPlotId, state.buildings]);

  useEffect(() => {
    if (!selectedBuildingId && state.buildings.length > 0) {
      setSelectedBuildingId(state.buildings[0].id);
    }
  }, [state.buildings, selectedBuildingId]);

  useEffect(() => {
    console.log("Current state units count:", Object.keys(state.units).length);
    const firstUnit = Object.values(state.units)[0] as Unit | undefined;
    if (firstUnit) {
      console.log("First unit sample data:", { 
        id: firstUnit.id, 
        historyCount: firstUnit.history.length
      });
    }
  }, [state.units]);

  const activeUnit = useMemo(() => {
    if (!selectedBuildingId || selectedUnitId === null) return null;
    return getUnit(state, selectedBuildingId, selectedUnitId);
  }, [state, selectedBuildingId, selectedUnitId]);

  // Fix: updated newLog parameter to include optional images field to match UnitModal's onSave requirement
  const handleUpdateUnit = (updates: { 
    newLog?: { status: TaskStatus, workerName: string, contractor: string, contractorId: string, description: string, discipline: Discipline, images?: string[] },
    updateLogStatus?: { logId: string, newStatus: TaskStatus },
    deleteLogId?: string,
    editLog?: any,
    updateTenantInfo?: { name: string, phone: string },
    workConfirmation?: {
      signerName: string,
      tenantEmail?: string,
      originalDescription: string,
      translatedDescription: string,
      attachmentUrl: string,
      language: 'ru' | 'ar'
    }
  }, unitOverride?: Unit) => {
    if (userRole === 'viewer') {
      console.warn("Viewer is not allowed to update units.");
      return;
    }
    const targetUnit = unitOverride || activeUnit;
    if (!targetUnit) return;
    const newState = updateUnit(state, targetUnit, {
      newLog: updates.newLog,
      updateLogStatus: updates.updateLogStatus,
      deleteLogId: updates.deleteLogId,
      editLog: updates.editLog,
      updateTenantInfo: updates.updateTenantInfo,
      workConfirmation: updates.workConfirmation
    });
    setState(newState);
  };

  const handleClearAllHistory = async () => {
    if (!isAdmin) return;
    
    console.log("Clearing all history...");
    const newState = { ...state };
    const unitIds = Object.keys(newState.units);
    const { saveUnitToFirestore } = await import('./services/dataService');
    
    for (const id of unitIds) {
      const unit = newState.units[id];
      if (unit.history.length > 0) {
        const resetStatuses: Record<string, TaskStatus> = {};
        disciplines.forEach(d => {
          resetStatuses[d.id] = TaskStatus.NOT_STARTED;
        });

        const updatedUnit = { 
          ...unit, 
          history: [],
          statuses: resetStatuses
        };
        newState.units[id] = updatedUnit;
        await saveUnitToFirestore(updatedUnit);
      }
    }
    
    setState(newState);
    alert(lang === 'he' ? 'כל הנתונים (היסטוריה) נמחקו בהצלחה' : 'All data (history) cleared successfully');
  };

  const handleDeleteMyTasks = async () => {
    if (userRole === 'viewer') {
      console.warn("Viewer is not allowed to delete tasks.");
      return;
    }
    if (!user) return;
    const name = user.displayName || user.email?.split('@')[0];
    if (!name) return;
    
    console.log("Deleting all tasks for worker:", name);
    let newState = { ...state };
    let anyChanges = false;
    const { saveUnitToFirestore } = await import('./services/dataService');

    const unitEntries = Object.entries(newState.units);
    for (const [unitId, unitData] of unitEntries) {
      const unit = unitData as Unit;
      const myLogs = unit.history.filter(l => l.workerName === name);
      
      if (myLogs.length > 0) {
        let currentUnit = { ...unit };
        
        // Remove logs
        myLogs.forEach(log => {
          const logToDelete = currentUnit.history.find(l => l.id === log.id);
          if (logToDelete) {
            currentUnit.history = currentUnit.history.filter(l => l.id !== log.id);
            const remainingLogsForDiscipline = currentUnit.history
              .filter(l => l.discipline === logToDelete.discipline)
              .sort((a, b) => b.timestamp - a.timestamp);
            
            const newStatus = remainingLogsForDiscipline.length > 0 
              ? remainingLogsForDiscipline[0].status 
              : TaskStatus.NOT_STARTED;
              
            currentUnit.statuses = {
              ...currentUnit.statuses,
              [logToDelete.discipline]: newStatus
            };
          }
        });

        newState.units[unitId] = currentUnit;
        await saveUnitToFirestore(currentUnit);
        anyChanges = true;
      }
    }

    if (anyChanges) {
      setState(newState);
      alert(lang === 'he' ? 'כל המשימות שלך נמחקו בהצלחה' : 'All your tasks deleted successfully');
    } else {
      alert(lang === 'he' ? 'לא נמצאו משימות לשיוך' : 'No tasks found associated with you');
    }
  };

  const filteredBuildings = state.buildings.filter(b => {
    const isSearchMatch = b.name.includes(searchTerm) || b.id.includes(searchTerm);
    const isPlotMatch = !selectedPlotId || b.plotId === selectedPlotId;
    return isSearchMatch && isPlotMatch;
  });

  const handleSelectFromOtherView = (buildingId: string, unitId: string | number) => {
    const building = state.buildings.find(b => b.id === buildingId);
    if (building) {
      setSelectedPlotId(building.plotId);
    }
    setSelectedBuildingId(buildingId);
    setSelectedUnitId(unitId);
  };

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const isWorkManager = userRole === 'contractor' && userDiscipline === 'general';
  const isSupervisor = isAdmin || isWorkManager;

  const activeProject = state.projects.find(p => p.id === selectedProjectId);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  if (!user) {
    return <Login lang={lang} setLang={setLang} />;
  }

  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center" dir={(lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr'}>
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-red-100 max-w-md w-full">
          <div className="text-8xl mb-8 animate-bounce">🚫</div>
          <h1 className="text-3xl font-black text-red-600 mb-4">{isBlocked ? (t as any).accessBlocked : (t as any).unauthorizedTitle}</h1>
          <p className="text-gray-500 font-bold mb-10 text-lg leading-relaxed">
            {isBlocked ? (lang === 'he' ? 'חשבונך נחסם לגישה במערכת על ידי מנהל.' : 'Your account has been blocked by an administrator.') : (t as any).notAuthorized}
          </p>
          <div className="p-4 bg-gray-50 rounded-2xl mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">מחובר כיום:</p>
            <p className="text-sm font-black text-gray-700">{user.email}</p>
          </div>
          <button 
            onClick={logout}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black hover:bg-black transition-all active:scale-95 shadow-xl"
          >
            {lang === 'he' ? 'התנתק ונסה חשבון אחר' : lang === 'ru' ? 'Выйти и попробовать другой аккаунт' : 'تسجيل الخروج وتجربة حساب آخر'}
          </button>
        </div>
      </div>
    );
  }

  if (!selectedProjectId) {
    return <ProjectSelector projects={state.projects} onSelect={setSelectedProjectId} lang={lang} />;
  }

  return (
    <div className={`min-h-screen bg-slate-50 ${lang === 'ru' ? 'text-left' : 'text-right'}`} dir={(lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm p-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedProjectId(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-900 group"
                title={lang === 'he' ? 'חזור לבחירת פרויקט' : 'Back to projects'}
              >
                <span className="text-xl group-hover:-translate-x-1 inline-block transition-transform">{lang === 'he' ? '→' : '←'}</span>
              </button>
              <Logo />
            </div>
            <div className="h-10 w-[1px] bg-gray-200 hidden md:block"></div>
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <div>
                <h1 className="text-lg font-black leading-none text-blue-900">{activeProject?.name || t.appName}</h1>
                <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-widest font-bold">{t.appSubName}</p>
              </div>
              
              <div className="flex items-center">
                {!isOnline || !firestoreConnected ? (
                  <button 
                    onClick={handleReconnect}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black tracking-wide hover:bg-amber-100 transition-all cursor-pointer animate-pulse"
                    title={(t as any).offlineWarning || "Working offline - Click to reconnect"}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>{(t as any).connectionOffline}</span>
                    <span className={`text-[9px] ${isReconnecting ? 'animate-spin' : ''}`}>🔄</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black tracking-wide select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 cursor-pulse"></span>
                    <span>{(t as any).connectionActive}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-black text-gray-700">{user.displayName}</span>
                <button onClick={logout} className="text-[10px] text-red-500 font-bold hover:underline">
                  {lang === 'he' ? 'התנתק' : 'Выйти'}
                </button>
              </div>
              <LanguageSelector currentLang={lang} onSelect={setLang} className="md:hidden" />
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex-1 md:w-64 relative">
              <input 
                type="text" 
                placeholder={t.searchPlaceholder} 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className={`w-full bg-gray-50 border border-gray-200 rounded-full ${lang === 'ru' ? 'pl-10 pr-4' : 'pr-10 pl-4'} py-2 text-sm placeholder:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500/20 font-bold transition-all`} 
              />
              <span className={`absolute ${lang === 'ru' ? 'right-3' : 'right-3'} top-2.5 opacity-30`}>🔍</span>
            </div>
            <LanguageSelector currentLang={lang} onSelect={setLang} className="hidden md:flex" />
            <button onClick={logout} className="hidden md:block bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full text-sm font-bold transition-colors border border-red-100 text-red-500 shadow-sm">
              {lang === 'he' ? 'התנתק' : 'Выйти'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto pb-24 px-4">
        {/* Navigation Tabs */}
        <div className="flex gap-2 my-6 bg-slate-200/40 p-1.5 rounded-2xl w-full overflow-x-auto no-scrollbar md:w-fit mx-auto md:mx-0 shadow-inner border border-slate-300/20">
          <button onClick={() => setViewMode('units')} className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'units' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>{t.viewUnits}</button>
          <button onClick={() => setViewMode('public')} className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'public' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>{t.viewPublic}</button>
          <button onClick={() => setViewMode('contractors')} className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'contractors' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>{t.viewContractors}</button>
          <button onClick={() => setViewMode('schedule')} className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'schedule' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>{t.viewSchedule}</button>
          <button onClick={() => setViewMode('history')} className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'history' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>{t.viewHistory}</button>
          <button 
            onClick={() => setViewMode('processes')} 
            className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'processes' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {(t as any).viewProcesses}
            {(statusFilter || viewMode === 'processes') && <span className="mr-2 w-2 h-2 rounded-full bg-blue-400 inline-block animate-pulse"></span>}
          </button>
          {userRole === 'admin' && (
            <button onClick={() => setViewMode('users')} className={`whitespace-nowrap flex-1 md:flex-none px-6 py-2.5 rounded-xl font-black transition-all ${viewMode === 'users' ? 'bg-white shadow-md text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {lang === 'he' ? 'משתמשים' : lang === 'ru' ? 'Пользователи' : 'المستخدمين'}
            </button>
          )}
        </div>

        {viewMode === 'contractors' ? (
          <ContractorView state={state} lang={lang} onSelectUnit={handleSelectFromOtherView} userRole={userRole} userDiscipline={userDiscipline} disciplines={disciplines} />
        ) : viewMode === 'schedule' ? (
          <ScheduleView state={state} lang={lang} onSelectUnit={handleSelectFromOtherView} userRole={userRole} userDiscipline={userDiscipline} disciplines={disciplines} />
        ) : viewMode === 'history' ? (
          <ProjectHistoryView 
            state={state} 
            lang={lang} 
            onSelectUnit={handleSelectFromOtherView} 
            onUpdate={handleUpdateUnit}
            onClearAll={handleClearAllHistory}
            onDeleteMyTasks={handleDeleteMyTasks}
            userRole={userRole} 
            userDiscipline={userDiscipline} 
            disciplines={disciplines}
            deletionPassword={deletionPassword}
          />
        ) : viewMode === 'processes' ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mt-4 flex justify-end px-4">
              {selectedPlotId && (
                <button 
                  onClick={() => setShowAllProcesses(!showAllProcesses)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all border shadow-sm ${showAllProcesses ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-600 border-blue-100 hover:bg-blue-50'}`}
                >
                  {showAllProcesses ? '✅' : '⬜'} {lang === 'he' ? 'צפה בכל המגרשים' : lang === 'ru' ? 'Смотреть все участки' : 'View All Plots'}
                </button>
              )}
            </div>
            <section className="mt-2">
              <StatusDashboard 
                state={state} 
                lang={lang} 
                selectedPlotId={showAllProcesses ? null : selectedPlotId} 
                discipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'} 
                statusFilter={statusFilter}
                onStatusClick={setStatusFilter}
              />
            </section>

            <FilteredUnitList 
              state={state}
              lang={lang}
              selectedPlotId={showAllProcesses ? null : selectedPlotId}
              discipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'}
              statusFilter={statusFilter as any}
              onSelectUnit={(buildingId, unitId) => {
                handleSelectFromOtherView(buildingId, unitId);
                setViewMode('units');
              }}
            />
            
            <section className="mt-8 px-4">
               <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">{(t as any).selectPlot}</h2>
                {selectedPlotId && (
                  <button onClick={() => setSelectedPlotId(null)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">
                    {t.allPlots}
                  </button>
                )}
              </div>
              <PlotSelector 
                plots={state.plots} 
                selectedPlotId={selectedPlotId} 
                onSelect={setSelectedPlotId} 
                state={state} 
                lang={lang} 
                discipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'} 
              />
            </section>
          </div>
        ) : viewMode === 'users' && isAdmin ? (
          <UserManagement lang={lang} projectId={selectedProjectId || 'bnei-brak'} />
        ) : (
          <>
            <section className="mt-4">
              <div className="flex items-center justify-between px-4 mb-2">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">{(t as any).selectPlot}</h2>
                {selectedPlotId && (
                  <button onClick={() => setSelectedPlotId(null)} className="text-[10px] font-black text-blue-600 uppercase hover:underline">
                    {t.allPlots}
                  </button>
                )}
              </div>
              <PlotSelector 
                plots={state.plots} 
                selectedPlotId={selectedPlotId} 
                onSelect={setSelectedPlotId} 
                state={state} 
                lang={lang} 
                discipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'} 
              />
            </section>

            <section className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-4 mb-2">{t.selectBuilding}</h2>
              <BuildingSelector buildings={filteredBuildings} selectedBuildingId={selectedBuildingId} onSelect={setSelectedBuildingId} state={state} lang={lang} discipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'} />
            </section>

            {selectedBuildingId && state.buildings.find(b => b.id === selectedBuildingId) && (
                  <section className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <BuildingCommittee 
                      building={state.buildings.find(b => b.id === selectedBuildingId)!}
                      onUpdate={(committee) => {
                        const newState = updateBuilding(state, selectedBuildingId, { committeeContact: committee });
                        setState(newState);
                      }}
                      lang={lang}
                      userRole={userRole}
                    />
                    
                    {viewMode === 'units' ? (
                      <UnitGrid 
                        buildingId={selectedBuildingId} 
                        state={state} 
                        onSelectUnit={(num) => setSelectedUnitId(num)} 
                        onUpdateTenant={(num, name, phone) => {
                          const unit = getUnit(state, selectedBuildingId, num);
                          const newState = updateUnit(state, unit, { updateTenantInfo: { name, phone } });
                          setState(newState);
                        }}
                        lang={lang} 
                        discipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'} 
                        userRole={userRole}
                        userDiscipline={userDiscipline}
                        statusFilter={statusFilter}
                        onStatusClick={setStatusFilter}
                      />
                    ) : (
                      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                        <h2 className="text-2xl font-black text-gray-800 mb-8 flex items-center gap-3">
                          <span className="bg-blue-50 p-2 rounded-xl">🏢</span> {t.publicAreas}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                          {PUBLIC_AREAS.map(area => {
                            const unitData = getUnit(state, selectedBuildingId, area.id);
                            const currentDiscipline = (userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general';
                            const finalStatus = getUnitStatus(unitData, currentDiscipline) || TaskStatus.NOT_STARTED;
                            const config = STATUS_CONFIG[finalStatus];
                            return (
                              <button key={area.id} onClick={() => setSelectedUnitId(area.id)} className={`flex items-center gap-5 p-6 rounded-2xl border-2 transition-all hover:shadow-xl active:scale-95 text-right group ${config.color}`}>
                                <span className="text-4xl group-hover:scale-110 transition-transform">{area.icon}</span>
                                <div className="flex flex-col">
                                  <span className="font-black text-xl">{(t as any)[area.labelKey]}</span>
                                  <span className="text-xs font-bold opacity-70">{(t as any)[config.labelKey]}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                )}
          </>
        )}
      </main>

      {activeUnit && (
        <UnitModal 
          key={activeUnit.id}
          unit={activeUnit} 
          state={state}
          onClose={() => setSelectedUnitId(null)} 
          onSave={handleUpdateUnit} 
          lang={lang} 
          activeDiscipline={(userRole === 'contractor' && userDiscipline !== 'all') ? (userDiscipline as Discipline) : 'general'} 
          userRole={userRole}
          userDiscipline={userDiscipline}
          disciplines={disciplines}
        />
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t p-4 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.footerInfo}</p>
          <div className="flex items-center gap-4">
            {lastSync && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                  {lang === 'he' ? 'סונכרן ' : 'Synced '}
                  {lastSync.toLocaleTimeString('he-IL')}
                </span>
              </div>
            )}
            <div className="flex gap-1">
              {(['he', 'ru', 'ar'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md transition-all ${
                    lang === l ? 'bg-slate-900 text-white' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {l === 'he' ? 'HE' : l === 'ru' ? 'RU' : 'AR'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;