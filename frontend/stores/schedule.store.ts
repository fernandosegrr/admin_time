import { create } from 'zustand';

export interface ClassSchedule {
    id: string;
    name: string;
    classroom?: string;
    teacher?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    color: string;
    isActive: boolean;
    type: 'class';
}

export interface GymSchedule {
    id: string;
    name: string;
    location?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    color: string;
    isActive: boolean;
    skippedDates: string[];
    type: 'gym';
}

export interface PropedeuticoSchedule {
    id: string;
    name: string;
    location?: string;
    description?: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    color: string;
    isActive: boolean;
    type: 'propedeutico';
}

export type ScheduleItem = ClassSchedule | GymSchedule | PropedeuticoSchedule;

interface ScheduleState {
    classes: ClassSchedule[];
    gym: GymSchedule[];
    propedeutico: PropedeuticoSchedule[];
    selectedDay: number;

    // Actions
    setClasses: (classes: ClassSchedule[]) => void;
    setGym: (gym: GymSchedule[]) => void;
    setPropedeutico: (propedeutico: PropedeuticoSchedule[]) => void;
    setSelectedDay: (day: number) => void;
    getAllForDay: (day: number) => ScheduleItem[];
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
    classes: [],
    gym: [],
    propedeutico: [],
    selectedDay: new Date().getDay(),

    setClasses: (classes) => set({ classes }),
    setGym: (gym) => set({ gym }),
    setPropedeutico: (propedeutico) => set({ propedeutico }),
    setSelectedDay: (selectedDay) => set({ selectedDay }),

    getAllForDay: (day) => {
        const state = get();
        const all: ScheduleItem[] = [
            ...state.classes.filter(c => c.dayOfWeek === day && c.isActive),
            ...state.gym.filter(g => g.dayOfWeek === day && g.isActive),
            ...state.propedeutico.filter(p => p.dayOfWeek === day && p.isActive)
        ];
        return all.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
}));
