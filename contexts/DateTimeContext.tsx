'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DateTimeState {
  date: string;
  time: string;
  isInternetTime: boolean;
  isLoading: boolean;
}

interface DateTimeContextType extends DateTimeState {
  refreshTime: () => Promise<void>;
  forceSync: () => Promise<void>;
}

const DateTimeContext = createContext<DateTimeContextType | undefined>(undefined);

// Singleton to prevent multiple API calls
class TimeService {
  private static instance: TimeService;
  private lastFetch: number = 0;
  private lastSyncCheck: number = 0;
  private cachedData: DateTimeState | null = null;
  private subscribers: Set<(data: DateTimeState) => void> = new Set();
  private displayIntervalId: NodeJS.Timeout | null = null;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private lastKnownOnlineStatus: boolean = true;

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): TimeService {
    if (!TimeService.instance) {
      TimeService.instance = new TimeService();
    }
    return TimeService.instance;
  }

  private setupEventListeners() {
    if (typeof window !== 'undefined') {
      // Sync when page becomes visible (user returns to tab)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          this.handleVisibilityChange();
        }
      });

      // Sync when network status changes
      window.addEventListener('online', () => {
        this.handleNetworkChange(true);
      });

      window.addEventListener('offline', () => {
        this.handleNetworkChange(false);
      });

      // Check for system time changes (user manually adjusts clock)
      this.setupTimeJumpDetection();
    }
  }

  private setupTimeJumpDetection() {
    if (typeof window !== 'undefined') {
      let lastCheck = Date.now();
      
      setInterval(() => {
        const now = Date.now();
        const expectedTime = lastCheck + 10000; // 10 seconds
        const timeDrift = Math.abs(now - expectedTime);
        
        // If time drifted more than 5 seconds, system clock might have changed
        if (timeDrift > 5000) {
          console.log('Time jump detected, forcing sync...');
          this.forceSync();
        }
        
        lastCheck = now;
      }, 10000);
    }
  }

  private handleVisibilityChange() {
    const timeSinceLastSync = Date.now() - this.lastSyncCheck;
    
    // If more than 1 minute since last sync, refresh time
    if (timeSinceLastSync > 60000) {
      console.log('Page visible after extended time, syncing...');
      this.forceSync();
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    if (isOnline && !this.lastKnownOnlineStatus) {
      console.log('Network reconnected, syncing time...');
      this.forceSync();
    }
    this.lastKnownOnlineStatus = isOnline;
  }

  subscribe(callback: (data: DateTimeState) => void): () => void {
    this.subscribers.add(callback);
    
    // Start intervals when first subscriber is added
    if (this.subscribers.size === 1) {
      this.startIntervals();
    }
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
      // Stop intervals when no subscribers
      if (this.subscribers.size === 0) {
        this.stopIntervals();
      }
    };
  }

  private notifySubscribers(data: DateTimeState) {
    this.subscribers.forEach(callback => callback(data));
  }

  private startIntervals() {
    if (this.displayIntervalId || this.syncIntervalId) return;
    
    // Update display every minute for smooth time progression
    this.displayIntervalId = setInterval(() => {
      this.updateDisplayTime();
    }, 60000);

    // Sync with internet every 2 minutes for accuracy
    this.syncIntervalId = setInterval(() => {
      this.syncTime();
    }, 120000); // 2 minutes
  }

  private stopIntervals() {
    if (this.displayIntervalId) {
      clearInterval(this.displayIntervalId);
      this.displayIntervalId = null;
    }
    
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  private updateDisplayTime() {
    if (!this.cachedData) return;

    // Update with current local time (smooth progression)
    const localDate = new Date();
    const formatted = this.formatLocalDateTime(localDate);
    
    const updatedData: DateTimeState = {
      ...this.cachedData,
      date: formatted.date,
      time: formatted.time,
      // Keep the internet status from last sync
    };
    
    this.cachedData = updatedData;
    this.notifySubscribers(updatedData);
  }

  private async syncTime() {
    console.log('Performing scheduled time sync...');
    await this.fetchTime(false); // false = don't show loading
  }

  private async forceSync() {
    console.log('Performing forced time sync...');
    await this.fetchTime(true); // true = show loading
  }

  private formatLocalDateTime(date: Date) {
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Manila', // Force Philippine timezone
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila', // Force Philippine timezone
    };

    return {
      date: date.toLocaleDateString('en-PH', dateOptions), // Use Philippine locale
      time: date.toLocaleTimeString('en-PH', timeOptions), // Use Philippine locale
    };
  }

  private async fetchInternetTime(): Promise<Date | null> {
    try {
      // Philippine time APIs - prioritizing local and regional sources
      const apis = [
        // Philippine timezone from WorldTimeAPI
        'https://worldtimeapi.org/api/timezone/Asia/Manila',
        // Philippine timezone alternative
        'https://worldtimeapi.org/api/timezone/Asia/Manila',
        // Asia timezone as fallback
        'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Manila',
        'http://worldclockapi.com/api/json/manila/now',
        // Final fallback to UTC (will be converted to Philippine time)
        'https://worldtimeapi.org/api/timezone/Etc/UTC',
      ];

      for (const api of apis) {
        try {
          const response = await fetch(api, { 
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000) // Increased timeout for better reliability
          });
          
          if (!response.ok) continue;
          
          const data = await response.json();
          
          let dateString: string;
          let isUTC = false;
          
          // Handle different API response formats
          if (data.datetime) {
            dateString = data.datetime;
            isUTC = api.includes('Etc/UTC');
          } else if (data.date_time) {
            dateString = data.date_time;
          } else if (data.currentDateTime) {
            dateString = data.currentDateTime;
          } else if (data.dateTime) {
            dateString = data.dateTime;
          } else if (data.currentFileTime) {
            // Handle worldclockapi format
            const timestamp = parseInt(data.currentFileTime);
            dateString = new Date(timestamp * 10000 - 621355968000000000).toISOString();
          } else {
            continue;
          }
          
          let internetDate = new Date(dateString);
          
          // If we got UTC time, convert to Philippine time (UTC+8)
          if (isUTC && !isNaN(internetDate.getTime())) {
            internetDate = new Date(internetDate.getTime() + (8 * 60 * 60 * 1000));
          }
          
          if (!isNaN(internetDate.getTime())) {
            console.log(`Successfully fetched time from: ${api}`);
            return internetDate;
          }
        } catch (error) {
          console.warn(`Failed to fetch from ${api}:`, error);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('All Philippine time APIs failed:', error);
      return null;
    }
  }

  async fetchTime(showLoading: boolean = true): Promise<DateTimeState> {
    const now = Date.now();
    
    // Return cached data if it's less than 30 seconds old and not forcing sync
    if (this.cachedData && (now - this.lastFetch) < 30000 && !showLoading) {
      return this.cachedData;
    }

    // Only show loading state if requested and we don't have cached data
    if (showLoading) {
      const loadingState: DateTimeState = {
        date: this.cachedData?.date || '',
        time: this.cachedData?.time || '',
        isInternetTime: this.cachedData?.isInternetTime || false,
        isLoading: true,
      };
      
      this.notifySubscribers(loadingState);
    }

    try {
      const internetDate = await this.fetchInternetTime();
      
      let result: DateTimeState;
      
      if (internetDate) {
        const formatted = this.formatLocalDateTime(internetDate);
        result = {
          date: formatted.date,
          time: formatted.time,
          isInternetTime: true,
          isLoading: false,
        };
      } else {
        const localDate = new Date();
        const formatted = this.formatLocalDateTime(localDate);
        result = {
          date: formatted.date,
          time: formatted.time,
          isInternetTime: false,
          isLoading: false,
        };
      }
      
      this.cachedData = result;
      this.lastFetch = now;
      this.lastSyncCheck = now;
      this.notifySubscribers(result);
      
      return result;
    } catch (error) {
      const localDate = new Date();
      const formatted = this.formatLocalDateTime(localDate);
      const result: DateTimeState = {
        date: formatted.date,
        time: formatted.time,
        isInternetTime: false,
        isLoading: false,
      };
      
      this.cachedData = result;
      this.lastFetch = now;
      this.lastSyncCheck = now;
      this.notifySubscribers(result);
      
      return result;
    }
  }

  getCachedData(): DateTimeState | null {
    return this.cachedData;
  }

  async refreshTime(): Promise<void> {
    await this.fetchTime(true);
  }

  async forceSyncTime(): Promise<void> {
    await this.forceSync();
  }
}

interface DateTimeProviderProps {
  children: ReactNode;
}

export function DateTimeProvider({ children }: DateTimeProviderProps) {
  const [dateTime, setDateTime] = useState<DateTimeState>({
    date: '',
    time: '',
    isInternetTime: false,
    isLoading: true,
  });

  useEffect(() => {
    const timeService = TimeService.getInstance();
    
    // Check if we have cached data
    const cached = timeService.getCachedData();
    if (cached) {
      setDateTime(cached);
    }
    
    // Subscribe to updates
    const unsubscribe = timeService.subscribe(setDateTime);
    
    // Initial fetch if no cached data
    if (!cached) {
      timeService.fetchTime();
    }
    
    return unsubscribe;
  }, []);

  const refreshTime = async () => {
    const timeService = TimeService.getInstance();
    await timeService.refreshTime();
  };

  const forceSync = async () => {
    const timeService = TimeService.getInstance();
    await timeService.forceSyncTime();
  };

  const value: DateTimeContextType = {
    ...dateTime,
    refreshTime,
    forceSync,
  };

  return (
    <DateTimeContext.Provider value={value}>
      {children}
    </DateTimeContext.Provider>
  );
}

export function useDateTime(): DateTimeContextType {
  const context = useContext(DateTimeContext);
  if (context === undefined) {
    throw new Error('useDateTime must be used within a DateTimeProvider');
  }
  return context;
}
