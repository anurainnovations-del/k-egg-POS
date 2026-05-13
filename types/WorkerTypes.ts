import { Timestamp } from "firebase/firestore";

export type UserRole = "admin" | "manager" | "worker";
export interface CreateWorkerRequest {
	name: string;
	email: string;
	password: string;
	phoneNumber?: string;
	employeeId?: string;
	branchAssignments: Array<{
		branchId: string;
		role: "manager" | "worker";
	}>;
	isAdmin?: boolean; // Only available to admin users
	profilePicture?: string;
}

export interface WorkerFilters {
	branchId?: string;
	role?: UserRole;
	status?: "clocked_in" | "clocked_out";
	searchQuery?: string;
	page?: number;
	limit?: number;
	excludeAdmins?: boolean; // For managers who shouldn't see admins
}

export interface WorkSession {
	userId: string;
	branchId: string;
	timeInAt: Timestamp;
	timeOutAt?: Timestamp;
	clockedInBy: string;
	clockedOutBy?: string;
	duration?: number;
	notes?: string;
	sessionType: "scheduled" | "emergency" | "overtime";
}

export interface DateRange {
	startDate: Timestamp;
	endDate: Timestamp;
}

export interface WorkerStats {
	userId: string;
	totalHoursWorked: number;
	totalSessions: number;
	averageSessionDuration: number; // in minutes
	currentStreak: number; // consecutive days worked
	longestStreak: number; // longest consecutive days worked
	thisWeek: {
		hoursWorked: number;
		sessionsCount: number;
		daysWorked: number;
	};
	thisMonth: {
		hoursWorked: number;
		sessionsCount: number;
		daysWorked: number;
	};
	lastSession?: {
		timeInAt: Timestamp;
		timeOutAt?: Timestamp;
		branchId: string;
		duration?: number;
	};
	branchStats: Array<{
		branchId: string;
		hoursWorked: number;
		sessionsCount: number;
		lastWorked?: Timestamp;
	}>;
	overtime: {
		thisWeek: number; // overtime hours this week
		thisMonth: number; // overtime hours this month
		total: number; // total overtime hours
	};
	attendance: {
		punctualityScore: number; // percentage of on-time clock-ins
		averageClockInDelay: number; // minutes late on average
		missedShifts: number; // scheduled but didn't show up
	};
}
