// Fully local task reminders. This module never calls a backend, cloud push
// service, or token endpoint. The operating system owns delivery after a date
// trigger is scheduled, including while the app is backgrounded or closed.
import { Platform } from "react-native";
import type { Task } from "../db/workspace-types";
import { listTasks, updateTask } from "../db/workspace-store";

 type NotificationModule = typeof import("expo-notifications");
let Notifications: NotificationModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications") as NotificationModule;
} catch {
  Notifications = null;
}

export const CHANNEL_ID = "task-reminders-v2";
let configured = false;
let channelReady = false;

export type PermissionState = "granted" | "denied" | "unsupported";
export type ReminderEvent = (event: unknown) => void;

function dateTrigger(when: Date): any {
  const type = Notifications?.SchedulableTriggerInputTypes?.DATE ?? "date";
  return Platform.OS === "android"
    ? { type, date: when, channelId: CHANNEL_ID }
    : { type, date: when };
}

async function setupChannel(): Promise<void> {
  if (channelReady || Platform.OS !== "android" || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Task reminders",
      description: "Local reminders for calendar tasks",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#E8752E",
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    channelReady = true;
  } catch (error) {
    console.warn("[reminders] notification channel setup failed", error);
  }
}

async function ensure(request = true): Promise<boolean> {
  if (!Notifications || Platform.OS === "web") return false;
  try {
    if (!configured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      configured = true;
    }
    await setupChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!request) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn("[reminders] permission setup failed", error);
    return false;
  }
}

export async function requestReminderPermission(): Promise<PermissionState> {
  if (!Notifications || Platform.OS === "web") return "unsupported";
  return (await ensure(true)) ? "granted" : "denied";
}

export async function reminderPermissionStatus(): Promise<PermissionState> {
  if (!Notifications || Platform.OS === "web") return "unsupported";
  try {
    const permission = await Notifications.getPermissionsAsync();
    return permission.granted ? "granted" : "denied";
  } catch (error) {
    console.warn("[reminders] permission status failed", error);
    return "denied";
  }
}

export async function scheduleReminder(
  title: string,
  body: string,
  when: Date,
  data: Record<string, string> = {},
  requestPermission = true,
): Promise<string | null> {
  if (!Notifications || Platform.OS === "web" || Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
    return null;
  }
  try {
    if (!(await ensure(requestPermission))) return null;
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: "default" },
      trigger: dateTrigger(when),
    });
  } catch (error) {
    console.warn("[reminders] schedule failed", error);
    return null;
  }
}

export async function cancelReminder(id: string | null): Promise<void> {
  if (!id || !Notifications || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.warn("[reminders] cancel failed", error);
  }
}

export function reminderSupported(): boolean {
  return !!Notifications && Platform.OS !== "web";
}

export function addReminderListeners(onReceived?: ReminderEvent, onResponse?: ReminderEvent): () => void {
  if (!Notifications || Platform.OS === "web") return () => undefined;
  try {
    const received = onReceived
      ? Notifications.addNotificationReceivedListener(onReceived)
      : null;
    const response = onResponse
      ? Notifications.addNotificationResponseReceivedListener(onResponse)
      : null;
    return () => {
      received?.remove();
      response?.remove();
    };
  } catch (error) {
    console.warn("[reminders] listener setup failed", error);
    return () => undefined;
  }
}

function taskReminderDate(task: Task): Date | null {
  if (!task.dueDate || task.status === "done" || task.isDeleted) return null;
  const time = task.time && /^\\d{2}:\\d{2}$/.test(task.time) ? task.time : "09:00";
  const date = new Date(`${task.dueDate}T${time}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function syncTaskReminder(task: Task, requestPermission = true): Promise<{ reminderAt: string | null; notificationId: string | null }> {
  await cancelReminder(task.notificationId);
  const when = taskReminderDate(task);
  if (!when || when.getTime() <= Date.now()) return { reminderAt: null, notificationId: null };
  const notificationId = await scheduleReminder(
    "Task reminder",
    task.title || "Untitled task",
    when,
    { taskId: task.id },
    requestPermission,
  );
  return notificationId
    ? { reminderAt: when.toISOString(), notificationId }
    : { reminderAt: null, notificationId: null };
}

/** Rehydrates missing local schedules without prompting on app startup. */
export async function reconcileTaskReminders(): Promise<number> {
  if (!reminderSupported() || !(await ensure(false))) return 0;
  const tasks = await listTasks();
  const scheduled = new Set(
    (await Notifications!.getAllScheduledNotificationsAsync()).map((item) => item.identifier),
  );
  let changed = 0;
  for (const task of tasks) {
    const when = taskReminderDate(task);
    if (!when || when.getTime() <= Date.now()) {
      if (task.notificationId || task.reminderAt) {
        await cancelReminder(task.notificationId);
        await updateTask(task.id, { notificationId: null, reminderAt: null });
        changed += 1;
      }
      continue;
    }
    if (task.notificationId && scheduled.has(task.notificationId)) continue;
    const next = await syncTaskReminder(task, false);
    await updateTask(task.id, next);
    if (next.notificationId) changed += 1;
  }
  return changed;
}

export async function cancelAllLocalReminders(): Promise<void> {
  if (!Notifications || Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn("[reminders] cancel-all failed", error);
  }
}
