import React, { useEffect } from 'react';
import {
  X, MapPin, Building2, Phone, User, FileText,
  Layers, SquareStack, Banknote, TrendingDown, Wrench,
  Calendar, Tag, ExternalLink, Pencil, CheckCircle2, RotateCcw
} from 'lucide-react';

const fmt = (n) => {
  if (!n && n !== 0) return '-';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억 원`;
  return `${n.toLocaleString()}만 원`;
};

const TYPE_STYLE = {
  임대: 'bg-blue-100 text-blue-800 border-blue-200',
  매매: 'bg-rose-100 text-rose-800 border-rose-200',
};

function InfoRow({ icon: Icon, label, value, highlight, className = '' }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={16} className="text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 break-words ${highlight || 'text-slate-800'}`}>{value}</p>
      </div>
    </div>
  );
}

function PriceCard({ label, value, highlight, sub }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`font-extrabold text-lg leading-tight ${highlight}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PropertyDrawer({ property, onClose, onEdit, onComplete, onUncomplete }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-in">
        {/* 헤더 */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${TYPE_STYLE[property.type] || TYPE_STYLE['임대']}`}>
                {property.type}
              </span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{property.zone}</span>
              {property.isVacant && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-400/20 text-green-300 border border-green-400/30 animate-pulse">
                  ● 공실
                </span>
              )}
              {property.isCompleted && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-500/50 text-slate-200 border border-slate-400/30">
                  ✓ 완료
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-tight">{property.statusOrName}</h2>
            <p className="text-sm text-white/70 mt-1 flex items-center gap-1">
              <MapPin size={13} />
              {property.address}
              {property.buildingName && ` (${property.buildingName})`}
            </p>
            {property.receivedDate && (
              <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
                <Calendar size={11} /> 접수: {property.receivedDate}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          {/* 가격 카드 */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">💰 가격 정보</h3>
            <div className="grid grid-cols-3 gap-2.5">
              <PriceCard label="보증금" value={fmt(property.deposit)} highlight="text-slate-800" />
              <PriceCard label="월세" value={fmt(property.rent)} highlight="text-rose-600" />
              <PriceCard
                label="권리금"
                value={property.premium > 0 ? fmt(property.premium) : '없음'}
                highlight={property.premium > 0 ? 'text-amber-600' : 'text-slate-400'}
              />
            </div>
            {property.maintenanceFee > 0 && (
              <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
                <Wrench size={12} />
                관리비 월 <span className="font-semibold text-slate-700">{property.maintenanceFee.toLocaleString()}만 원</span>
              </div>
            )}
          </div>

          {/* 물건 기본 정보 */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">🏢 물건 정보</h3>
            <InfoRow icon={MapPin} label="주소" value={property.address} />
            <InfoRow icon={Building2} label="건물명" value={property.buildingName} />
            <InfoRow icon={Layers} label="층수" value={property.floor ? `${property.floor}층` : null} />
            <InfoRow icon={SquareStack} label="전용면적" value={property.areaExclusive ? `${property.areaExclusive} ㎡` : null} />
            <InfoRow icon={Tag} label="구역" value={property.zone} />
          </div>

          {/* 연락처 */}
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">📞 연락처</h3>
            <div className="space-y-2">
              <ContactCard icon={User} label="임대인 / 소유자" phone={property.contactOwner} iconColor="text-blue-600" bgColor="bg-blue-50" />
              <ContactCard icon={User} label="임차인 (현재 영업자)" phone={property.contactTenant} iconColor="text-orange-500" bgColor="bg-orange-50" emptyLabel="공실 (임차인 없음)" />
            </div>
          </div>

          {/* 비고 */}
          {property.notes && (
            <div className="p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">📋 비고 및 특이사항</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 leading-relaxed whitespace-pre-line">
                {property.notes}
              </div>
            </div>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="p-4 border-t border-slate-200 bg-white">
          {/* 1행: 카카오맵 + 수정 */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => {
                const query = encodeURIComponent(property.address);
                window.open(`https://map.kakao.com/?q=${query}`, '_blank', 'noopener,noreferrer');
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold text-sm rounded-xl transition"
            >
              <ExternalLink size={15} /> 카카오맵
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(property)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-sm rounded-xl transition"
              >
                <Pencil size={15} /> 정보 수정
              </button>
            )}
          </div>
          {/* 2행: 완료처리 + 닫기 */}
          <div className="flex gap-2">
            {!property.isCompleted && onComplete && (
              <button
                onClick={() => { onComplete(property.id); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-500 hover:bg-slate-600 text-white font-semibold text-sm rounded-xl transition"
              >
                <CheckCircle2 size={15} /> 완료 처리
              </button>
            )}
            {property.isCompleted && onUncomplete && (
              <button
                onClick={() => { onUncomplete(property.id, ''); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm rounded-xl transition"
              >
                <RotateCcw size={15} /> 완료 취소
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ContactCard({ icon: Icon, label, phone, iconColor, bgColor, emptyLabel }) {
  const hasPhone = phone && phone.trim() !== '';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 ${bgColor}`}>
      <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon size={18} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400">{label}</p>
        {hasPhone ? (
          <a href={`tel:${phone.replace(/[^0-9]/g, '')}`} className={`font-bold text-sm ${iconColor} hover:opacity-80 transition`}>
            {phone}
          </a>
        ) : (
          <p className="text-sm text-slate-400 italic">{emptyLabel || '정보 없음'}</p>
        )}
      </div>
      {hasPhone && (
        <a href={`tel:${phone.replace(/[^0-9]/g, '')}`} className={`p-2 rounded-lg ${bgColor} hover:opacity-80 transition`}>
          <Phone size={16} className={iconColor} />
        </a>
      )}
    </div>
  );
}
