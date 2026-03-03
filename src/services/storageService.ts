import { format } from 'date-fns';

export interface FoodEntry {
  id: string;
  timestamp: number;
  foodName: string;
  calories: number;
  weight: number;
  mood: string;
  photo?: string;
}

export interface HabitLog {
  meditationSessions: number; // target 2
  studyMinutes: number; // target 120
  aerobicsDone: boolean;
  bodybuildingDone: boolean;
  smokingCount: number;
  hungerSignals: number;
  mood: number; // 1-5
  aerobicProgress: {
    bike: number;
    remo: number;
    natacao: number;
    corrida: number;
  };
}

export interface DailyData {
  date: string; // YYYY-MM-DD
  habits: HabitLog;
  foodEntries: FoodEntry[];
}

export interface UserSettings {
  studyGoalMinutes: number;
  dailyCalorieGoal: number;
  aerobicGoals: {
    bike: number;
    remo: number;
    natacao: number;
    corrida: number;
  };
}

const STORAGE_KEY = 'habit_tracker_data';
const SETTINGS_KEY = 'habit_tracker_settings';

export const defaultSettings: UserSettings = {
  studyGoalMinutes: 120,
  dailyCalorieGoal: 2000,
  aerobicGoals: {
    bike: 60,
    remo: 10,
    natacao: 2,
    corrida: 20
  }
};

export const loadData = (): Record<string, DailyData> => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : {};
};

export const saveData = (data: Record<string, DailyData>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadSettings = (): UserSettings => {
  const settings = localStorage.getItem(SETTINGS_KEY);
  return settings ? JSON.parse(settings) : defaultSettings;
};

export const saveSettings = (settings: UserSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const getDailyData = (date: string): DailyData => {
  const allData = loadData();
  if (allData[date]) return allData[date];
  
  return {
    date,
    habits: {
      meditationSessions: 0,
      studyMinutes: 0,
      aerobicsDone: false,
      bodybuildingDone: false,
      smokingCount: 0,
      hungerSignals: 0,
      mood: 3,
      aerobicProgress: {
        bike: 0,
        remo: 0,
        natacao: 0,
        corrida: 0
      }
    },
    foodEntries: [],
  };
};

export const updateDailyData = (date: string, updates: Partial<DailyData>) => {
  const allData = loadData();
  const current = getDailyData(date);
  allData[date] = { ...current, ...updates };
  saveData(allData);
};

export const exportToCSV = (allData: Record<string, DailyData>) => {
  let csv = 'Date,Meditation,StudyMin,Aerobics,Bodybuilding,Smoking,Hunger,Mood,FoodName,Calories,Weight\n';
  
  Object.values(allData).forEach(day => {
    const base = `${day.date},${day.habits.meditationSessions},${day.habits.studyMinutes},${day.habits.aerobicsDone},${day.habits.bodybuildingDone},${day.habits.smokingCount},${day.habits.hungerSignals},${day.habits.mood}`;
    
    if (day.foodEntries.length === 0) {
      csv += `${base},,, \n`;
    } else {
      day.foodEntries.forEach(food => {
        csv += `${base},"${food.foodName}",${food.calories},${food.weight}\n`;
      });
    }
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `habit_tracker_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
