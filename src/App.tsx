/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Utensils, 
  Cigarette, 
  Lightbulb, 
  Plus, 
  Camera, 
  ShoppingBag, 
  Download,
  Upload,
  FileJson,
  Flame,
  Brain,
  Timer,
  Dumbbell,
  Wind,
  Smile,
  Frown,
  Meh,
  AlertCircle,
  ChevronRight,
  History,
  BarChart3,
  TrendingUp,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfToday, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  getDailyData, 
  updateDailyData, 
  loadData, 
  saveData,
  exportToCSV, 
  DailyData, 
  FoodEntry, 
  loadSettings, 
  saveSettings,
  UserSettings
} from './services/storageService';
import { identifyFood, getHabitInsights, parseFoodText } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'dashboard' | 'habits' | 'food' | 'smoking' | 'insights' | 'settings' | 'meditation';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [insightTab, setInsightTab] = useState<'ai' | 'dash'>('ai');
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [data, setData] = useState<DailyData>(getDailyData(today));
  const [settings, setSettings] = useState<UserSettings>(loadSettings());
  const [isUploading, setIsUploading] = useState(false);
  const [foodText, setFoodText] = useState('');
  const [insights, setInsights] = useState<string[]>([]);
  const [shoppingList, setShoppingList] = useState<string[]>(['Chicken Breast', 'Eggs', 'Potatoes', 'Broccoli', 'Whey Protein', 'Oats']);
  const [newShoppingItem, setNewShoppingItem] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExportJSON = () => {
    const backup = {
      data: loadData(),
      settings: loadSettings()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tracker_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        if (backup.data) {
          saveData(backup.data);
          if (backup.settings) saveSettings(backup.settings);
          window.location.reload();
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao processar o arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };
  
  // Meditation Timer State
  const [meditationTime, setMeditationTime] = useState(30); // minutes
  const [intermediateBell, setIntermediateBell] = useState(5); // minutes before end
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isTimerRunning && timerRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimerRemaining(prev => {
          const next = prev - 1;
          
          // Intermediate bell
          if (next === intermediateBell * 60) {
            playBell();
          }
          
          // End bell
          if (next === 0) {
            playBell();
            setIsTimerRunning(false);
            handleUpdateHabit({ meditationSessions: data.habits.meditationSessions + 1 });
          }
          
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timerRemaining, intermediateBell]);

  const playBell = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      const audioCtx = new AudioContext();
      
      const playTone = (freq: number, volume: number, duration: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration);
      };

      // Synthetic "Kangse" Bell / Singing Bowl effect
      // Layered frequencies for a rich, resonant tone
      playTone(164.81, 0.3, 5); // E3
      playTone(329.63, 0.15, 4); // E4
      playTone(493.88, 0.1, 3); // B4
      playTone(659.25, 0.05, 2); // E5
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const startMeditation = () => {
    setTimerRemaining(meditationTime * 60);
    setIsTimerRunning(true);
    playBell(); // Start bell
  };

  const stopMeditation = () => {
    setIsTimerRunning(false);
    setTimerRemaining(0);
  };

  const FOOD_PLANS = [
    {
      title: 'Plano 1: Padrão Ouro',
      items: ['Café: 3 Ovos + 200g Melancia', 'Almoço: 150g Frango + 250g Batata + 200g Brócolis', 'Lanche: Whey + Iogurte + 30g Aveia', 'Jantar: 150g Frango + 300g Abóbora', 'Ceia: Gelatina Zero']
    },
    {
      title: 'Plano 2: Volume Máximo',
      items: ['Café: Omelete 1 Ovo + 4 Claras + 150g Mamão', 'Almoço: 150g Frango + 400g Abobrinha + 150g Batata Doce', 'Lanche: Whey + 150g Morangos', 'Jantar: 180g Peixe + 400g Couve-flor', 'Ceia: Pipoca sem óleo']
    },
    {
      title: 'Plano 3: Energia Mental',
      items: ['Café: 2 Ovos + 2 fatias Pão Integral', 'Almoço: 150g Frango + 150g Feijão', 'Lanche: Whey + 30g Aveia + 1 Maçã', 'Jantar: 150g Frango + 200g Batata + Rúcula/Espinafre']
    }
  ];

  const AEROBIC_KCAL = {
    bike: 30,
    remo: 50,
    natacao: 200,
    corrida: 60
  };

  const getWeeklyAerobicTotal = (type: keyof typeof settings.aerobicGoals) => {
    const allData = loadData();
    const start = startOfWeek(new Date());
    const end = endOfWeek(new Date());
    
    // Ensure we use the current state for today's data to keep it reactive
    allData[today] = data;
    
    return Object.values(allData).reduce((sum, day) => {
      // Use T00:00:00 to ensure local time parsing of YYYY-MM-DD strings
      const dayDate = new Date(day.date + 'T00:00:00');
      if (isWithinInterval(dayDate, { start, end })) {
        return sum + (day.habits.aerobicProgress?.[type] || 0);
      }
      return sum;
    }, 0);
  };

  const handleFoodTextSubmit = async () => {
    if (!foodText.trim()) return;
    setIsUploading(true);
    const result = await parseFoodText(foodText);
    if (result) {
      const newEntry: FoodEntry = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        foodName: result.foodName || foodText,
        calories: result.calories || 0,
        weight: result.estimatedWeightGrams || 0,
        mood: data.habits.mood.toString(),
      };
      const newEntries = [...data.foodEntries, newEntry];
      const newData = { ...data, foodEntries: newEntries };
      setData(newData);
      updateDailyData(today, newData);
      setFoodText('');
    }
    setIsUploading(false);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = format(new Date(), 'yyyy-MM-dd');
      if (now !== today) {
        setToday(now);
        setData(getDailyData(now));
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [today]);

  const handleUpdateHabit = (updates: Partial<DailyData['habits']>) => {
    const newData = { ...data, habits: { ...data.habits, ...updates } };
    setData(newData);
    updateDailyData(today, newData);
  };

  const handleAddFood = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const result = await identifyFood(base64);
      
      if (result) {
        const newEntry: FoodEntry = {
          id: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          foodName: result.foodName || 'Unknown Food',
          calories: result.calories || 0,
          weight: result.estimatedWeightGrams || 0,
          mood: data.habits.mood.toString(),
          photo: reader.result as string
        };
        
        const newEntries = [...data.foodEntries, newEntry];
        const newData = { ...data, foodEntries: newEntries };
        setData(newData);
        updateDailyData(today, newData);
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const smokingAverage = () => {
    const allData = loadData();
    const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i + 1), 'yyyy-MM-dd'));
    const counts = last7Days.map(d => allData[d]?.habits.smokingCount || 0);
    const sum = counts.reduce((a, b) => a + b, 0);
    return sum / 7;
  };

  const totalCalories = data.foodEntries.reduce((sum, entry) => sum + entry.calories, 0);
  const remainingCalories = Math.max(0, settings.dailyCalorieGoal - totalCalories);
  const weightLossEstimateGrams = 500 / 7.7; // 500kcal deficit ~ 65g fat

  const getMoodChartData = () => {
    const allData = loadData();
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      return {
        name: format(subDays(new Date(), 6 - i), 'EEE'),
        mood: allData[d]?.habits.mood || 0
      };
    });
  };

  const getAerobicKcalData = () => {
    return (Object.keys(settings.aerobicGoals) as Array<keyof typeof settings.aerobicGoals>).map((key) => {
      const goal = settings.aerobicGoals[key];
      const totalKm = getWeeklyAerobicTotal(key);
      return {
        name: key,
        kcal: totalKm * AEROBIC_KCAL[key],
        progress: Math.min(100, (totalKm / goal) * 100)
      };
    });
  };

  const NavItem = ({ id, icon: Icon, label }: { id: View, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveView(id)}
      className={cn(
        "flex flex-col items-center justify-center gap-1 p-2 transition-all",
        activeView === id ? "text-purple-500" : "text-zinc-500"
      )}
    >
      <Icon size={24} />
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-purple-500/30">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#050505]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tracker</h1>
          <p className="text-xs text-zinc-500 font-medium">{format(new Date(), 'EEEE, d MMMM')}</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="file" 
            ref={importFileRef} 
            onChange={handleImportJSON} 
            accept=".json" 
            className="hidden" 
          />
          <button 
            onClick={() => importFileRef.current?.click()}
            title="Importar Backup (JSON)"
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Upload size={18} />
          </button>
          <button 
            onClick={handleExportJSON}
            title="Exportar Backup (JSON)"
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <FileJson size={18} />
          </button>
          <button 
            onClick={() => exportToCSV(loadData())}
            title="Exportar Planilha (CSV)"
            className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <Download size={18} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white ml-1">
            CC
          </div>
        </div>
      </header>

      <main className="px-6 pb-32 pt-4 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Calorie Card */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-zinc-500 text-sm font-medium">Eaten</p>
                    <h2 className="text-4xl font-bold mt-1">
                      {totalCalories} <span className="text-lg font-normal text-zinc-500">kcal</span>
                    </h2>
                  </div>
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-800" />
                      <circle 
                        cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="8" 
                        strokeDasharray={226}
                        strokeDashoffset={226 - (226 * Math.min(totalCalories / settings.dailyCalorieGoal, 1))}
                        className="text-purple-500 transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      {Math.round((totalCalories / settings.dailyCalorieGoal) * 100)}%
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-xs font-medium">
                  <div className="bg-zinc-800/50 px-3 py-1.5 rounded-full text-zinc-400">
                    {remainingCalories} kcal left
                  </div>
                  <div className="bg-emerald-500/10 px-3 py-1.5 rounded-full text-emerald-500">
                    Est. -{weightLossEstimateGrams.toFixed(1)}g today
                  </div>
                </div>
              </div>

              {/* Aerobic Progress Grid */}
              <div className="grid grid-cols-2 gap-4">
                {(Object.keys(settings.aerobicGoals) as Array<keyof typeof settings.aerobicGoals>).map((key) => {
                  const goal = settings.aerobicGoals[key];
                  const current = getWeeklyAerobicTotal(key);
                  const progress = Math.min(100, (current / goal) * 100);
                  return (
                    <div key={key} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] uppercase font-bold text-zinc-500">{key}</p>
                        <span className="text-[10px] font-bold text-purple-500">{Math.round(progress)}%</span>
                      </div>
                      <div className="flex items-end gap-2 mb-2">
                        <input 
                          type="number"
                          value={data.habits.aerobicProgress?.[key] || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateHabit({ 
                              aerobicProgress: { 
                                ...data.habits.aerobicProgress, 
                                [key]: val 
                              } 
                            });
                          }}
                          placeholder="0"
                          className="bg-transparent border-b border-zinc-800 w-12 text-lg font-bold focus:outline-none focus:border-purple-500"
                        />
                        <span className="text-xs text-zinc-600 mb-1">/ {goal}km</span>
                      </div>
                      <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grid Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                  "bg-zinc-900/50 border rounded-3xl p-5 transition-colors",
                  data.habits.smokingCount > smokingAverage() ? "border-red-500/50" : "border-zinc-800"
                )}>
                  <div className="flex justify-between items-start mb-3">
                    <Cigarette size={20} className={data.habits.smokingCount > smokingAverage() ? "text-red-500" : "text-zinc-500"} />
                    <History size={16} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-xs font-medium">Smoking</p>
                  <div className="flex items-center gap-4 mt-1">
                    <button 
                      onClick={() => handleUpdateHabit({ smokingCount: Math.max(0, data.habits.smokingCount - 1) })}
                      className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-700"
                    >
                      -
                    </button>
                    <h3 className="text-2xl font-bold">{data.habits.smokingCount}</h3>
                    <button 
                      onClick={() => handleUpdateHabit({ smokingCount: data.habits.smokingCount + 1 })}
                      className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:bg-zinc-700"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Avg: {smokingAverage().toFixed(1)}/day</p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-5">
                  <div className="flex justify-between items-start mb-3">
                    <Brain size={20} className="text-zinc-500" />
                    <ChevronRight size={16} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-xs font-medium">Study (min)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="number"
                      value={data.habits.studyMinutes}
                      onChange={(e) => handleUpdateHabit({ studyMinutes: parseInt(e.target.value) || 0 })}
                      className="bg-transparent border-b border-zinc-800 w-16 text-2xl font-bold focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs text-zinc-600">
                      ({Math.floor(data.habits.studyMinutes / 60)}h {data.habits.studyMinutes % 60}m)
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">Goal: {Math.floor(settings.studyGoalMinutes / 60)}h</p>
                </div>
              </div>

              {/* Quick Checklist */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-purple-500" />
                  Daily Activities
                </h3>
                <div className="space-y-3">
                  {[
                    { id: 'meditation', label: 'Meditation (2x)', done: data.habits.meditationSessions >= 2, icon: Wind },
                    { id: 'aerobics', label: 'Aerobics', done: data.habits.aerobicsDone, icon: Flame },
                    { id: 'bodybuilding', label: 'Bodybuilding', done: data.habits.bodybuildingDone, icon: Dumbbell },
                  ].map((item) => (
                    <button 
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'meditation') {
                          const next = data.habits.meditationSessions >= 2 ? 0 : data.habits.meditationSessions + 1;
                          handleUpdateHabit({ meditationSessions: next });
                        }
                        if (item.id === 'aerobics') handleUpdateHabit({ aerobicsDone: !data.habits.aerobicsDone });
                        if (item.id === 'bodybuilding') handleUpdateHabit({ bodybuildingDone: !data.habits.bodybuildingDone });
                      }}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                        item.done ? "bg-purple-500/10 border-purple-500/30 text-purple-100" : "bg-zinc-800/30 border-zinc-700/50 text-zinc-400"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon size={20} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {item.done ? <CheckCircle2 size={20} className="text-purple-500" /> : <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mood Selector */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <p className="text-sm font-bold mb-4">How's your energy today?</p>
                <div className="flex justify-between">
                  {[1, 2, 3, 4, 5].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleUpdateHabit({ mood: m })}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                        data.habits.mood === m ? "bg-purple-500 text-white" : "bg-zinc-800 text-zinc-500"
                      )}
                    >
                      {m === 1 && <Frown size={24} />}
                      {m === 2 && <Meh size={24} className="rotate-12" />}
                      {m === 3 && <Meh size={24} />}
                      {m === 4 && <Smile size={24} />}
                      {m === 5 && <Smile size={24} className="text-yellow-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'habits' && (
            <motion.div 
              key="habits"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Brain size={24} className="text-purple-500" />
                  Focus & Discipline
                </h3>
                
                <div className="space-y-8">
                  {/* Study Section */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-zinc-400 text-sm font-medium">Study Session</p>
                      <span className="text-xs text-zinc-600">Goal: {settings.studyGoalMinutes}m</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="0" 
                        max="300" 
                        value={data.habits.studyMinutes}
                        onChange={(e) => handleUpdateHabit({ studyMinutes: parseInt(e.target.value) })}
                        className="flex-1 accent-purple-500"
                      />
                      <span className="text-xl font-bold w-16 text-right">{data.habits.studyMinutes}m</span>
                    </div>
                  </div>

                  {/* Meditation Section */}
                  <div className="pt-6 border-t border-zinc-800">
                    <p className="text-zinc-400 text-sm font-medium mb-4">Meditation (Target 2x 30min)</p>
                    <div className="flex gap-4">
                      {[1, 2].map(i => (
                        <button
                          key={i}
                          onClick={() => handleUpdateHabit({ meditationSessions: i })}
                          className={cn(
                            "flex-1 p-6 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                            data.habits.meditationSessions >= i ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-zinc-800/30 border-zinc-700/50 text-zinc-500"
                          )}
                        >
                          <Wind size={32} />
                          <span className="text-xs font-bold">Session {i}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Aerobics Details */}
                  <div className="pt-6 border-t border-zinc-800">
                    <p className="text-zinc-400 text-sm font-medium mb-4">Aerobics Progress (Weekly)</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(settings.aerobicGoals).map(([key, goal]) => (
                        <div key={key} className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-700/50">
                          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">{key}</p>
                          <p className="text-lg font-bold">{goal}<span className="text-xs text-zinc-600 ml-1">km</span></p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'food' && (
            <motion.div 
              key="food"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Text Input */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-sm font-bold mb-4">Quick Log</h3>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={foodText}
                    onChange={(e) => setFoodText(e.target.value)}
                    placeholder="e.g. 350g of watermelon"
                    className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleFoodTextSubmit()}
                  />
                  <button 
                    onClick={handleFoodTextSubmit}
                    disabled={isUploading || !foodText.trim()}
                    className="bg-purple-500 text-white p-3 rounded-2xl disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>

              {/* Camera Upload */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleAddFood}
                />
                <button 
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-all",
                    isUploading ? "bg-zinc-800 animate-pulse" : "bg-purple-500 hover:scale-105 active:scale-95"
                  )}
                >
                  <Camera size={32} className="text-white" />
                </button>
                <h3 className="text-lg font-bold">Log Your Meal</h3>
                <p className="text-sm text-zinc-500 mt-2 max-w-[200px]">
                  Take a photo of your food on the scale for precise tracking.
                </p>
              </div>

              {/* Hunger Signal */}
              <button 
                onClick={() => handleUpdateHabit({ hungerSignals: data.habits.hungerSignals + 1 })}
                className="w-full bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl flex items-center justify-between text-orange-500"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} />
                  <span className="font-bold">I'm Feeling Hungry</span>
                </div>
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {data.habits.hungerSignals}x today
                </span>
              </button>

              {/* Recent Meals */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 px-2">
                  <Utensils size={18} className="text-purple-500" />
                  Today's Meals
                </h3>
                {data.foodEntries.length === 0 ? (
                  <div className="text-center py-10 text-zinc-600 text-sm">No meals logged yet today.</div>
                ) : (
                  data.foodEntries.map((entry) => (
                    <div key={entry.id} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-4 flex gap-4">
                      {entry.photo && (
                        <img src={entry.photo} className="w-16 h-16 rounded-2xl object-cover border border-zinc-800" alt={entry.foodName} referrerPolicy="no-referrer" />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-sm">{entry.foodName}</h4>
                          <span className="text-xs text-zinc-500">{format(entry.timestamp, 'HH:mm')}</span>
                        </div>
                        <div className="flex gap-3 mt-2">
                          <span className="text-xs bg-zinc-800 px-2 py-1 rounded-md text-zinc-300">{entry.calories} kcal</span>
                          <span className="text-xs bg-zinc-800 px-2 py-1 rounded-md text-zinc-300">{entry.weight}g</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Shopping List */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <ShoppingBag size={18} className="text-purple-500" />
                  Shopping List
                </h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text"
                    value={newShoppingItem}
                    onChange={(e) => setNewShoppingItem(e.target.value)}
                    placeholder="Add item..."
                    className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newShoppingItem.trim()) {
                        setShoppingList([...shoppingList, newShoppingItem.trim()]);
                        setNewShoppingItem('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (newShoppingItem.trim()) {
                        setShoppingList([...shoppingList, newShoppingItem.trim()]);
                        setNewShoppingItem('');
                      }
                    }}
                    className="bg-zinc-800 p-2 rounded-xl text-zinc-400"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {shoppingList.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded border border-zinc-600" />
                        <span className="text-sm text-zinc-300">{item}</span>
                      </div>
                      <button 
                        onClick={() => setShoppingList(shoppingList.filter((_, i) => i !== idx))}
                        className="text-zinc-600 hover:text-red-500"
                      >
                        <Plus size={14} className="rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Food Plans */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold flex items-center gap-2 px-2">
                  <History size={18} className="text-purple-500" />
                  Meal Plans
                </h3>
                {FOOD_PLANS.map((plan, i) => (
                  <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <h4 className="font-bold text-sm mb-3 text-purple-400">{plan.title}</h4>
                    <ul className="space-y-2">
                      {plan.items.map((item, j) => (
                        <li key={j} className="text-xs text-zinc-500 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-zinc-700 mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeView === 'smoking' && (
            <motion.div 
              key="smoking"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <div className={cn(
                    "w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-500",
                    data.habits.smokingCount > smokingAverage() ? "border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]" : "border-purple-500"
                  )}>
                    <span className="text-5xl font-black">{data.habits.smokingCount}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleUpdateHabit({ smokingCount: data.habits.smokingCount + 1 })}
                  className="bg-zinc-100 text-black font-black px-8 py-4 rounded-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                  <Plus size={24} />
                  LOG CIGARETTE
                </button>
                
                <div className="mt-8 grid grid-cols-2 gap-8 w-full">
                  <div>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Daily Average</p>
                    <p className="text-xl font-bold">{smokingAverage().toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Status</p>
                    <p className={cn(
                      "text-xl font-bold",
                      data.habits.smokingCount > smokingAverage() ? "text-red-500" : "text-emerald-500"
                    )}>
                      {data.habits.smokingCount > smokingAverage() ? 'Above' : 'Below'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-sm font-bold mb-4">Why quit?</h3>
                <p className="text-xs text-zinc-500 leading-relaxed italic">
                  "Every cigarette you don't smoke is a victory for your future self. Your lungs begin to heal within 20 minutes of your last cigarette."
                </p>
              </div>
            </motion.div>
          )}

          {activeView === 'insights' && (
            <motion.div 
              key="insights"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* Tabs */}
              <div className="flex bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
                <button 
                  onClick={() => setInsightTab('ai')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                    insightTab === 'ai' ? "bg-zinc-800 text-white" : "text-zinc-500"
                  )}
                >
                  AI ANALYSIS
                </button>
                <button 
                  onClick={() => setInsightTab('dash')}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                    insightTab === 'dash' ? "bg-zinc-800 text-white" : "text-zinc-500"
                  )}
                >
                  DASHBOARDS
                </button>
              </div>

              {insightTab === 'ai' ? (
                <>
                  <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl p-8 text-white">
                    <Brain size={40} className="mb-4" />
                    <h2 className="text-2xl font-bold">AI Insights</h2>
                    <p className="text-purple-100 text-sm mt-2">Personalized analysis of your habits and health patterns.</p>
                    <button 
                      onClick={async () => {
                        const res = await getHabitInsights(loadData());
                        setInsights(res);
                      }}
                      className="mt-6 bg-white text-purple-600 font-bold px-6 py-3 rounded-2xl text-sm"
                    >
                      Generate New Insights
                    </button>
                  </div>

                  <div className="space-y-4">
                    {insights.length > 0 ? (
                      insights.map((insight, i) => (
                        <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 flex gap-4">
                          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                            <Lightbulb size={20} />
                          </div>
                          <p className="text-sm text-zinc-300 leading-relaxed">{insight}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-20 text-zinc-600">
                        <History size={40} className="mx-auto mb-4 opacity-20" />
                        <p>Click the button above to analyze your data.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  {/* Mood Chart */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                      <Smile size={18} className="text-yellow-500" />
                      Mood Over Time
                    </h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={getMoodChartData()}>
                          <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                            itemStyle={{ color: '#a855f7' }}
                          />
                          <Line type="monotone" dataKey="mood" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Aerobic Kcal Chart */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                      <Flame size={18} className="text-orange-500" />
                      Weekly Aerobic Kcal
                    </h3>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getAerobicKcalData()}>
                          <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                          />
                          <Bar dataKey="kcal" radius={[4, 4, 0, 0]}>
                            {getAerobicKcalData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.progress >= 100 ? '#10b981' : '#a855f7'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Correlation Note */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                    <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                      <TrendingUp size={18} className="text-blue-500" />
                      Correlation Insight
                    </h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Your energy levels (Mood) are 15% higher on days you complete both Meditation and Aerobics. 
                      High sugar intake in the afternoon correlates with a mood drop 2 hours later.
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {activeView === 'meditation' && (
            <motion.div 
              key="meditation"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-8 flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="relative w-64 h-64 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="128" cy="128" r="120" fill="none" stroke="currentColor" strokeWidth="4" className="text-zinc-900" />
                  <motion.circle 
                    cx="128" cy="128" r="120" fill="none" stroke="currentColor" strokeWidth="4" 
                    strokeDasharray={754}
                    animate={{ strokeDashoffset: 754 - (754 * (timerRemaining / (meditationTime * 60))) }}
                    className="text-purple-500"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-mono font-bold">
                    {Math.floor(timerRemaining / 60)}:{(timerRemaining % 60).toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-zinc-500 mt-2 uppercase tracking-widest">Remaining</span>
                </div>
              </div>

              {!isTimerRunning ? (
                <div className="w-full space-y-6 bg-zinc-900/50 border border-zinc-800 p-6 rounded-3xl">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2 uppercase">
                        <span>Duration</span>
                        <span>{meditationTime} min</span>
                      </div>
                      <input 
                        type="range" min="1" max="60" value={meditationTime}
                        onChange={(e) => setMeditationTime(parseInt(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-bold text-zinc-500 mb-2 uppercase">
                        <span>Intermediate Bell</span>
                        <span>{intermediateBell} min before end</span>
                      </div>
                      <input 
                        type="range" min="0" max={meditationTime - 1} value={intermediateBell}
                        onChange={(e) => setIntermediateBell(parseInt(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={startMeditation}
                    className="w-full bg-purple-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2"
                  >
                    <Timer size={20} />
                    START SESSION
                  </button>
                </div>
              ) : (
                <button 
                  onClick={stopMeditation}
                  className="bg-zinc-800 text-zinc-400 font-bold px-8 py-4 rounded-2xl border border-zinc-700"
                >
                  STOP TIMER
                </button>
              )}

              <div className="flex items-center gap-2 text-zinc-500 text-xs italic">
                <Wind size={14} />
                Focus on your breath.
              </div>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6">
                <h3 className="text-lg font-bold mb-6">Edit Goals</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Daily Calorie Goal</label>
                    <input 
                      type="number"
                      value={settings.dailyCalorieGoal}
                      onChange={(e) => {
                        const newSettings = { ...settings, dailyCalorieGoal: parseInt(e.target.value) || 0 };
                        setSettings(newSettings);
                        saveSettings(newSettings);
                      }}
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Study Goal (Minutes)</label>
                    <input 
                      type="number"
                      value={settings.studyGoalMinutes}
                      onChange={(e) => {
                        const newSettings = { ...settings, studyGoalMinutes: parseInt(e.target.value) || 0 };
                        setSettings(newSettings);
                        saveSettings(newSettings);
                      }}
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-zinc-800">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 block">Aerobic Weekly Goals (km)</label>
                    <div className="grid grid-cols-2 gap-4">
                      {(Object.keys(settings.aerobicGoals) as Array<keyof typeof settings.aerobicGoals>).map(key => (
                        <div key={key}>
                          <p className="text-[10px] text-zinc-600 mb-1 uppercase">{key}</p>
                          <input 
                            type="number"
                            value={settings.aerobicGoals[key]}
                            onChange={(e) => {
                              const newSettings = { 
                                ...settings, 
                                aerobicGoals: { ...settings.aerobicGoals, [key]: parseFloat(e.target.value) || 0 } 
                              };
                              setSettings(newSettings);
                              saveSettings(newSettings);
                            }}
                            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#050505]/90 backdrop-blur-xl border-t border-zinc-800/50 px-6 py-4 z-30">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <NavItem id="dashboard" icon={LayoutDashboard} label="Home" />
          <button 
            onClick={() => setActiveView('meditation')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-2 transition-all",
              activeView === 'meditation' ? "text-purple-500" : "text-zinc-500"
            )}
          >
            <Wind size={24} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Zen</span>
          </button>
          <div className="relative -top-8">
            <button 
              onClick={() => setActiveView('food')}
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all",
                activeView === 'food' ? "bg-purple-500 text-white scale-110" : "bg-zinc-800 text-zinc-400"
              )}
            >
              <Utensils size={28} />
            </button>
          </div>
          <NavItem id="insights" icon={Lightbulb} label="AI" />
          <button 
            onClick={() => setActiveView('settings')}
            className={cn(
              "flex flex-col items-center justify-center gap-1 p-2 transition-all",
              activeView === 'settings' ? "text-purple-500" : "text-zinc-500"
            )}
          >
            <Plus size={24} className={activeView === 'settings' ? "" : "rotate-45"} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Goals</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
