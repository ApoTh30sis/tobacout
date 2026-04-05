'use client';

import { useState, useRef } from 'react';
import type { RiskTimelinePoint, RiskTimelineResult, SmokingAnalysisResult } from './api/auth/smokingRisk';
import guy1Image from './people/guy1.png';

type Step = 'upload' | 'form' | 'timeline';

interface FormData {
  age: string;
  yearsSmoked: string;
  cigarettesPerDay: string;
  pricePerPack: string;
  state: string;
}

type TimelineEntryView = RiskTimelinePoint & {
  accentColor: string;
  milestone: string;
  milestoneDetail: string;
  cigarettesSmoked: number;
  co2Kg: number;
  waterUsedL: number;
  kgramsLittered: number;
};

function getMoneyComparison(amount: number) {
  if (amount >= 300000) return 'This money could have gone toward a house or major investment';
  if (amount >= 100000) return 'This money could have covered a large down payment or long-term savings';
  if (amount >= 50000) return 'This money could have funded years of rent or multiple international trips';
  if (amount >= 25000) return 'This money could have bought a reliable car or paid for education';
  if (amount >= 10000) return 'This money could have funded travel, a laptop, or emergency savings';
  if (amount >= 5000) return 'This money could have bought a high-end laptop, furniture, or a vacation';
  if (amount >= 2000) return 'This money could have covered a phone, bills, or several months of groceries';
  if (amount >= 500) return 'This money could have paid for essentials, clothes, or small trips';
  return 'Even small daily costs quietly add up over time';
}

function formatKg(value:number) {
  if (value < 1){ 
    return `${Math.round(value * 1000)} g`;
  }
  return `${value.toFixed(2)} kg`;
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatLifeLost(minutes: number) {
  const days = minutes / (60 * 24);
  const years = days / 365;

  if (years >= 1) {
    return `${years.toFixed(1)} yrs`;
  }
  if (days >= 1) {
    return `${Math.round(days)} days`;
  }

  const hours = minutes / 60;
  return `${Math.round(hours)} hrs`;
}

// Neutral grey → deep red as year increases
function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return `#${Math.round(ar + (br - ar) * t).toString(16).padStart(2, '0')}${Math.round(ag + (bg - ag) * t).toString(16).padStart(2, '0')}${Math.round(ab + (bb - ab) * t).toString(16).padStart(2, '0')}`;
}

function accentForYear(year: number): string {
  const stops: [number, string][] = [
    [0,  '#71717a'],
    [8,  '#f97316'],
    [18, '#ef4444'],
    [30, '#7f1d1d'],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [y0, c0] = stops[i];
    const [y1, c1] = stops[i + 1];
    if (year >= y0 && year <= y1) return lerpColor(c0, c1, (year - y0) / (y1 - y0));
  }
  return '#7f1d1d';
}

function getMilestone(year: number): { milestone: string; detail: string } {
  if (year === 0)  return { milestone: 'Today',                     detail: 'This is where you are now. Every year on this line is another year of continued damage.' };
  if (year <= 2)   return { milestone: 'Early Damage Accumulating', detail: 'Lung cilia remain suppressed. Carbon monoxide binding to red blood cells. Elevated cardiovascular strain.' };
  if (year <= 5)   return { milestone: 'Cardiovascular Strain',     detail: 'Blood vessel walls thickening. Reduced circulation. Resting heart rate and blood pressure elevated.' };
  if (year <= 8)   return { milestone: 'Lung Function Declining',   detail: 'FEV1 lung capacity measurably reduced. Chronic cough common. Increased respiratory infections.' };
  if (year <= 12)  return { milestone: 'Compounding Health Debt',   detail: 'Pack-year count in dangerous territory. Cancer risk rising. Heart disease risk significantly elevated.' };
  if (year <= 16)  return { milestone: 'Serious Health Risk',       detail: 'Lung cancer risk multiplied. COPD likelihood high. Peripheral vascular disease a real concern.' };
  if (year <= 20)  return { milestone: 'Severe Long-term Damage',   detail: 'Major organ damage compounding. Life expectancy impact now measured in years, not months.' };
  if (year <= 25)  return { milestone: 'Critical Stage',            detail: 'Irreversible damage to airways, arteries, and lung tissue. Quality of life significantly impacted.' };
  return { milestone: 'Maximum Risk Zone', detail: `${year} more years of smoking. The cumulative toll is severe. It is still not too late to stop.` };
}

// ─── US States list ────────────────────────────────────────────────────────────

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload',   label: 'Photo' },
    { id: 'form',     label: 'Data' },
    { id: 'timeline', label: 'Timeline' },
  ];
  const currentIdx = steps.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-3 mb-10">
      {steps.map((s, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center gap-2">
            {i > 0 && (
              <div className="w-10 h-px" style={{ backgroundColor: done ? '#22c55e' : '#3f3f46' }} />
            )}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: done ? '#22c55e' : active ? '#f59e0b' : '#27272a',
                  color: done ? '#fff' : active ? '#000' : '#71717a',
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span className="text-sm" style={{ color: active ? '#fff' : done ? '#a1a1aa' : '#52525b' }}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Upload Step ───────────────────────────────────────────────────────────────

function UploadStep({
  photo,
  onPhoto,
  onNext,
}: {
  photo: string | null;
  onPhoto: (src: string) => void;
  onNext: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => onPhoto(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center p-6">
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full border"
          style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.2)' }}
        >
          <span style={{ color: '#f59e0b' }} className="text-sm font-medium">Health Timeline Generator</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          Tobac<span style={{ color: '#f59e0b' }}>out</span>
        </h1>
        <p className="text-zinc-400 text-base max-w-sm mx-auto leading-relaxed">
          See the real cost of smoking — and what quitting today means for your next 30 years.
        </p>
      </div>

      <StepIndicator current="upload" />

      <div
        className="w-full max-w-md rounded-2xl border-2 border-dashed p-12 flex flex-col items-center justify-center cursor-pointer transition-all"
        style={{
          borderColor: isDragging ? '#f59e0b' : photo ? '#22c55e' : '#3f3f46',
          backgroundColor: isDragging
            ? 'rgba(245,158,11,0.05)'
            : photo
            ? 'rgba(34,197,94,0.05)'
            : 'rgba(24,24,27,0.6)',
        }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        {photo ? (
          <>
            <div
              className="relative w-28 h-28 rounded-full overflow-hidden mb-4"
              style={{ boxShadow: '0 0 0 4px rgba(34,197,94,0.3)' }}
            >
              <img src={photo} alt="Uploaded" className="w-full h-full object-cover" />
            </div>
            <p className="font-medium" style={{ color: '#22c55e' }}>Photo ready</p>
            <p className="text-zinc-500 text-sm mt-1">Click to change</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#18181b' }}>
              <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Drop your photo here</p>
            <p className="text-zinc-500 text-sm">or click to browse</p>
            <p className="text-zinc-600 text-xs mt-3">JPG, PNG, WEBP supported</p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <button
        onClick={onNext}
        disabled={!photo}
        className="mt-6 px-8 py-3.5 rounded-full font-semibold text-sm transition-all"
        style={{
          backgroundColor: photo ? '#f59e0b' : '#27272a',
          color: photo ? '#000' : '#52525b',
          cursor: photo ? 'pointer' : 'not-allowed',
        }}
      >
        Continue →
      </button>
      <button
        onClick={() => {
          onPhoto(guy1Image.src);
          onNext();
        }}
        className="mt-3 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        Skip photo and continue
      </button>
    </div>
  );
}

// ─── Form Step ─────────────────────────────────────────────────────────────────

function FormStep({
  form,
  onChange,
  onBack,
  onNext,
  isLoading, // NEW
}: {
  form: FormData;
  onChange: (f: FormData) => void;
  onBack: () => void;
  onNext: () => void;
  isLoading: boolean; // NEW
}) {
const isValid =
  form.age &&
  form.yearsSmoked &&
  form.cigarettesPerDay &&
  form.pricePerPack &&
  form.state;

  const field = (
    label: string,
    key: keyof FormData,
    placeholder: string,
    hint?: string,
    suffix?: string,
  ) => (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: '#d4d4d8' }}>{label}</label>
      <div className="relative">
        <input
          type="number"
          min="0"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => onChange({ ...form, [key]: e.target.value })}
          className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
          style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
          onFocus={(e)  => (e.currentTarget.style.borderColor = '#f59e0b')}
          onBlur={(e)   => (e.currentTarget.style.borderColor = '#3f3f46')}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-zinc-600 text-xs mt-1.5">{hint}</p>}
    </div>
  );

  const stateField = (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: '#d4d4d8' }}>State</label>
      <div className="relative">
        <select
          value={form.state}
          onChange={(e) => onChange({ ...form, state: e.target.value })}
          className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none appearance-none"
          style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
          onFocus={(e)  => (e.currentTarget.style.borderColor = '#f59e0b')}
          onBlur={(e)   => (e.currentTarget.style.borderColor = '#3f3f46')}
        >
          <option value="" disabled>Select your state</option>
          {US_STATES.map(([abbr, name]) => (
            <option key={abbr} value={abbr}>
              {name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">
          USA
        </span>
      </div>
      <p className="text-zinc-600 text-xs mt-1.5">Used to fetch CDC PLACES heart disease data for your state.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Tobac<span style={{ color: '#f59e0b' }}>out</span>
        </h1>
      </div>

      <StepIndicator current="form" />

      <div className="w-full max-w-md">
        <div className="rounded-2xl p-8" style={{ backgroundColor: '#111117', border: '1px solid #27272a' }}>
          <h2 className="text-xl font-semibold text-white mb-1">Your Smoking History</h2>
          <p className="text-zinc-500 text-sm mb-7">
            Used to model your personalised health impact across 30 years.
          </p>
          <div className="space-y-5">
            {field('Your Current Age',   'age',              '35', undefined,                'yrs')}
            {stateField}
            {field('Years Smoking',      'yearsSmoked',      '10', 'Decimals OK — e.g. 2.5', 'yrs')}
            {field('Cigarettes Per Day', 'cigarettesPerDay', '10', '1 pack ≈ 20 cigarettes', 'cigs/day')}
            {field('Price Per Pack',     'pricePerPack',     '10', 'Used to estimate total money spent over time', '$ / pack')}
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="flex-1 py-3.5 rounded-full text-sm font-medium"
            style={{ border: '1px solid #3f3f46', color: '#71717a' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#71717a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#3f3f46'; }}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={!isValid || isLoading}
            className="flex-1 py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              backgroundColor: isValid && !isLoading ? '#f59e0b' : '#27272a',
              color: isValid && !isLoading ? '#000' : '#52525b',
              cursor: isValid && !isLoading ? 'pointer' : 'not-allowed',
            }}
          >
            {isLoading ? (
              <>
                {/* Spinner */}
                <svg
                  className="animate-spin"
                  style={{ width: 14, height: 14 }}
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Fetching CDC data…
              </>
            ) : (
              'See My Timeline →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Step ─────────────────────────────────────────────────

const MAX_YEARS = 30;
const TICKS = [0, 10, 20, 30];

function TimelineStep({
  form,
  photo,
  generatedPhotos,
  riskData,
  onEdit,
  onReset,
}: {
  form: FormData;
  photo: string | null;
  generatedPhotos: Record<number, string>;
  riskData: RiskTimelineResult | null;
  onEdit: () => void;
  onReset: () => void;
}) {
  const [selectedYear, setSelectedYear] = useState(0);

  const cpd = parseFloat(form.cigarettesPerDay) || 10;
  const yrs = parseFloat(form.yearsSmoked) || 1;
  const pricePerPack = parseFloat(form.pricePerPack) || 0;

  if (!riskData) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center font-sans">
        Loading timeline...
      </div>
    );
  }

  const rawEntry =
    riskData?.timeline?.find(
      (t: RiskTimelinePoint) => Number(t.yearOffset) === Number(selectedYear)
    ) || riskData?.timeline?.[0];

  if (!rawEntry) {
    return (
      <div className="min-h-screen bg-[#09090f] text-white flex items-center justify-center font-sans">
        No timeline data available.
      </div>
    );
  }

  const cigarettesSmoked =
    selectedYear === 0
      ? Math.round(cpd * 365 * yrs)
      : Math.round(cpd * 365 * (yrs + selectedYear));

  const packsSmoked = cigarettesSmoked / 20;
  const moneySpent = Math.round(packsSmoked * pricePerPack);
  const lifeLostMinutes = cigarettesSmoked * 20;

  const co2Kg = Math.round((cigarettesSmoked * 14) / 1000);
  const waterUsedL = Math.round(cigarettesSmoked * 3.7);
  const kgramsLittered =
    Math.round(cigarettesSmoked * 0.0003 * 0.75 * 100) / 100;

  const entry: TimelineEntryView = {
    ...rawEntry,
    accentColor: accentForYear(selectedYear),
    milestone: getMilestone(selectedYear).milestone,
    milestoneDetail: getMilestone(selectedYear).detail,
    cigarettesSmoked,
    co2Kg,
    waterUsedL,
    kgramsLittered,
  };

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#09090f' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #18181b' }}>
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            {photo && (
              <div className="w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ boxShadow: '0 0 0 2px rgba(245,158,11,0.35)' }}>
                <img src={photo} alt="You" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white leading-tight">
                Tobac<span style={{ color: '#f59e0b' }}>out</span>
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                {riskData?.state ? `CDC CHD baseline: ${riskData.state}` : ''}
              </p>
            </div>
            <button
              onClick={onEdit}
              className="shrink-0 text-sm px-3 py-1.5 rounded-lg"
              style={{ border: '1px solid #3f3f46', color: '#71717a' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#52525b'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#3f3f46'; }}
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
      <div className="flex gap-6 items-start">

        {/* ── Photo column (left) ── */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', border: `1px solid ${entry.accentColor}30` }}>
            {photo ? (
              selectedYear === 0 || !generatedPhotos[selectedYear] ? (
                <img src={photo} alt="You" className="w-full h-full object-cover" />
              ) : (
                <img src={`data:image/jpeg;base64,${generatedPhotos[selectedYear]}`} alt={`+${selectedYear} years`} className="w-full h-full object-cover" />
              )
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#13131a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <span style={{ color: '#52525b', fontSize: 10, textAlign: 'center', padding: '0 12px', lineHeight: 1.5 }}>No photo</span>
              </div>
            )}
          </div>
          <div
            style={{
              marginTop: 10,
              padding: '3px 10px',
              borderRadius: 8,
              fontSize: 11, fontWeight: 600,
              textAlign: 'center',
              backgroundColor: `${entry.accentColor}18`,
              color: entry.accentColor,
              border: `1px solid ${entry.accentColor}30`,
            }}
          >
            {selectedYear === 0 ? 'Today' : `+${selectedYear} years`}
          </div>
        </div>

        {/* ── Main content column (right) ── */}
        <div className="flex-1 min-w-0">

        {/* Timeline Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-zinc-600 text-xs tracking-wide uppercase">
              Years from now if you continue smoking
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: entry.accentColor }}>
              {selectedYear === 0 ? 'Today' : `+${selectedYear} years`}
            </span>
          </div>

          <div className="relative" style={{ paddingTop: 12, paddingBottom: 28 }}>
            <div className="rounded-full" style={{ height: 2, backgroundColor: '#27272a' }} />
            {TICKS.map((t) => {
              const isSelected = t === selectedYear;
              const isPast     = t < selectedYear;
              const tickColor  = accentForYear(t);
              return (
                <div
                  key={t}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${(t / MAX_YEARS) * 100}%`, top: 0, transform: 'translateX(-50%)' }}
                >
                  <div
                    style={{
                      width: isSelected ? 14 : 8,
                      height: isSelected ? 14 : 8,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? tickColor : isPast ? '#3f3f46' : '#27272a',
                      boxShadow: isSelected ? `0 0 0 3px #09090f, 0 0 0 5px ${tickColor}60` : 'none',
                      marginTop: isSelected ? 3 : 6,
                    }}
                  />
                  <span className="text-xs mt-2 tabular-nums" style={{ color: isSelected ? tickColor : '#3f3f46' }}>
                    {t === 0 ? 'Now' : `${t}yr`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Detail Card ── */}
        <div
          className="rounded-2xl overflow-visible"
          style={{
            backgroundColor: '#111117',
            border: `1px solid #1c1c22`,
          }}
        >
<div className="flex flex-col justify-between p-6">
  {/* Title + description */}
  <div className="mb-5">
    <h2 className="text-white font-semibold text-lg mb-1">{entry.milestone}</h2>
    <p className="text-zinc-500 text-sm leading-relaxed">
      {entry.milestoneDetail}
    </p>
    <p className="text-zinc-600 text-xs mt-2">
      Estimated smoking-related risks at this point in the timeline.
    </p>
  </div>

  {/* Health risks — people grid */}
  <div className="space-y-4 mb-5">
    {([
      { label: 'Heart disease', pct: entry.heartDiseasePct },
      { label: 'Stroke',        pct: entry.strokePct },
      { label: 'Lung disease',  pct: entry.lungDiseasePct },
    ] as { label: string; pct: number }[]).map(({ label, pct }) => {
      const TOTAL = 50;
      const filled = Math.max(1, Math.round((pct / 100) * TOTAL));
      const oneInPeople = Math.max(1, Math.round(100 / Math.max(pct, 0.1)));
      return (
        <div key={label}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-zinc-500 text-xs">{label}</span>
            <span className="text-xs tabular-nums" style={{ color: entry.accentColor }}>
              1 out of {oneInPeople} people
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: i < filled ? entry.accentColor : '#27272a',
                  boxShadow: i < filled ? `0 0 5px ${entry.accentColor}60` : 'none',
                  transition: 'background-color 0.3s',
                }}
              />
            ))}
          </div>
        </div>
      );
    })}
  </div>

<div className="grid grid-cols-2 gap-2">
  <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
    <div className="text-zinc-600 text-xs mb-0.5">Cigarettes Smoked</div>
    <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
      {entry.cigarettesSmoked.toLocaleString()}
    </div>
  </div>

  <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
    <div className="text-zinc-600 text-xs mb-0.5">
      {selectedYear === 0 ? 'Annual CO₂' : 'CO₂ Added'}
    </div>
    <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
      {selectedYear === 0
        ? `${Math.round((cpd * 365 * 14) / 1000)} kg/yr`
        : `${entry.co2Kg.toLocaleString()} kg`}
    </div>
  </div>

  <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
    <div className="text-zinc-600 text-xs mb-0.5">Water Used</div>
    <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
      {selectedYear === 0
        ? `${Math.round((cpd * 365 * 3.7) / 1000)} kL/yr`
        : entry.waterUsedL > 999
        ? `${Math.round(entry.waterUsedL / 1000)} kL`
        : `${entry.waterUsedL} L`}
    </div>
  </div>

  <div className="relative rounded-lg p-3" style={{ backgroundColor: '#18181b', overflow: 'visible' }}>
    <div className="flex items-start justify-between mb-0.5">
      <span className="text-zinc-600 text-xs">Cigarette Waste</span>

      <div className="relative group overflow-visible">
        <span className="text-[11px] underline cursor-help transition-colors duration-200 hover:text-white" style={{ color: '#71717a' }}>
          Why this matters
        </span>

        <div className="absolute left-full ml-3 top-1/2 w-64 rounded-xl p-4 z-30 pointer-events-none
                        opacity-0 translate-y-[-50%] translate-x-[-8px]
                        transition-all duration-200 ease-out
                        group-hover:opacity-100 group-hover:translate-x-0"
          style={{
            backgroundColor: '#0f0f15',
            border: '1px solid #27272a',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          }}
        >
          <div className="absolute top-1/2 -left-1.5 w-3 h-3"
            style={{
              backgroundColor: '#0f0f15',
              borderLeft: '1px solid #27272a',
              borderBottom: '1px solid #27272a',
              transform: 'translateY(-50%) rotate(45deg)',
            }}
          />

          <div className="text-white text-sm font-semibold mb-2">Why this matters</div>

          <div className="space-y-2 text-xs text-zinc-400">
            <p>#1 most littered object globally</p>
            <p>1 butt can contaminate <span className="text-white">1,000 L</span> of water</p>
            <p>Filters = plastic → long-term pollution</p>
          </div>
        </div>
      </div>
    </div>

    <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
      {selectedYear === 0
        ? `${formatKg(cpd * 365 * 0.0003 * 0.75)}`
        : formatKg(entry.kgramsLittered)}
    </div>
  </div>

  <div className="rounded-lg p-3" style={{ backgroundColor: '#18181b' }}>
    <div className="text-zinc-600 text-xs mb-0.5">Estimated Life Lost</div>
    <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
      {formatLifeLost(lifeLostMinutes)}
    </div>
  </div>

  <div className="relative rounded-lg p-3" style={{ backgroundColor: '#18181b', overflow: 'visible' }}>
    <div className="flex items-start justify-between mb-0.5">
      <span className="text-zinc-600 text-xs">Money Spent</span>

      <div className="relative group overflow-visible">
        <span className="text-[11px] underline cursor-help transition-colors duration-200 hover:text-white" style={{ color: '#71717a' }}>
          What else?
        </span>

        <div className="absolute left-full ml-3 top-1/2 w-64 rounded-xl p-4 z-30 pointer-events-none
                        opacity-0 translate-y-[-50%] translate-x-[-8px]
                        transition-all duration-200 ease-out
                        group-hover:opacity-100 group-hover:translate-x-0"
          style={{
            backgroundColor: '#0f0f15',
            border: '1px solid #27272a',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          }}
        >
          <div className="absolute top-1/2 -left-1.5 w-3 h-3"
            style={{
              backgroundColor: '#0f0f15',
              borderLeft: '1px solid #27272a',
              borderBottom: '1px solid #27272a',
              transform: 'translateY(-50%) rotate(45deg)',
            }}
          />

          <div className="text-white text-sm font-semibold mb-2">
            What this could have bought
          </div>

          <div className="space-y-2 text-xs text-zinc-400">
            <p>{getMoneyComparison(moneySpent)}</p>
            <p>At this point: <span className="text-white">{formatMoney(moneySpent)}</span></p>
            <p>Smoking costs build quietly over time.</p>
          </div>
        </div>
      </div>
    </div>

    <div className="font-semibold text-sm" style={{ color: entry.accentColor }}>
      {formatMoney(moneySpent)}
    </div>
  </div>
</div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={onReset}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ border: '1px solid #27272a', color: '#52525b' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.borderColor = '#3f3f46'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#52525b'; e.currentTarget.style.borderColor = '#27272a'; }}
          >
            Start over
          </button>

          <div className="flex items-center gap-3">
            {selectedYear > 0 && (
              <button
                onClick={() => setSelectedYear(selectedYear - 10)}
                className="text-sm px-4 py-2 rounded-lg"
                style={{ border: '1px solid #27272a', color: '#71717a' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3f3f46'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; e.currentTarget.style.borderColor = '#27272a'; }}
              >
                ← Back
              </button>
            )}
            {selectedYear < MAX_YEARS ? (
              <button
                onClick={() => setSelectedYear(selectedYear + 10)}
                className="text-sm px-5 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: entry.accentColor, color: '#fff' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                +10 years →
              </button>
            ) : (
              <button
                onClick={() => window.print()}
                className="text-sm px-5 py-2 rounded-lg font-semibold"
                style={{ backgroundColor: '#f59e0b', color: '#000' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fbbf24')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f59e0b')}
              >
                Save Timeline
              </button>
            )}
          </div>
        </div>
      </div> {/* closes p-6 flex-col */}
    </div> {/* closes detail card */}
  </div> {/* closes flex-1 main content column */}
</div> {/* closes flex gap-6 outer row */}
</div> {/* closes max-w-5xl content wrapper */}
</div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [step, setStep]   = useState<Step>('upload');
  const [photo, setPhoto] = useState<string | null>(null);
const [form, setForm] = useState<FormData>({
  age: '',
  yearsSmoked: '',
  cigarettesPerDay: '',
  pricePerPack: '',
  state: '',
});

  const [riskData, setRiskData] = useState<RiskTimelineResult | null>(null);
  const [generatedPhotos, setGeneratedPhotos] = useState<Record<number, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  // Set to true to enable real photoGen API calls
  const PHOTO_GEN_ENABLED = true;

  async function toPhotoUpload(src: string): Promise<{ blob: Blob; filename: string }> {
    if (src.startsWith('data:')) {
      const [header, b64] = src.split(',');
      const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      const binary = atob(b64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      const extension = mime.split('/')[1] ?? 'jpg';
      return {
        blob: new Blob([arr], { type: mime }),
        filename: `photo.${extension}`,
      };
    }

    const res = await fetch(src);
    const blob = await res.blob();
    const extension = blob.type.split('/')[1] ?? 'png';
    return {
      blob,
      filename: `photo.${extension}`,
    };
  }

  async function callPhotoGen(futureYears: number): Promise<string | null> {
    if (!PHOTO_GEN_ENABLED) return null;
    const photoSrc = photo ?? guy1Image.src;
    const { blob, filename } = await toPhotoUpload(photoSrc);
    const fd = new FormData();
    fd.append('noOfCigs', form.cigarettesPerDay);
    fd.append('pastYears', form.yearsSmoked);
    fd.append('futureYears', String(futureYears));
    fd.append('userPhoto', blob, filename);
    const res = await fetch('/api/auth/photoGen', { method: 'POST', body: fd });
    const json = await res.json();
    return json.success && json.data?.[0] ? json.data[0] : null;
  }

  const handleTimelineSubmit = async () => {
  setIsGenerating(true);
  try {
    await new Promise((r) => setTimeout(r, 1200)); // simulate network delay

    const response = await fetch('/api/auth/statRouter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        age: form.age,
        yearsSmoked: form.yearsSmoked,
        cigarettesPerDay: form.cigarettesPerDay,
        state: form.state,
      }),
    });
    const result: SmokingAnalysisResult = await response.json();

    if (!response.ok) {
      throw new Error(
        result.success ? 'Failed to build smoking risk timeline.' : result.error
      );
    }

    if (result.success) {
      setRiskData(result.data);
    }

    const [img10, img20, img30] = await Promise.all([
      callPhotoGen(10),
      callPhotoGen(20),
      callPhotoGen(30),
    ]);

    const photos: Record<number, string> = {};
    if (img10) photos[10] = img10;
    if (img20) photos[20] = img20;
    if (img30) photos[30] = img30;
    setGeneratedPhotos(photos);

    setStep('timeline');
  } catch (err) {
    console.error('Failed to build timeline:', err);
  } finally {
    setIsGenerating(false);
  }
};


  if (step === 'upload') {
    return <UploadStep photo={photo} onPhoto={setPhoto} onNext={() => setStep('form')} />;
  }

  if (step === 'form') {
    if (isGenerating) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#09090f' }}>
          <div style={{ marginBottom: 32, position: 'relative', width: 72, height: 72 }}>
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '2px solid #27272a',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: '#f59e0b',
              animation: 'spin 0.9s linear infinite',
            }} />
          </div>
          <p className="text-white font-semibold text-lg mb-2">Generating your timeline</p>
          <p className="text-zinc-500 text-sm">Analysing your photo and health data…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      );
    }
    return (
      <FormStep
        form={form}
        onChange={setForm}
        onBack={() => setStep('upload')}
        onNext={handleTimelineSubmit}
        isLoading={isGenerating}
      />
    );
  }

return (
  <TimelineStep
    form={form}
    photo={photo}
    generatedPhotos={generatedPhotos}
    riskData={riskData}
    onEdit={() => setStep('form')}
    onReset={() => {
      setStep('upload');
      setPhoto(null);
      setForm({
        age: '',
        yearsSmoked: '',
        cigarettesPerDay: '',
        pricePerPack: '',
        state: '',
      });
      setGeneratedPhotos({});
    }}
  />
);
}
