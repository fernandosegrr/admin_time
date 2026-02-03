import { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { api } from '@/services/api';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7:00 to 21:00
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function WeeklyScreen() {
    const [weekOffset, setWeekOffset] = useState(0);

    const weekStart = useMemo(() => {
        const start = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
        return addDays(start, weekOffset * 7);
    }, [weekOffset]);

    const weekDates = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }, [weekStart]);

    // Fetch all schedules
    const { data: schedules, isLoading } = useQuery({
        queryKey: ['schedules', 'all'],
        queryFn: () => api.getAllSchedules()
    });

    const allScheduleItems = useMemo(() => {
        if (!schedules) return [];
        return [
            ...(schedules.classes || []).map((s: any) => ({ ...s, type: 'class' })),
            ...(schedules.gym || []).map((s: any) => ({ ...s, type: 'gym' })),
            ...(schedules.propedeutico || []).map((s: any) => ({ ...s, type: 'propedeutico' }))
        ];
    }, [schedules]);

    const getSchedulesForDay = (dayOfWeek: number) => {
        return allScheduleItems.filter(s => s.dayOfWeek === dayOfWeek);
    };

    const getSchedulePosition = (startTime: string, endTime: string) => {
        const [startH, startM] = startTime.split(':').map(Number);
        const [endH, endM] = endTime.split(':').map(Number);

        const top = ((startH - 7) * 60 + startM) * (60 / 60); // 60px per hour
        const height = ((endH * 60 + endM) - (startH * 60 + startM)) * (60 / 60);

        return { top, height: Math.max(height, 30) };
    };

    const isToday = (date: Date) => {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    };

    return (
        <View style={styles.container}>
            {/* Week Navigation */}
            <View style={styles.weekNav}>
                <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)}>
                    <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>

                <Text style={styles.weekTitle}>
                    {format(weekStart, "d MMM", { locale: es })} - {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
                </Text>

                <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)}>
                    <Ionicons name="chevron-forward" size={24} color="#fff" />
                </TouchableOpacity>

                {weekOffset !== 0 && (
                    <TouchableOpacity
                        style={styles.todayButton}
                        onPress={() => setWeekOffset(0)}
                    >
                        <Text style={styles.todayButtonText}>Hoy</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#4285F4' }]} />
                    <Text style={styles.legendText}>Clases</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#34A853' }]} />
                    <Text style={styles.legendText}>Gym</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#FBBC04' }]} />
                    <Text style={styles.legendText}>Propedéutico</Text>
                </View>
            </View>

            {isLoading ? (
                <ActivityIndicator color="#4285F4" style={styles.loader} />
            ) : (
                <ScrollView style={styles.gridContainer}>
                    {/* Day Headers */}
                    <View style={styles.dayHeaders}>
                        <View style={styles.timeColumn} />
                        {weekDates.map((date, i) => (
                            <View
                                key={i}
                                style={[styles.dayHeader, isToday(date) && styles.todayHeader]}
                            >
                                <Text style={[styles.dayName, isToday(date) && styles.todayText]}>
                                    {DAYS[(i + 1) % 7]}
                                </Text>
                                <Text style={[styles.dayNumber, isToday(date) && styles.todayText]}>
                                    {format(date, 'd')}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Time Grid */}
                    <View style={styles.gridBody}>
                        {/* Time Labels */}
                        <View style={styles.timeColumn}>
                            {HOURS.map(hour => (
                                <View key={hour} style={styles.timeSlot}>
                                    <Text style={styles.timeLabel}>{`${hour}:00`}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Day Columns */}
                        {weekDates.map((date, dayIndex) => {
                            const dayOfWeek = (dayIndex + 1) % 7; // Convert to proper day (Mon=1, Sun=0)
                            const daySchedules = getSchedulesForDay(dayOfWeek);

                            return (
                                <View key={dayIndex} style={styles.dayColumn}>
                                    {/* Hour lines */}
                                    {HOURS.map(hour => (
                                        <View key={hour} style={styles.hourLine} />
                                    ))}

                                    {/* Schedule items */}
                                    {daySchedules.map((schedule: any) => {
                                        const pos = getSchedulePosition(schedule.startTime, schedule.endTime);
                                        return (
                                            <View
                                                key={schedule.id}
                                                style={[
                                                    styles.scheduleItem,
                                                    {
                                                        top: pos.top,
                                                        height: pos.height,
                                                        backgroundColor: schedule.color || '#4285F4'
                                                    }
                                                ]}
                                            >
                                                <Text style={styles.scheduleItemText} numberOfLines={2}>
                                                    {schedule.name}
                                                </Text>
                                                <Text style={styles.scheduleItemTime}>
                                                    {schedule.startTime}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f0f23',
    },
    weekNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        gap: 16,
    },
    weekTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    todayButton: {
        backgroundColor: '#4285F4',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    todayButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        paddingBottom: 12,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        color: '#888',
        fontSize: 12,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gridContainer: {
        flex: 1,
    },
    dayHeaders: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#2a2a4e',
    },
    timeColumn: {
        width: 50,
    },
    dayHeader: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
    },
    todayHeader: {
        backgroundColor: 'rgba(66, 133, 244, 0.2)',
        borderRadius: 8,
    },
    dayName: {
        color: '#888',
        fontSize: 12,
    },
    dayNumber: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    todayText: {
        color: '#4285F4',
    },
    gridBody: {
        flexDirection: 'row',
    },
    timeSlot: {
        height: 60,
        justifyContent: 'flex-start',
        paddingTop: 4,
        paddingRight: 8,
    },
    timeLabel: {
        color: '#666',
        fontSize: 10,
        textAlign: 'right',
    },
    dayColumn: {
        flex: 1,
        position: 'relative',
        borderLeftWidth: 1,
        borderLeftColor: '#2a2a4e',
    },
    hourLine: {
        height: 60,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a2e',
    },
    scheduleItem: {
        position: 'absolute',
        left: 2,
        right: 2,
        borderRadius: 4,
        padding: 4,
        overflow: 'hidden',
    },
    scheduleItemText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    scheduleItemTime: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 9,
    },
});
