import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const FIELDS = [
  { key: 'statusOrName', label: '상호명 / 상태', type: 'text', placeholder: '예: 공실 (구 편의점)', required: true },
  { key: 'type', label: '유형', type: 'select', options: ['임대', '매매'] },
  { key: 'zone', label: '구역', type: 'text', placeholder: '예: 청리단' },
  { key: 'address', label: '주소', type: 'text', placeholder: '예: 부평동 123-4' },
  { key: 'buildingName', label: '건물명', type: 'text', placeholder: '예: 부평타워' },
  { key: 'floor', label: '층수', type: 'text', placeholder: '예: 1' },
  { key: 'areaExclusive', label: '전용면적 (㎡)', type: 'number', placeholder: '예: 49.5' },
  { key: 'deposit', label: '보증금 (만원)', type: 'number', placeholder: '예: 2000' },
  { key: 'rent', label: '월세 (만원)', type: 'number', placeholder: '예: 150' },
  { key: 'premium', label: '권리금 (만원)', type: 'number', placeholder: '예: 0' },
  { key: 'maintenanceFee', label: '관리비 (만원)', type: 'number', placeholder: '예: 15' },
  { key: 'contactOwner', label: '임대인 연락처', type: 'tel', placeholder: '010-0000-0000' },
  { key: 'contactTenant', label: '임차인 연락처', type: 'tel', placeholder: '010-0000-0000' },
  { key: 'notes', label: '비고', type: 'textarea', placeholder: '특이사항을 입력하세요' },
];

export default function PropertyEditModal({ property, onSave, onClose, sheetMeta }) {
  const [form, setForm] = useState({});
  const [isVacant, setIsVacant] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // 폼 초기화
  useEffect(() => {
    if (!property) return;
    const initial = {};
    FIELDS.forEach(({ key }) => {
      initial[key] = property[key] !== undefined ? String(property[key]) : '';
    });
    setForm(initial);
    setIsVacant(!!property.isVacant);
    setIsCompleted(!!property.isCompleted);
    setSaved(false);
    setSaveError(null);
  }, [property]);

  const handleChange = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const patch = {};
      FIELDS.forEach(({ key, type }) => {
        if (type === 'number') patch[key] = parseFloat(form[key]) || 0;
        else patch[key] = form[key] || '';
      });
      patch.isVacant = isVacant;

      // 완료 처리
      if (isCompleted) {
        patch.statusOrName = '완료매물';
        patch.isCompleted = true;
      } else {
        // 완료 취소 시 statusOrName을 form 값 사용
        patch.isCompleted = false;
      }

      await onSave(property.id, patch);
      setSaved(true);
      setTimeout(() => onClose(), 900);
    } catch (e) {
      setSaveError(e.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ESC 닫기
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!property) return null;

  const hasSheetSync = !!(sheetMeta?.sheetTitle);

  return (
    <>
      {/* 오버레이 */}
      <div className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" onClick={onClose} />

      {/* 모달 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-2xl text-white">
            <div>
              <h2 className="font-bold text-base">매물 정보 수정</h2>
              <p className="text-xs text-white/60 mt-0.5">
                {property.zone} · {property.statusOrName}
                {hasSheetSync ? (
                  <span className="ml-2 text-green-300">✓ 시트 자동 저장</span>
                ) : (
                  <span className="ml-2 text-amber-300">⚠ 로컬 저장 (구글 연동 시 시트 반영)</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
              <X size={18} />
            </button>
          </div>

          {/* 폼 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* 완료 처리 토글 */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">완료 처리</p>
                <p className="text-xs text-slate-500">완료된 매물은 기본적으로 목록에서 숨겨집니다</p>
              </div>
              <button
                onClick={() => setIsCompleted((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isCompleted ? 'bg-slate-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isCompleted ? 'translate-x-5 left-0' : 'left-0.5'}`} />
              </button>
            </div>

            {/* 공실 토글 */}
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-green-800">공실 여부</p>
                <p className="text-xs text-green-600">현재 입주자가 없는 공실 상태입니다</p>
              </div>
              <button
                onClick={() => setIsVacant((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${isVacant ? 'bg-green-500' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isVacant ? 'translate-x-5 left-0' : 'left-0.5'}`} />
              </button>
            </div>

            {/* 필드 그리드 */}
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.map(({ key, label, type, placeholder, options, required }) => {
                if (required || ['type', 'zone', 'address'].includes(key)) {
                  // 주요 필드: full width
                  if (key === 'notes') return null; // notes는 아래에서 단독 렌더
                  return (
                    <div key={key} className={key === 'statusOrName' || key === 'address' ? 'col-span-2' : 'col-span-1'}>
                      <FieldInput
                        fieldKey={key} label={label} type={type}
                        placeholder={placeholder} options={options} value={form[key] || ''}
                        onChange={(v) => handleChange(key, v)}
                      />
                    </div>
                  );
                }
                if (key === 'notes') return null;
                return (
                  <div key={key} className="col-span-1">
                    <FieldInput
                      fieldKey={key} label={label} type={type}
                      placeholder={placeholder} value={form[key] || ''}
                      onChange={(v) => handleChange(key, v)}
                    />
                  </div>
                );
              })}
            </div>

            {/* 비고 textarea */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">비고</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="특이사항을 입력하세요"
                value={form.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </div>

            {/* 오류 메시지 */}
            {saveError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm">
                <AlertCircle size={16} />
                {saveError}
              </div>
            )}
          </div>

          {/* 하단 버튼 */}
          <div className="p-4 border-t border-slate-200 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-semibold text-sm rounded-xl transition
                ${saved
                  ? 'bg-green-500 text-white'
                  : saving
                  ? 'bg-blue-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
            >
              {saved ? (
                <><CheckCircle2 size={16} /> 저장됨</>
              ) : saving ? (
                <><Loader2 size={16} className="animate-spin" /> 저장 중...</>
              ) : (
                <><Save size={16} /> 저장</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function FieldInput({ fieldKey, label, type, placeholder, options, value, onChange }) {
  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type === 'tel' ? 'tel' : type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}
