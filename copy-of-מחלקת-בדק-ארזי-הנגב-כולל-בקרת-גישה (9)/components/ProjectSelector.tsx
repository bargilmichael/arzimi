
import React from 'react';
import { Project } from '../types';
import { translations } from '../translations';
import { Language } from '../translations';

interface ProjectSelectorProps {
  projects: Project[];
  onSelect: (projectId: string) => void;
  lang: Language;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, onSelect, lang }) => {
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" dir={(lang === 'he' || lang === 'ar') ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
           <svg width="180" height="60" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto mb-6 drop-shadow-md">
            <path d="M40 50L70 10L100 50H40Z" fill="#71717A" fillOpacity="0.8"/>
            <path d="M75 50L105 15L135 50H75Z" fill="#A1A1AA" fillOpacity="0.6"/>
            <path d="M10 50L40 20L70 50H10Z" fill="#3F3F46" fillOpacity="0.9"/>
            <text x="0" y="70" fontFamily="Heebo" fontWeight="800" fontSize="22" fill="#18181B">ארזי הנגב</text>
            <text x="0" y="82" fontFamily="Heebo" fontWeight="500" fontSize="8" fill="#52525B">ייזום ובניה בע"מ</text>
          </svg>
          <h1 className="text-4xl font-black text-slate-900 mb-2">{lang === 'he' ? 'בחר פרויקט' : 'Select Project'}</h1>
          <p className="text-slate-500 font-bold tracking-wide uppercase text-xs">{lang === 'he' ? 'ניהול מעקב ומשימות שירות לקוחות' : 'Customer Service Task Management'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project.id)}
              className="group relative bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-2 active:scale-95 text-right overflow-hidden shadow-slate-200/50"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[5rem] -mr-10 -mt-10 group-hover:bg-blue-100/50 transition-colors"></div>
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-lg shadow-blue-200 transition-transform group-hover:rotate-6">
                  🏗️
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">{project.name}</h2>
                <div className="flex items-center gap-2 text-slate-400 font-bold text-sm mb-6">
                  <span>📍</span>
                  <span>{project.location}</span>
                </div>
                
                <div className="flex items-center justify-between mt-4 py-3 px-5 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                  <span className="text-slate-600 font-black text-sm">{lang === 'he' ? 'כניסה לפרויקט' : 'Enter Project'}</span>
                  <span className="text-xl group-hover:translate-x-1 transition-transform">
                    {lang === 'he' ? '←' : '→'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-[0.2em]">Mahleket Bedek - Arazi HaNegev</p>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelector;
