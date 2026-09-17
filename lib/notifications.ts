import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

import { getLoan, setLoanNotificationId } from '@/db/loans';
import type { LoanDirection } from '@/db/types';
import { formatMoney } from '@/lib/money';

const CHANNEL_ID = 'debt-reminders';

// Show reminders even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks for permission (once) and sets up the Android channel. Returns whether allowed. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Debt reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Schedules a reminder for a debt and returns the notification id,
 * or null when the time has passed or permission was refused.
 */
export async function scheduleDebtReminder(opts: {
  direction: LoanDirection;
  personName: string;
  amount: number;
  at: number;
}): Promise<string | null> {
  if (opts.at <= Date.now()) return null;
  if (!(await ensureNotificationPermission())) return null;
  const lent = opts.direction === 'lent';
  return Notifications.scheduleNotificationAsync({
    content: {
      title: lent ? `Collect ${formatMoney(opts.amount)} from ${opts.personName}` : `Pay back ${opts.personName}`,
      body: lent
        ? `${opts.personName} should return ${formatMoney(opts.amount)} to you.`
        : `You should return ${formatMoney(opts.amount)} to ${opts.personName}.`,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: opts.at,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelReminder(notificationId: string | null | undefined) {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Already delivered or removed.
  }
}

export type ReminderSync = 'scheduled' | 'none' | 'denied';

/**
 * Makes a debt's scheduled notification match its current state: cancels the old one,
 * then schedules a new one if the debt is still open and the reminder is in the future.
 */
export async function syncLoanReminder(db: SQLiteDatabase, loanId: number): Promise<ReminderSync> {
  const loan = await getLoan(db, loanId);
  if (!loan) return 'none';
  await cancelReminder(loan.notification_id);
  let result: ReminderSync = 'none';
  let notificationId: string | null = null;
  if (loan.reminder_at != null && loan.reminder_at > Date.now() && loan.remaining > 0) {
    notificationId = await scheduleDebtReminder({
      direction: loan.direction,
      personName: loan.person_name,
      amount: loan.remaining,
      at: loan.reminder_at,
    });
    result = notificationId ? 'scheduled' : 'denied';
  }
  await setLoanNotificationId(db, loanId, notificationId);
  return result;
}
