import { create } from 'zustand';

interface NotificationState {
  fcmToken: string | null;
  setFcmToken: (token: string | null) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  fcmToken: null,
  setFcmToken: (token) => set({ fcmToken: token }),
}));
