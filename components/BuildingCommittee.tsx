
import React, { useState } from 'react';
import { Building, TenantInfo } from '../types';
import { translations, Language } from '../translations';

interface Props {
  building: Building;
  onUpdate: (committee: TenantInfo) => void;
  lang: Language;
  userRole?: string;
}

const BuildingCommittee: React.FC<Props> = ({ building, onUpdate, lang, userRole }) => {
  const t = translations[lang];
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(building?.committeeContact?.name || '');
  const [phone, setPhone] = useState(building?.committeeContact?.phone || '');

  const handleSave = () => {
    onUpdate({ name, phone });
    setIsEditing(false);
  };

  if (!building) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="bg-indigo-50 p-2 rounded-xl text-xl">🏢</div>
        <div>
          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{t.committeeContactLabel}</h4>
          {isEditing ? (
            <div className="flex items-center gap-2 mt-2 animate-in zoom-in-95">
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                placeholder={t.tenantNameField}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-100 focus:border-indigo-500 outline-none w-32"
              />
              <input 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder={t.tenantPhoneField}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-indigo-100 focus:border-indigo-500 outline-none w-32"
              />
              <button 
                onClick={handleSave}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm hover:bg-indigo-700"
              >
                {t.saveCommittee}
              </button>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-[10px] font-black text-gray-400 px-2"
              >
                {lang === 'he' ? 'ביטול' : 'Cancel'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm font-black text-indigo-900">
                {building.committeeContact?.name || (lang === 'he' ? 'טרם הוזן איש קשר' : 'No contact yet')}
              </span>
              {building.committeeContact?.phone && (
                <span className="text-sm font-bold text-gray-400">({building.committeeContact.phone})</span>
              )}
              {userRole === 'admin' && (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-600 font-bold underline"
                >
                  {lang === 'he' ? 'ערוך' : 'Edit'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {building.committeeContact?.phone && !isEditing && (
        <a 
          href={`tel:${building.committeeContact.phone}`}
          className="bg-green-50 text-green-600 p-2 rounded-full hover:bg-green-100 transition-colors"
        >
          📞
        </a>
      )}
    </div>
  );
};

export default BuildingCommittee;
