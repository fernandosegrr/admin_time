import cron from 'node-cron';
import { syncJob } from './sync.job.js';
import { reminderJob } from './reminder.job.js';

export function startCronJobs() {
    // Sync Google Classroom every 15 minutes
    const syncInterval = process.env.CLASSROOM_SYNC_INTERVAL || '15';
    cron.schedule(`*/${syncInterval} * * * *`, async () => {
        console.log('[CRON] Running Classroom sync job...');
        try {
            await syncJob.run();
        } catch (error) {
            console.error('[CRON] Sync job error:', error);
        }
    });

    // Check reminders every 5 minutes
    const reminderInterval = process.env.REMINDER_CHECK_INTERVAL || '5';
    cron.schedule(`*/${reminderInterval} * * * *`, async () => {
        console.log('[CRON] Running reminder job...');
        try {
            await reminderJob.run();
        } catch (error) {
            console.error('[CRON] Reminder job error:', error);
        }
    });

    console.log(`📅 Cron jobs scheduled:`);
    console.log(`   - Classroom sync: every ${syncInterval} minutes`);
    console.log(`   - Reminders: every ${reminderInterval} minutes`);
}
