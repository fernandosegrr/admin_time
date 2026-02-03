import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

interface Schedule {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    name: string;
}

interface Task {
    id: string;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
    suggestedDate?: Date | null;
    suggestedTime?: string | null;
    priority?: string;
    course?: { name: string } | null;
}

interface SuggestInput {
    task: Task;
    schedules: {
        classes: Schedule[];
        gym: Schedule[];
        propedeutico: Schedule[];
    };
    otherTasks: Task[];
}

interface MultipleSuggestInput {
    tasks: Task[];
    schedules: {
        classes: Schedule[];
        gym: Schedule[];
        propedeutico: Schedule[];
    };
}

interface TaskSuggestion {
    taskId: string;
    date: string;
    time: string;
    duration: string;
    reasoning: string;
}

class AIService {
    private getDayName(day: number): string {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return days[day];
    }

    private formatScheduleForAI(schedules: SuggestInput['schedules']): string {
        const all = [
            ...schedules.classes.map(s => ({ ...s, type: 'Clase' })),
            ...schedules.gym.map(s => ({ ...s, type: 'Gym' })),
            ...schedules.propedeutico.map(s => ({ ...s, type: 'Propedéutico' }))
        ];

        if (all.length === 0) return 'No hay horarios registrados.';

        return all.map(s =>
            `- ${this.getDayName(s.dayOfWeek)} ${s.startTime}-${s.endTime}: ${s.type} (${s.name})`
        ).join('\n');
    }

    async suggestTaskTime(input: SuggestInput): Promise<TaskSuggestion> {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dueDateStr = input.task.dueDate
            ? input.task.dueDate.toISOString().split('T')[0]
            : 'No especificada';

        const scheduledTasks = input.otherTasks
            .filter(t => t.suggestedDate)
            .map(t => `- ${t.title}: ${t.suggestedDate?.toISOString().split('T')[0]} a las ${t.suggestedTime}`)
            .join('\n') || 'Ninguna';

        const prompt = `Eres un asistente de gestión de tiempo para estudiantes. Tu tarea es sugerir el mejor día y hora para trabajar en una tarea académica.

TAREA A PROGRAMAR:
- Título: ${input.task.title}
- Descripción: ${input.task.description || 'Sin descripción'}
- Materia: ${input.task.course?.name || 'No especificada'}
- Fecha de entrega: ${dueDateStr}
- Prioridad: ${input.task.priority || 'MEDIUM'}

HORARIOS FIJOS DEL ESTUDIANTE:
${this.formatScheduleForAI(input.schedules)}

TAREAS YA PROGRAMADAS:
${scheduledTasks}

FECHA ACTUAL: ${todayStr}

INSTRUCCIONES:
1. Sugiere un día y hora óptimos para trabajar en esta tarea
2. Evita conflictos con horarios fijos
3. Programa ANTES de la fecha de entrega
4. Considera 1-2 horas de trabajo por tarea
5. Preferir horarios de tarde/noche para tareas (después de las 16:00)
6. No programar muy tarde (después de las 22:00)

Responde SOLO en formato JSON con esta estructura exacta:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "duration": "X horas",
  "reasoning": "Explicación breve"
}`;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 300
            });

            const content = response.choices[0].message.content || '';

            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid AI response format');
            }

            const suggestion = JSON.parse(jsonMatch[0]);
            return {
                taskId: input.task.id,
                date: suggestion.date,
                time: suggestion.time,
                duration: suggestion.duration,
                reasoning: suggestion.reasoning
            };
        } catch (error) {
            console.error('AI suggestion error:', error);

            // Fallback: suggest tomorrow at 17:00
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            return {
                taskId: input.task.id,
                date: tomorrow.toISOString().split('T')[0],
                time: '17:00',
                duration: '2 horas',
                reasoning: 'Sugerencia por defecto (mañana a las 17:00)'
            };
        }
    }

    async suggestMultipleTaskTimes(input: MultipleSuggestInput): Promise<TaskSuggestion[]> {
        const tasks = input.tasks.slice(0, 10); // Limit to 10 tasks

        const taskList = tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description?.slice(0, 100),
            course: t.course?.name,
            dueDate: t.dueDate?.toISOString().split('T')[0],
            priority: t.priority
        }));

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        const prompt = `Eres un asistente de gestión de tiempo para estudiantes. Programa múltiples tareas de forma óptima.

TAREAS A PROGRAMAR:
${JSON.stringify(taskList, null, 2)}

HORARIOS FIJOS:
${this.formatScheduleForAI(input.schedules)}

FECHA ACTUAL: ${todayStr}

INSTRUCCIONES:
1. Distribuye las tareas de forma equilibrada
2. Prioriza las de fecha de entrega más cercana
3. Evita conflictos entre tareas y horarios fijos
4. Sugiere 1-2 horas por tarea entre las 16:00 y 22:00
5. No programes más de 2 tareas por día

Responde SOLO con un array JSON:
[
  { "taskId": "id", "date": "YYYY-MM-DD", "time": "HH:MM", "duration": "X horas", "reasoning": "..." },
  ...
]`;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 1000
            });

            const content = response.choices[0].message.content || '';

            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('Invalid AI response format');
            }

            return JSON.parse(jsonMatch[0]);
        } catch (error) {
            console.error('AI multiple suggestion error:', error);

            // Fallback: distribute across next few days
            return tasks.map((task, index) => {
                const date = new Date();
                date.setDate(date.getDate() + 1 + Math.floor(index / 2));

                return {
                    taskId: task.id,
                    date: date.toISOString().split('T')[0],
                    time: index % 2 === 0 ? '17:00' : '19:00',
                    duration: '2 horas',
                    reasoning: 'Sugerencia por defecto'
                };
            });
        }
    }
}

export const aiService = new AIService();
